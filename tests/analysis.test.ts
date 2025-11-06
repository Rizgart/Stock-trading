import { describe, expect, it } from 'vitest';
import { buildRecommendations } from '../src/analysis/ranking';
import type { FundamentalSnapshot, HistoricalCandle, StockQuote } from '../src/services/marketData';

const generateHistory = (basePrice: number): HistoricalCandle[] => {
  const days = 260;
  const now = Date.now();
  return Array.from({ length: days }, (_, index) => {
    const timestamp = new Date(now - (days - index) * 24 * 60 * 60 * 1000).toISOString();
    const close = basePrice + index * 0.5;
    return {
      timestamp,
      open: close - 1,
      high: close + 1,
      low: close - 2,
      close,
      volume: 100_000 + index * 100
    };
  });
};

const sampleQuotes: StockQuote[] = [
  {
    symbol: 'AAA',
    name: 'Alpha AB',
    sector: 'Teknik',
    price: 120,
    changePct: 1.2,
    volume: 500_000,
    currency: 'SEK'
  },
  {
    symbol: 'BBB',
    name: 'Beta Bolaget',
    sector: 'Industri',
    price: 85,
    changePct: -0.4,
    volume: 350_000,
    currency: 'SEK'
  },
  {
    symbol: 'CCC',
    name: 'Gamma Group',
    sector: 'Finans',
    price: 210,
    changePct: 0.8,
    volume: 410_000,
    currency: 'USD'
  }
];

const sampleHistory: Record<string, HistoricalCandle[]> = {
  AAA: generateHistory(100),
  BBB: generateHistory(60),
  CCC: generateHistory(180)
};

const sampleFundamentals: Record<string, FundamentalSnapshot> = {
  AAA: {
    pe: 18,
    ps: 4.5,
    roe: 22,
    debtToEquity: 0.4,
    growth5y: 15,
    profitMargin: 16,
    beta: 0.9,
    dividendYield: 2.1
  },
  BBB: {
    pe: 12,
    ps: 1.2,
    roe: 14,
    debtToEquity: 0.7,
    growth5y: 8,
    profitMargin: 9,
    beta: 1.2,
    dividendYield: 3.4
  },
  CCC: {
    pe: 24,
    ps: 5.1,
    roe: 28,
    debtToEquity: 0.3,
    growth5y: 20,
    profitMargin: 18,
    beta: 1.1,
    dividendYield: 1.5
  }
};

const mockInputs = sampleQuotes.map((quote) => ({
  quote,
  fundamentals: sampleFundamentals[quote.symbol],
  history: sampleHistory[quote.symbol]
}));

describe('buildRecommendations', () => {
  it('returns recommendations sorted by score', () => {
    const result = buildRecommendations(mockInputs);
    expect(result).toHaveLength(sampleQuotes.length);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('applies min score filter', () => {
    const result = buildRecommendations(mockInputs, { minScore: 80 });
    expect(result.every((item) => item.score >= 80)).toBe(true);
  });
});
