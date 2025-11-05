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

export const marketDataProvider = new MockMarketDataProvider();
