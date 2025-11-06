import { DateTime } from 'luxon';
import { z } from 'zod';
import { SqliteCache } from './cache/sqliteCache';
import { RateLimiter } from './http/rateLimiter';

export interface StockQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  volume: number;
  currency: string;
  market?: string;
}

export interface HistoricalCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FundamentalSnapshot {
  pe: number;
  ps: number;
  roe: number;
  debtToEquity: number;
  growth5y: number;
  profitMargin: number;
  beta: number;
  dividendYield: number;
}

export interface MarketSummary {
  updatedAt: string;
  headline: string;
  movers: StockQuote[];
}

export interface MarketDataProvider {
  getQuotes(symbols?: string[]): Promise<StockQuote[]>;
  getHistory(symbol: string, period?: string): Promise<HistoricalCandle[]>;
  getFundamentals(symbol: string): Promise<FundamentalSnapshot>;
  searchTicker(query: string): Promise<StockQuote[]>;
  getMarketSummary(): Promise<MarketSummary>;
}

type CacheEntry<T> = {
  value: T;
  expires: number;
};

const DEFAULT_INTRADAY_TTL = 30 * 1000;
const DEFAULT_EOD_TTL = 24 * 60 * 60 * 1000;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'ERIC', 'VOLV-B.ST'];
const DEFAULT_SYMBOL_LIMIT = 200;
const DEFAULT_FETCH_CONCURRENCY = 5;
const DEFAULT_MARKET_API_BASE_URL = 'https://api.massive.com';
const DEFAULT_RATE_LIMIT_INTERVAL_MS = 250;
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;

const coerceNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    const nested = (value as { value?: unknown }).value;
    return coerceNumber(nested);
  }
  return 0;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('Rate limit exceeded');
  }
}

class EmptyMarketDataProvider implements MarketDataProvider {
  async getQuotes(): Promise<StockQuote[]> {
    return [];
  }

  async getHistory(): Promise<HistoricalCandle[]> {
    return [];
  }

  async getFundamentals(): Promise<FundamentalSnapshot> {
    return {
      pe: 0,
      ps: 0,
      roe: 0,
      debtToEquity: 0,
      growth5y: 0,
      profitMargin: 0,
      beta: 0,
      dividendYield: 0
    };
  }

  async searchTicker(): Promise<StockQuote[]> {
    return [];
  }

  async getMarketSummary(): Promise<MarketSummary> {
    return {
      updatedAt: DateTime.now().toISO(),
      headline: 'Ingen data tillgänglig',
      movers: []
    };
  }
}

type FinnhubQuoteResponse = {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
};

type FinnhubProfileResponse = {
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  finnhubIndustry: string;
};

type FinnhubCandleResponse = {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];
  s: 'ok' | 'no_data';
};

type FinnhubMetricResponse = {
  metric: {
    peInclExtraTTM?: number;
    priceToSalesRatioTTM?: number;
    roeTTM?: number;
    totalDebtToEquityQuarterly?: number;
    revenueGrowth5Y?: number;
    netProfitMargin5Y?: number;
    beta?: number;
    dividendYieldIndicatedAnnual?: number;
  };
};

type FinnhubSearchResponse = {
  result: Array<{
    symbol: string;
    description: string;
    type: string;
  }>;
};

type FinnhubSymbolResponse = Array<{
  symbol: string;
  description: string;
  type: string;
  currency: string;
  figi?: string;
}>;

type MassiveTickerReference = {
  ticker: string;
  name?: string;
  market?: string;
  locale?: string;
  primary_exchange?: string;
  type?: string;
  active?: boolean;
  currency_name?: string;
  sector?: string;
  industry?: string;
};

type MassiveTickerListResponse = {
  results?: MassiveTickerReference[];
  status?: string;
  next_url?: string | null;
};

type MassiveSnapshotTicker = {
  ticker: string;
  todaysChange?: number;
  todaysChangePerc?: number;
  day?: {
    c?: number;
    h?: number;
    l?: number;
    o?: number;
    v?: number;
  };
  lastTrade?: {
    p?: number;
    s?: number;
    t?: number | string;
  };
  prevDay?: {
    c?: number;
    h?: number;
    l?: number;
    o?: number;
    v?: number;
  };
};

type MassiveSnapshotResponse = {
  tickers?: MassiveSnapshotTicker[];
};

