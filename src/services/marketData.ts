import { DateTime } from 'luxon';
import { sampleQuotes, sampleHistory, sampleFundamentals } from '../data/sampleStocks';

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
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'ERIC', 'VOLV-B.ST'];
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export class MockMarketDataProvider implements MarketDataProvider {
  private quoteCache: CacheEntry<StockQuote[]> | null = null;
  private fundamentalCache: Map<string, CacheEntry<FundamentalSnapshot>> = new Map();
  private historyCache: Map<string, CacheEntry<HistoricalCandle[]>> = new Map();

  async getQuotes(symbols?: string[]): Promise<StockQuote[]> {
    const now = Date.now();
    if (this.quoteCache && this.quoteCache.expires > now) {
      const data = this.quoteCache.value;
      return symbols ? data.filter((quote) => symbols.includes(quote.symbol)) : data;
    }

    const data = sampleQuotes.map((quote) => ({
      ...quote,
      changePct: this.randomizeChange(quote.changePct)
    }));

    this.quoteCache = {
      value: data,
      expires: now + DEFAULT_INTRADAY_TTL
    };

    return symbols ? data.filter((quote) => symbols.includes(quote.symbol)) : data;
  }

  async getHistory(symbol: string, period: string = '1y'): Promise<HistoricalCandle[]> {
    const key = `${symbol}-${period}`;
    const now = Date.now();
    const cached = this.historyCache.get(key);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    const history = sampleHistory[symbol];
    if (!history) {
      return [];
    }

    const filtered = this.filterByPeriod(history, period);

    this.historyCache.set(key, {
      value: filtered,
      expires: now + DEFAULT_EOD_TTL
    });

    return filtered;
  }

  async getFundamentals(symbol: string): Promise<FundamentalSnapshot> {
    const now = Date.now();
    const cached = this.fundamentalCache.get(symbol);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    const fundamentals = sampleFundamentals[symbol];
    if (!fundamentals) {
      throw new Error(`No fundamentals found for ${symbol}`);
    }

    this.fundamentalCache.set(symbol, {
      value: fundamentals,
      expires: now + DEFAULT_EOD_TTL
    });

    return fundamentals;
  }

  async searchTicker(query: string): Promise<StockQuote[]> {
    const normalized = query.trim().toLowerCase();
    const quotes = await this.getQuotes();
    return quotes.filter(
      (quote) =>
        quote.symbol.toLowerCase().includes(normalized) ||
        quote.name.toLowerCase().includes(normalized)
    );
  }

  async getMarketSummary(): Promise<MarketSummary> {
    const quotes = await this.getQuotes();
    const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
    const topMovers = sorted.slice(0, 3);
    const timestamp = DateTime.now().toISO();
    return {
      updatedAt: timestamp,
      headline: `Starkast utveckling ${DateTime.now().toFormat('dd MMM yyyy')}`,
      movers: topMovers
    };
  }

  private randomizeChange(change: number): number {
    const noise = (Math.random() - 0.5) * 0.4;
    return Number((change + noise).toFixed(2));
  }

  private filterByPeriod(history: HistoricalCandle[], period: string): HistoricalCandle[] {
    if (period === 'max') {
      return history;
    }

    const now = DateTime.now();
    const start = (() => {
      switch (period) {
        case '1m':
          return now.minus({ months: 1 });
        case '3m':
          return now.minus({ months: 3 });
        case '6m':
          return now.minus({ months: 6 });
        case '1y':
          return now.minus({ years: 1 });
        case '3y':
          return now.minus({ years: 3 });
        case '5y':
          return now.minus({ years: 5 });
        default:
          return now.minus({ years: 1 });
      }
    })();

    return history.filter((candle) => DateTime.fromISO(candle.timestamp) >= start);
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

  private readonly fallbackProvider = new MockMarketDataProvider();

  constructor(
    private readonly apiKey: string,
    options: {
      intradayTtlMs?: number;
      eodTtlMs?: number;
      defaultSymbols?: string[];
      exchanges?: string[];
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
  }

  private readonly fetchImpl: typeof fetch;

  async getQuotes(symbols?: string[]): Promise<StockQuote[]> {
    const now = Date.now();
    const targetSymbols = (
      symbols?.length ? symbols : await this.resolveDefaultSymbols()
    ).map((symbol) => symbol.toUpperCase());
    const uniqueSymbols = Array.from(new Set(targetSymbols));
    const quotes: StockQuote[] = [];

    for (const symbol of uniqueSymbols) {
      const cached = this.quoteCache.get(symbol);
      if (cached && cached.expires > now) {
        quotes.push(cached.value);
        continue;
      }

      try {
        const [quoteResponse, profile] = await Promise.all([
          this.fetchJson<FinnhubQuoteResponse>('quote', { symbol }),
          this.getProfile(symbol)
        ]);

        const stockQuote: StockQuote = {
          symbol,
          name: profile?.name ?? this.symbolMetadata.get(symbol)?.description ?? symbol,
          sector: profile?.finnhubIndustry ?? 'Okänd',
          price: quoteResponse.c ?? 0,
          changePct: Number((quoteResponse.dp ?? 0).toFixed(2)),
          volume: 0,
          currency: profile?.currency ?? this.symbolMetadata.get(symbol)?.currency ?? 'USD',
          market: profile?.exchange
        };

        this.quoteCache.set(symbol, {
          value: stockQuote,
          expires: now + this.intradayTtl
        });

        quotes.push(stockQuote);
      } catch (error) {
        console.warn(`Finnhub quote lookup failed for ${symbol}`, error);
        const fallback = await this.fallbackProvider.getQuotes([symbol]);
        if (fallback.length > 0) {
          quotes.push(fallback[0]);
        }
      }
    }

    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
    return targetSymbols
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
    const url = new URL(`${FINNHUB_BASE_URL}/${endpoint}`);
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

    return uniqueSymbols;
  }
}

const envApiKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FINNHUB_API_KEY : undefined;

export const createMarketDataProvider = (apiKey: string | undefined = envApiKey): MarketDataProvider => {
  if (apiKey) {
    try {
      return new FinnhubMarketDataProvider(apiKey);
    } catch (error) {
      console.error('Kunde inte initiera FinnhubMarketDataProvider, faller tillbaka till mock-data', error);
    }
  }

  return new MockMarketDataProvider();
};

export const marketDataProvider = createMarketDataProvider();
