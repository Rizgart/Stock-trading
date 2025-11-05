import { DateTime } from 'luxon';
import type { FundamentalSnapshot, HistoricalCandle, StockQuote } from '../services/marketData';

export const sampleQuotes: StockQuote[] = [
  {
    symbol: 'EVO',
    name: 'Evolution AB',
    sector: 'Spel & underhållning',
    price: 1385,
    changePct: 1.8,
    volume: 820000,
    currency: 'SEK',
    market: 'OMX Stockholm'
  },
  {
    symbol: 'VOLV B',
    name: 'Volvo AB B',
    sector: 'Industri',
    price: 255.4,
    changePct: 0.9,
    volume: 2200000,
    currency: 'SEK',
    market: 'OMX Stockholm'
  },
  {
    symbol: 'SAND',
    name: 'Sandvik AB',
    sector: 'Industri',
    price: 223.6,
    changePct: -0.4,
    volume: 1750000,
    currency: 'SEK',
    market: 'OMX Stockholm'
  },
  {
    symbol: 'ATCO A',
    name: 'Atlas Copco A',
    sector: 'Industri',
    price: 144.8,
    changePct: 1.1,
    volume: 1950000,
    currency: 'SEK',
    market: 'OMX Stockholm'
  },
  {
    symbol: 'INVE B',
    name: 'Investor B',
    sector: 'Finans',
    price: 210.2,
    changePct: 0.6,
    volume: 1120000,
    currency: 'SEK',
    market: 'OMX Stockholm'
  },
  {
    symbol: 'SINCH',
    name: 'Sinch AB',
    sector: 'Telekom',
    price: 27.5,
    changePct: -1.2,
    volume: 3100000,
    currency: 'SEK',
    market: 'OMX Stockholm'
  }
];

const generateHistory = (symbol: string): HistoricalCandle[] => {
  const start = DateTime.now().minus({ years: 5 });
  const candles: HistoricalCandle[] = [];
  let price = sampleQuotes.find((quote) => quote.symbol === symbol)?.price ?? 100;
  for (let i = 0; i < 5 * 252; i += 1) {
    price += (Math.random() - 0.45) * (price * 0.01);
    const close = Math.max(price, 1);
    candles.push({
      timestamp: start.plus({ days: i }).toISODate()!,
      open: close * (0.98 + Math.random() * 0.04),
      high: close * (1 + Math.random() * 0.02),
      low: close * (0.96 + Math.random() * 0.04),
      close,
      volume: Math.round(100000 + Math.random() * 50000)
    });
  }
  return candles;
};

export const sampleHistory: Record<string, HistoricalCandle[]> = Object.fromEntries(
  sampleQuotes.map((quote) => [quote.symbol, generateHistory(quote.symbol)])
);

export const sampleFundamentals: Record<string, FundamentalSnapshot> = {
  EVO: {
    pe: 21.5,
    ps: 9.1,
    roe: 33.4,
    debtToEquity: 0.32,
    growth5y: 26.8,
    profitMargin: 52.4,
    beta: 1.2,
    dividendYield: 1.1
  },
  'VOLV B': {
    pe: 12.4,
    ps: 1.1,
    roe: 22.1,
    debtToEquity: 0.58,
    growth5y: 9.5,
    profitMargin: 11.2,
    beta: 1.0,
    dividendYield: 3.9
  },
  SAND: {
    pe: 15.8,
    ps: 1.7,
    roe: 19.5,
    debtToEquity: 0.71,
    growth5y: 7.6,
    profitMargin: 14.5,
    beta: 1.05,
    dividendYield: 2.9
  },
  'ATCO A': {
    pe: 24.2,
    ps: 4.1,
    roe: 27.9,
    debtToEquity: 0.45,
    growth5y: 13.2,
    profitMargin: 16.8,
    beta: 0.95,
    dividendYield: 2.1
  },
  'INVE B': {
    pe: 18.3,
    ps: 2.4,
    roe: 13.9,
    debtToEquity: 0.31,
    growth5y: 8.9,
    profitMargin: 12.5,
    beta: 0.85,
    dividendYield: 2.8
  },
  SINCH: {
    pe: 35.1,
    ps: 3.3,
    roe: 7.4,
    debtToEquity: 0.88,
    growth5y: 41.2,
    profitMargin: 6.2,
    beta: 1.45,
    dividendYield: 0.0
  }
};