type MassiveAggRecord = {
  t: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

type MassiveAggsResponse = {
  results?: MassiveAggRecord[];
};

type MassiveFinancialRecord = {
  metrics?: Record<string, unknown>;
  ratios?: Record<string, unknown>;
};

type MassiveFinancialsResponse = {
  results?: MassiveFinancialRecord[];
};

const MassiveTickerReferenceSchema = z.object({
  ticker: z.string(),
  name: z.string().optional(),
  market: z.string().optional(),
  locale: z.string().optional(),
  primary_exchange: z.string().optional(),
  type: z.string().optional(),
  active: z.boolean().optional(),
  currency_name: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional()
});

const MassiveTickerListSchema = z.object({
  results: z.array(MassiveTickerReferenceSchema).optional(),
  status: z.string().optional(),
  next_url: z.string().nullable().optional()
});

const MassiveSnapshotTickerSchema = z.object({
  ticker: z.string(),
  todaysChange: z.number().optional(),
  todaysChangePerc: z.number().optional(),
  day: z
    .object({
      c: z.number().optional(),
      h: z.number().optional(),
      l: z.number().optional(),
      o: z.number().optional(),
      v: z.number().optional()
    })
    .optional(),
  lastTrade: z
    .object({
      p: z.number().optional(),
      s: z.number().optional(),
      t: z.union([z.number(), z.string()]).optional()
    })
    .optional(),
  prevDay: z
    .object({
      c: z.number().optional(),
      h: z.number().optional(),
      l: z.number().optional(),
      o: z.number().optional(),
      v: z.number().optional()
    })
    .optional()
});

const MassiveSnapshotResponseSchema = z.object({
  tickers: z.array(MassiveSnapshotTickerSchema).optional()
});

const MassiveAggRecordSchema = z.object({
  t: z.number(),
  o: z.number().optional(),
  h: z.number().optional(),
  l: z.number().optional(),
  c: z.number().optional(),
  v: z.number().optional()
});

const MassiveAggsResponseSchema = z.object({
  results: z.array(MassiveAggRecordSchema).optional()
});

const MassiveFinancialsResponseSchema = z.object({
  results: z
    .array(
      z.object({
        metrics: z.record(z.any()).optional(),
        ratios: z.record(z.any()).optional()
      })
    )
    .optional()
});

export class FinnhubMarketDataProvider implements MarketDataProvider {
  private readonly intradayTtl: number;

  private readonly eodTtl: number;

  private readonly defaultSymbols: string[];

  private readonly trackedExchanges: string[];

  private readonly quoteCache: Map<string, CacheEntry<StockQuote>> = new Map();

  private readonly historyCache: Map<string, CacheEntry<HistoricalCandle[]>> = new Map();

  private readonly fundamentalCache: Map<string, CacheEntry<FundamentalSnapshot>> = new Map();

  private readonly profileCache: Map<string, CacheEntry<FinnhubProfileResponse>> = new Map();

  private symbolUniverseCache: CacheEntry<string[]> | null = null;

  private readonly symbolMetadata: Map<string, { description: string; currency: string }> = new Map();
  private readonly baseUrl: string;
  private readonly maxSymbolsPerRequest: number;

  private readonly fetchConcurrency: number;

  private pendingSymbolQueue: string[] = [];

  private pendingSymbolSet: Set<string> = new Set();

  private readonly fallbackProvider = new EmptyMarketDataProvider();

  constructor(
    private readonly apiKey: string,
    options: {
      intradayTtlMs?: number;
      eodTtlMs?: number;
      defaultSymbols?: string[];
      exchanges?: string[];
      symbolLimit?: number;
      fetchConcurrency?: number;
      baseUrl?: string;
      fetchImpl?: typeof fetch;
    } = {}
  ) {
    if (!apiKey) {
      throw new Error('Finnhub API key is required');
    }

    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.intradayTtl = options.intradayTtlMs ?? DEFAULT_INTRADAY_TTL;
    this.eodTtl = options.eodTtlMs ?? DEFAULT_EOD_TTL;
    this.defaultSymbols = options.defaultSymbols ?? DEFAULT_SYMBOLS;
    this.trackedExchanges = options.exchanges ?? ['US', 'ST'];
    this.maxSymbolsPerRequest = Math.max(
      5,
      Math.min(options.symbolLimit ?? DEFAULT_SYMBOL_LIMIT, 2000)
    );
    this.fetchConcurrency = Math.max(1, options.fetchConcurrency ?? DEFAULT_FETCH_CONCURRENCY);
    this.baseUrl = (options.baseUrl ?? FINNHUB_BASE_URL).replace(/\/$/, '');
  }

  private readonly fetchImpl: typeof fetch;

  async getQuotes(symbols?: string[]): Promise<StockQuote[]> {
    const now = Date.now();
    const targetSymbols = (
      symbols?.length ? symbols : await this.resolveDefaultSymbols()
    ).map((symbol) => symbol.toUpperCase());
    const uniqueSymbols = Array.from(new Set(targetSymbols));
    const quotes: StockQuote[] = [];
    const staleSymbols: string[] = [];

    for (const symbol of uniqueSymbols) {
      const cached = this.quoteCache.get(symbol);
      if (cached && cached.expires > now) {
        quotes.push(cached.value);
      } else {
        staleSymbols.push(symbol);
      }
    }

    if (symbols?.length) {
      const fetched = await this.fetchQuotesForSymbols(staleSymbols);
      quotes.push(...fetched);
    } else {
      this.enqueueSymbols(staleSymbols);
      const symbolsToFetch = this.dequeueSymbols(this.maxSymbolsPerRequest);
      const fetched = await this.fetchQuotesForSymbols(symbolsToFetch);
      quotes.push(...fetched);
    }

    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
    return uniqueSymbols
      .map((symbol) => bySymbol.get(symbol))
      .filter((quote): quote is StockQuote => Boolean(quote));
  }

  async getHistory(symbol: string, period: string = '1y'): Promise<HistoricalCandle[]> {
    const cacheKey = `${symbol.toUpperCase()}-${period}`;
    const now = Date.now();
    const cached = this.historyCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    try {
      const { resolution, from, to } = this.resolveHistoryParams(period);
      const response = await this.fetchJson<FinnhubCandleResponse>('stock/candle', {
        symbol: symbol.toUpperCase(),
        resolution,
        from,
        to
      });

      if (response.s !== 'ok') {
        return [];
      }

      const candles: HistoricalCandle[] = response.t.map((timestamp, index) => ({
        timestamp: DateTime.fromSeconds(timestamp).toUTC().toISO(),
        open: response.o[index] ?? 0,
        high: response.h[index] ?? 0,
        low: response.l[index] ?? 0,
        close: response.c[index] ?? 0,
        volume: response.v[index] ?? 0
      }));

      this.historyCache.set(cacheKey, {
        value: candles,
        expires: now + this.eodTtl
      });

      return candles;
    } catch (error) {
      console.warn(`Finnhub history lookup failed for ${symbol}`, error);
      try {
        return await this.fallbackProvider.getHistory(symbol, period);
      } catch (fallbackError) {
        console.warn(`Fallback history lookup failed for ${symbol}`, fallbackError);
        return [];
      }
    }
  }

  async getFundamentals(symbol: string): Promise<FundamentalSnapshot> {
    const normalized = symbol.toUpperCase();
    const now = Date.now();
    const cached = this.fundamentalCache.get(normalized);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    try {
      const response = await this.fetchJson<FinnhubMetricResponse>('stock/metric', {
        symbol: normalized,
        metric: 'all'
      });

      const metrics = response.metric ?? {};
      const snapshot: FundamentalSnapshot = {
        pe: metrics.peInclExtraTTM ?? 0,
        ps: metrics.priceToSalesRatioTTM ?? 0,
        roe: metrics.roeTTM ?? 0,
        debtToEquity: metrics.totalDebtToEquityQuarterly ?? 0,
        growth5y: metrics.revenueGrowth5Y ?? 0,
        profitMargin: metrics.netProfitMargin5Y ?? 0,
        beta: metrics.beta ?? 0,
        dividendYield: metrics.dividendYieldIndicatedAnnual ?? 0
      };

      this.fundamentalCache.set(normalized, {
        value: snapshot,
        expires: now + this.eodTtl
      });

      return snapshot;
    } catch (error) {
      console.warn(`Finnhub fundamentals lookup failed for ${symbol}`, error);
      try {
        const fallback = await this.fallbackProvider.getFundamentals(symbol);
        this.fundamentalCache.set(normalized, {
          value: fallback,
          expires: now + this.eodTtl
        });
        return fallback;
      } catch (fallbackError) {
        console.warn(`Fallback fundamentals lookup failed for ${symbol}`, fallbackError);
        return {
          pe: 0,
          ps: 0,
          roe: 0,
          debtToEquity: 0,
          growth5y: 0,
          profitMargin: 0,
          beta: 0,
          dividendYield: 0
        };
      }
    }
  }

  async searchTicker(query: string): Promise<StockQuote[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.getQuotes();
    }

    try {
      const response = await this.fetchJson<FinnhubSearchResponse>('search', {
        q: trimmed
      });

      const symbols = response.result
        .map((item) => item.symbol)
        .filter((symbol): symbol is string => Boolean(symbol))
        .slice(0, 10);

      if (symbols.length === 0) {
        return [];
      }

      return this.getQuotes(symbols);
    } catch (error) {
      console.warn(`Finnhub search failed for query "${trimmed}"`, error);
      return this.fallbackProvider.searchTicker(trimmed);
    }
  }

  async getMarketSummary(): Promise<MarketSummary> {
    const quotes = await this.getQuotes();
    const movers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    return {
      updatedAt: DateTime.now().toISO(),
      headline: `Starkast utveckling ${DateTime.now().toFormat('dd MMM yyyy')}`,
      movers
    };
  }

  private async getProfile(symbol: string): Promise<FinnhubProfileResponse | null> {
    const normalized = symbol.toUpperCase();
    const now = Date.now();
    const cached = this.profileCache.get(normalized);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    try {
      const profile = await this.fetchJson<FinnhubProfileResponse>('stock/profile2', {
        symbol: normalized
      });

      this.profileCache.set(normalized, {
        value: profile,
        expires: now + this.eodTtl
      });

      return profile;
    } catch (error) {
      console.warn(`Finnhub profile lookup failed for ${symbol}`, error);
      return null;
    }
  }

  private resolveHistoryParams(period: string): { resolution: string; from: number; to: number } {
    const now = DateTime.now();
    const start = (() => {
      switch (period) {
        case '1m':
          return now.minus({ months: 1 });
        case '3m':
          return now.minus({ months: 3 });
        case '6m':
          return now.minus({ months: 6 });
        case '3y':
          return now.minus({ years: 3 });
        case '5y':
          return now.minus({ years: 5 });
        case 'max':
          return now.minus({ years: 15 });
        case '1y':
        default:
          return now.minus({ years: 1 });
      }
    })();

    const resolution = (() => {
      switch (period) {
        case '1m':
        case '3m':
          return '60';
        case '6m':
        case '1y':
          return 'D';
        default:
          return 'W';
      }
    })();

    return {
      resolution,
      from: Math.floor(start.toSeconds()),
      to: Math.floor(now.toSeconds())
    };
  }

  private async fetchJson<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    url.searchParams.set('token', this.apiKey);

    const response = await this.fetchImpl(url.toString());
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Finnhub request failed: ${response.status} ${response.statusText} - ${message}`);
    }

    return (await response.json()) as T;
  }

  private async resolveDefaultSymbols(): Promise<string[]> {
    const now = Date.now();
    if (this.symbolUniverseCache && this.symbolUniverseCache.expires > now) {
      return this.symbolUniverseCache.value;
    }

    const universes: FinnhubSymbolResponse[] = await Promise.all(
      this.trackedExchanges.map(async (exchange) => {
        try {
          return await this.fetchJson<FinnhubSymbolResponse>('stock/symbol', { exchange });
        } catch (error) {
          console.warn(`Kunde inte hämta symboler för börs ${exchange}`, error);
          return [];
        }
      })
    );

    const flat = universes.flat();
    const symbols: string[] = [];
    for (const entry of flat) {
      const normalized = entry.symbol?.toUpperCase();
      if (!normalized) {
        continue;
      }

      if (!this.symbolMetadata.has(normalized)) {
        this.symbolMetadata.set(normalized, {
          description: entry.description ?? normalized,
          currency: entry.currency ?? 'USD'
        });
      }

      symbols.push(normalized);
    }

    const uniqueSymbols = Array.from(new Set(symbols));

    if (uniqueSymbols.length === 0) {
      console.warn('Symboluniversumet var tomt, använder standardlista.');
      return this.defaultSymbols;
    }

    this.symbolUniverseCache = {
      value: uniqueSymbols,
      expires: now + this.eodTtl
    };
    this.pendingSymbolQueue = [];
    this.pendingSymbolSet.clear();
    this.enqueueSymbols(uniqueSymbols);

    return uniqueSymbols;
  }

  private enqueueSymbols(symbols: string[]) {
    for (const symbol of symbols) {
      if (!this.pendingSymbolSet.has(symbol)) {
        this.pendingSymbolQueue.push(symbol);
        this.pendingSymbolSet.add(symbol);
      }
    }
  }

  private dequeueSymbols(count: number): string[] {
    if (count <= 0) {
      return [];
    }

    const items = this.pendingSymbolQueue.splice(0, count);
    for (const symbol of items) {
      this.pendingSymbolSet.delete(symbol);
    }
    return items;
  }

  private async fetchQuotesForSymbols(symbols: string[]): Promise<StockQuote[]> {
    if (symbols.length === 0) {
      return [];
    }

    const results: StockQuote[] = [];

    for (let index = 0; index < symbols.length; index += this.fetchConcurrency) {
      const batch = symbols.slice(index, index + this.fetchConcurrency);
      const batchResults = await Promise.all(
        batch.map(async (symbol) => this.fetchQuoteForSymbol(symbol).catch(() => null))
      );

      for (const quote of batchResults) {
        if (quote) {
          results.push(quote);
        }
      }
    }

    return results;
  }

  private async fetchQuoteForSymbol(symbol: string): Promise<StockQuote | null> {
    const normalized = symbol.toUpperCase();
    const now = Date.now();

    try {
      const [quoteResponse, profile] = await Promise.all([
        this.fetchJson<FinnhubQuoteResponse>('quote', { symbol: normalized }),
        this.getProfile(normalized)
      ]);

      const stockQuote: StockQuote = {
        symbol: normalized,
        name: profile?.name ?? this.symbolMetadata.get(normalized)?.description ?? normalized,
        sector: profile?.finnhubIndustry ?? 'Okänd',
        price: quoteResponse.c ?? 0,
        changePct: Number((quoteResponse.dp ?? 0).toFixed(2)),
        volume: 0,
        currency: profile?.currency ?? this.symbolMetadata.get(normalized)?.currency ?? 'USD',
        market: profile?.exchange
      };

      this.quoteCache.set(normalized, {
        value: stockQuote,
        expires: now + this.intradayTtl
      });

      return stockQuote;
    } catch (error) {
      console.warn(`Finnhub quote lookup failed for ${normalized}`, error);
      const fallback = await this.fallbackProvider.getQuotes([normalized]);
      if (fallback.length > 0) {
        this.quoteCache.set(normalized, {
          value: fallback[0],
          expires: now + this.intradayTtl
        });
        return fallback[0];
      }

      this.enqueueSymbols([normalized]);
      return null;
    }
  }
}

class MassiveMarketDataProvider implements MarketDataProvider {
  private readonly intradayTtl: number;

  private readonly eodTtl: number;

  private readonly locale: string;

  private readonly market: string;

  private readonly symbolLimit: number;

  private readonly baseUrl: string;

  private readonly fetchImpl: typeof fetch;

  private readonly persistence = new SqliteCache('aktietipset.massive.cache');

  private readonly rateLimiter: RateLimiter;

  private readonly maxRetries: number;

  private readonly quoteCache: Map<string, CacheEntry<StockQuote>> = new Map();

  private readonly historyCache: Map<string, CacheEntry<HistoricalCandle[]>> = new Map();

  private readonly fundamentalCache: Map<string, CacheEntry<FundamentalSnapshot>> = new Map();

  private readonly metadata: Map<
    string,
    { name: string; market?: string; currency: string; type: string }
  > = new Map();

  private symbolUniverseCache: CacheEntry<string[]> | null = null;

  constructor(
    private readonly apiKey: string,
    options: {
      baseUrl?: string;
      locale?: string;
      market?: string;
      symbolLimit?: number;
      intradayTtlMs?: number;
      eodTtlMs?: number;
      fetchImpl?: typeof fetch;
      rateLimitIntervalMs?: number;
      maxRetries?: number;
    } = {}
  ) {
    if (!apiKey) {
      throw new Error('API key is required for MassiveMarketDataProvider');
    }

    this.baseUrl = (options.baseUrl ?? DEFAULT_MARKET_API_BASE_URL).replace(/\/$/, '');
    this.locale = options.locale ?? 'us';
    this.market = options.market ?? 'stocks';
    this.symbolLimit = Math.max(25, Math.min(options.symbolLimit ?? DEFAULT_SYMBOL_LIMIT, 2000));
    this.intradayTtl = options.intradayTtlMs ?? DEFAULT_INTRADAY_TTL;
    this.eodTtl = options.eodTtlMs ?? DEFAULT_EOD_TTL;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    const interval = Math.max(50, options.rateLimitIntervalMs ?? DEFAULT_RATE_LIMIT_INTERVAL_MS);
    this.rateLimiter = new RateLimiter(interval);
    this.maxRetries = Math.max(1, options.maxRetries ?? MAX_RETRY_ATTEMPTS);
  }

  async getQuotes(symbols?: string[]): Promise<StockQuote[]> {
    const now = Date.now();
    try {
      const targetSymbols = symbols?.length
        ? symbols.map((symbol) => this.normalizeSymbol(symbol))
        : await this.resolveDefaultSymbols();

      const quotes: StockQuote[] = [];
      const symbolsToFetch: string[] = [];

      for (const symbol of targetSymbols) {
        const cached = this.quoteCache.get(symbol);
        if (cached && cached.expires > now) {
          quotes.push(cached.value);
          continue;
        }

        const persisted = await this.persistence.get<StockQuote>(this.quoteCacheKey(symbol));
        if (persisted && persisted.expires > now) {
          this.quoteCache.set(symbol, persisted);
          quotes.push(persisted.value);
        } else {
          symbolsToFetch.push(symbol);
        }
      }

      if (symbolsToFetch.length > 0) {
        const snapshots = await this.fetchSnapshotsForSymbols(symbolsToFetch);
        for (const [symbol, snapshot] of snapshots.entries()) {
          const quote = this.snapshotToQuote(snapshot);
          await this.storeQuote(symbol, quote);
          quotes.push(quote);
        }
      }

      const map = new Map(quotes.map((quote) => [quote.symbol, quote]));
      return targetSymbols
        .map((symbol) => map.get(symbol))
        .filter((quote): quote is StockQuote => Boolean(quote));
    } catch (error) {
      console.warn('MassiveMarketDataProvider.getQuotes misslyckades', error);
      return [];
    }
  }

  async getHistory(symbol: string, period: string = '1y'): Promise<HistoricalCandle[]> {
    const normalized = this.normalizeSymbol(symbol);
    const cacheKey = `${normalized}-${period}`;
    const now = Date.now();
    const cached = this.historyCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    try {
      const persisted = await this.persistence.get<HistoricalCandle[]>(
        this.historyCacheKey(normalized, period)
      );
      if (persisted && persisted.expires > now) {
        this.historyCache.set(cacheKey, persisted);
        return persisted.value;
      }

      const { from, to } = this.resolveRange(period);
      const response = await this.fetchJson<MassiveAggsResponse>(
        `v2/aggs/ticker/${normalized}/range/1/day/${from}/${to}`,
        { adjusted: 'true', sort: 'asc', limit: 5000 },
        MassiveAggsResponseSchema
      );
      const candles =
        response.results?.map((entry) => ({
          timestamp: DateTime.fromMillis(entry.t).toUTC().toISO(),
          open: entry.o ?? 0,
          high: entry.h ?? 0,
          low: entry.l ?? 0,
          close: entry.c ?? 0,
          volume: entry.v ?? 0
        })) ?? [];

      this.historyCache.set(cacheKey, {
        value: candles,
        expires: now + this.eodTtl
      });
      await this.persistence.set(this.historyCacheKey(normalized, period), candles, this.eodTtl);

      return candles;
    } catch (error) {
      console.warn(`MassiveMarketDataProvider.getHistory misslyckades för ${symbol}`, error);
      return [];
    }
  }

  async getFundamentals(symbol: string): Promise<FundamentalSnapshot> {
    const normalized = this.normalizeSymbol(symbol);
    const now = Date.now();
    const cached = this.fundamentalCache.get(normalized);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    try {
      const persisted = await this.persistence.get<FundamentalSnapshot>(
        this.fundamentalsCacheKey(normalized)
      );
      if (persisted && persisted.expires > now) {
        this.fundamentalCache.set(normalized, persisted);
        return persisted.value;
      }

      const response = await this.fetchJson<MassiveFinancialsResponse>(
        `v2/reference/financials/${normalized}`,
        { limit: 1 },
        MassiveFinancialsResponseSchema
      );
      const record = response.results?.[0] ?? null;
      const metrics = record?.metrics ?? {};
      const ratios = record?.ratios ?? {};

      const snapshot: FundamentalSnapshot = {
        pe: coerceNumber((metrics as Record<string, unknown>).pe_ratio ?? ratios['pe_ratio']),
        ps: coerceNumber((metrics as Record<string, unknown>).price_to_sales_ratio),
        roe: coerceNumber((metrics as Record<string, unknown>).return_on_equity ?? ratios['return_on_equity']),
        debtToEquity: coerceNumber((metrics as Record<string, unknown>).debt_to_equity ?? ratios['debt_to_equity']),
        growth5y: coerceNumber(
          (metrics as Record<string, unknown>).revenue_growth_five_year ?? ratios['revenue_growth_five_year']
        ),
        profitMargin: coerceNumber(
          (metrics as Record<string, unknown>).net_profit_margin ?? ratios['net_margin']
        ),
        beta: coerceNumber((metrics as Record<string, unknown>).beta ?? ratios['beta']),
        dividendYield: coerceNumber(
          (metrics as Record<string, unknown>).dividend_yield ?? ratios['dividend_yield']
        )
      };

      this.fundamentalCache.set(normalized, {
        value: snapshot,
        expires: now + this.eodTtl
      });
      await this.persistence.set(this.fundamentalsCacheKey(normalized), snapshot, this.eodTtl);

      return snapshot;
    } catch (error) {
      console.warn(`MassiveMarketDataProvider.getFundamentals misslyckades för ${symbol}`, error);
      const empty: FundamentalSnapshot = {
        pe: 0,
        ps: 0,
        roe: 0,
        debtToEquity: 0,
        growth5y: 0,
        profitMargin: 0,
        beta: 0,
        dividendYield: 0
      };
      this.fundamentalCache.set(normalized, {
        value: empty,
        expires: now + this.eodTtl
      });
      await this.persistence.set(this.fundamentalsCacheKey(normalized), empty, this.eodTtl);
      return empty;
    }
  }

  async searchTicker(query: string): Promise<StockQuote[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.getQuotes();
    }

    try {
      const response = await this.fetchJson<MassiveTickerListResponse>('v3/reference/tickers', {
        search: trimmed,
        market: this.market,
        active: 'true',
        order: 'asc',
        sort: 'ticker',
        limit: 10
      }, MassiveTickerListSchema);
      const results = response.results ?? [];
      const symbols = results.map((item) => {
        this.storeMetadata(item);
        return this.normalizeSymbol(item.ticker);
      });

      if (symbols.length === 0) {
        return [];
      }

      const snapshots = await this.fetchSnapshotsForSymbols(symbols);
      const mapped = await Promise.all(
        symbols.map(async (symbol) => {
          const snapshot = snapshots.get(symbol);
          if (snapshot) {
            const quote = this.snapshotToQuote(snapshot);
            await this.storeQuote(symbol, quote);
            return quote;
          }
          const meta = this.metadata.get(symbol);
          return {
            symbol,
            name: meta?.name ?? symbol,
            sector: meta?.type ?? 'Okänd',
            price: 0,
            changePct: 0,
            volume: 0,
            currency: meta?.currency ?? 'USD',
            market: meta?.market
          };
        })
      );

      return mapped;
    } catch (error) {
      console.warn(`MassiveMarketDataProvider.searchTicker misslyckades för "${trimmed}"`, error);
      return [];
    }
  }

  async getMarketSummary(): Promise<MarketSummary> {
    try {
      const quotes = await this.getQuotes();
      const movers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
      return {
        updatedAt: DateTime.now().toISO(),
        headline: `Starkast utveckling ${DateTime.now().toFormat('dd MMM yyyy')}`,
        movers
      };
    } catch (error) {
      console.warn('MassiveMarketDataProvider.getMarketSummary misslyckades', error);
      return {
        updatedAt: DateTime.now().toISO(),
        headline: `Ingen data tillgänglig ${DateTime.now().toFormat('dd MMM yyyy')}`,
        movers: []
      };
    }
  }

  private async resolveDefaultSymbols(): Promise<string[]> {
    const now = Date.now();
    if (this.symbolUniverseCache && this.symbolUniverseCache.expires > now) {
      return this.symbolUniverseCache.value.slice(0, this.symbolLimit);
    }

    const collected: MassiveTickerReference[] = [];
    let nextUrl: string | null = 'v3/reference/tickers';
    let params: Record<string, string | number> | undefined = {
      market: this.market,
      active: 'true',
      order: 'asc',
      sort: 'ticker',
      limit: Math.min(this.symbolLimit, 100)
    };

    const cachedUniverse = await this.persistence.get<string[]>(this.universeCacheKey());
    if (cachedUniverse && cachedUniverse.expires > now) {
      this.symbolUniverseCache = {
        value: cachedUniverse.value,
        expires: cachedUniverse.expires
      };
      return cachedUniverse.value.slice(0, this.symbolLimit);
    }

    while (collected.length < this.symbolLimit && nextUrl) {
      const response = await this.fetchJson<MassiveTickerListResponse>(
        nextUrl,
        params,
        MassiveTickerListSchema
      );
      const batch = response.results ?? [];
      batch.forEach((item) => this.storeMetadata(item));
      collected.push(...batch);
      if (response.next_url) {
        nextUrl = response.next_url;
        params = undefined;
      } else {
        nextUrl = null;
      }
    }

    const symbols = collected
      .map((item) => this.normalizeSymbol(item.ticker))
      .slice(0, this.symbolLimit);

    if (symbols.length > 0) {
      this.symbolUniverseCache = {
        value: symbols,
        expires: now + this.eodTtl
      };
    }

    if (symbols.length === 0) {
      console.warn('MassiveMarketDataProvider.resolveDefaultSymbols returnerade inga symboler.');
    }

    await this.persistence.set(this.universeCacheKey(), symbols, this.eodTtl);

    return symbols;
  }

  private async fetchSnapshotsForSymbols(symbols: string[]): Promise<Map<string, MassiveSnapshotTicker>> {
    const result = new Map<string, MassiveSnapshotTicker>();
    const chunkSize = 50;

    for (let index = 0; index < symbols.length; index += chunkSize) {
      const chunk = symbols.slice(index, index + chunkSize);
      const response = await this.fetchJson<MassiveSnapshotResponse>(
        `v2/snapshot/locale/${this.locale}/markets/${this.market}/tickers`,
        {
          tickers: chunk.join(','),
          limit: chunk.length
        },
        MassiveSnapshotResponseSchema
      );
      (response.tickers ?? []).forEach((ticker) => {
        const normalized = this.normalizeSymbol(ticker.ticker);
        result.set(normalized, ticker);
        this.storeMetadataFromSnapshot(ticker);
      });
    }

    return result;
  }

  private storeMetadata(reference: MassiveTickerReference): void {
    if (!reference.ticker) {
      return;
    }
    const symbol = this.normalizeSymbol(reference.ticker);
    if (!this.metadata.has(symbol)) {
      this.metadata.set(symbol, {
        name: reference.name ?? symbol,
        market: reference.primary_exchange ?? reference.market,
        currency: (reference.currency_name ?? 'USD').toUpperCase(),
        type: reference.type ?? reference.sector ?? 'Okänd'
      });
    } else {
      const existing = this.metadata.get(symbol)!;
      this.metadata.set(symbol, {
        name: reference.name ?? existing.name,
        market: reference.primary_exchange ?? reference.market ?? existing.market,
        currency: (reference.currency_name ?? existing.currency ?? 'USD').toUpperCase(),
        type: reference.type ?? reference.sector ?? existing.type
      });
    }
  }

  private storeMetadataFromSnapshot(snapshot: MassiveSnapshotTicker): void {
    const symbol = this.normalizeSymbol(snapshot.ticker);
    if (!this.metadata.has(symbol)) {
      this.metadata.set(symbol, {
        name: symbol,
        market: this.market,
        currency: 'USD',
        type: 'Okänd'
      });
    }
  }

  private snapshotToQuote(snapshot: MassiveSnapshotTicker): StockQuote {
    const symbol = this.normalizeSymbol(snapshot.ticker);
    const metadata = this.metadata.get(symbol);
    const price = coerceNumber(
      snapshot.lastTrade?.p ?? snapshot.day?.c ?? snapshot.prevDay?.c ?? 0
    );
    const changePctRaw = coerceNumber(snapshot.todaysChangePerc ?? 0);
    const volume = coerceNumber(snapshot.day?.v ?? snapshot.prevDay?.v ?? 0);
    return {
      symbol,
      name: metadata?.name ?? symbol,
      sector: metadata?.type ?? 'Okänd',
      price,
      changePct: Number(changePctRaw.toFixed(2)),
      volume: Math.round(volume),
      currency: metadata?.currency ?? 'USD',
      market: metadata?.market
    };
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  private resolveRange(period: string): { from: string; to: string } {
    const end = DateTime.now().startOf('day');
    const start = (() => {
      switch (period) {
        case '1m':
          return end.minus({ months: 1 });
        case '3m':
          return end.minus({ months: 3 });
        case '6m':
          return end.minus({ months: 6 });
        case '3y':
          return end.minus({ years: 3 });
        case '5y':
          return end.minus({ years: 5 });
        case 'max':
          return end.minus({ years: 15 });
        case '1y':
        default:
          return end.minus({ years: 1 });
      }
    })();

    return {
      from: start.toISODate() ?? '',
      to: end.toISODate() ?? ''
    };
  }

  private async fetchJson<T>(
    pathOrUrl: string,
    params: Record<string, string | number> | undefined,
    schema: z.ZodSchema<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await this.rateLimiter.schedule(async () => {
        const url = this.buildUrl(pathOrUrl);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              url.searchParams.set(key, String(value));
            }
          });
        }
        if (this.apiKey && !url.searchParams.has('apiKey')) {
          url.searchParams.set('apiKey', this.apiKey);
        }

        const response = await this.fetchImpl(url.toString());
        if (response.status === 429 || response.status === 503) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterMs = retryAfterHeader
            ? Number.parseFloat(retryAfterHeader) * 1000
            : this.backoffDelay(attempt);
          throw new RateLimitError(Number.isFinite(retryAfterMs) ? retryAfterMs : this.backoffDelay(attempt));
        }

        if (!response.ok) {
          const message = await response.text();
          throw new Error(
            `Massive request failed: ${response.status} ${response.statusText} - ${message}`
          );
        }

        const payload = (await response.json()) as unknown;
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          throw new Error(`Massive response validation misslyckades: ${parsed.error.message}`);
        }
        return parsed.data;
      });
    } catch (error) {
      if (error instanceof RateLimitError && attempt < this.maxRetries) {
        await delay(error.retryAfterMs);
        return this.fetchJson(pathOrUrl, params, schema, attempt + 1);
      }

      if (error instanceof TypeError && attempt < this.maxRetries) {
        await delay(this.backoffDelay(attempt));
        return this.fetchJson(pathOrUrl, params, schema, attempt + 1);
      }

      throw error;
    }
  }

  private buildUrl(pathOrUrl: string): URL {
    try {
      return new URL(pathOrUrl);
    } catch {
      const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
      return new URL(`${this.baseUrl}${normalizedPath}`);
    }
  }

  private backoffDelay(attempt: number): number {
    return BACKOFF_BASE_MS * 2 ** (attempt - 1);
  }

  private quoteCacheKey(symbol: string): string {
    return `quote:${symbol}`;
  }

  private historyCacheKey(symbol: string, period: string): string {
    return `history:${symbol}:${period}`;
  }

  private fundamentalsCacheKey(symbol: string): string {
    return `fundamentals:${symbol}`;
  }

  private universeCacheKey(): string {
    return 'universe:all';
  }

  private async storeQuote(symbol: string, quote: StockQuote): Promise<void> {
    const expires = Date.now() + this.intradayTtl;
    this.quoteCache.set(symbol, { value: quote, expires });
    await this.persistence.set(this.quoteCacheKey(symbol), quote, this.intradayTtl);
  }
}

const envApiKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FINNHUB_API_KEY : undefined;
const envApiBaseUrl =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_MARKET_API_BASE_URL : undefined;

export const createMarketDataProvider = (
  apiKey: string | undefined = envApiKey,
  options: {
    symbolLimit?: number;
    apiBaseUrl?: string;
  } = {}
): MarketDataProvider => {
  const explicitBaseUrl = options.apiBaseUrl?.trim() || envApiBaseUrl?.trim() || '';
  const normalizedBaseUrl = explicitBaseUrl || '';
  const baseHost = (() => {
    try {
      return normalizedBaseUrl ? new URL(normalizedBaseUrl).hostname : '';
    } catch {
      return '';
    }
  })();

  const wantsMassive =
    normalizedBaseUrl.length > 0 && /(massive|polygon)/i.test(baseHost);
  const wantsFinnhub =
    normalizedBaseUrl.length === 0 ||
    baseHost.includes('finnhub') ||
    (!wantsMassive && normalizedBaseUrl.length === 0);

  if (wantsMassive && apiKey) {
    try {
      return new MassiveMarketDataProvider(apiKey, {
        baseUrl: normalizedBaseUrl || DEFAULT_MARKET_API_BASE_URL,
        symbolLimit: options.symbolLimit
      });
    } catch (error) {
      console.error(
        'Kunde inte initiera MassiveMarketDataProvider, försöker Finnhub innan mock-data',
        error
      );
    }
  }

  if (wantsFinnhub && apiKey) {
    try {
      return new FinnhubMarketDataProvider(apiKey, {
        symbolLimit: options.symbolLimit,
        baseUrl: normalizedBaseUrl && !wantsMassive ? normalizedBaseUrl : undefined
      });
    } catch (error) {
      console.error('Kunde inte initiera FinnhubMarketDataProvider, faller tillbaka till mock-data', error);
    }
  }

  return new EmptyMarketDataProvider();
};

export const marketDataProvider = createMarketDataProvider();
