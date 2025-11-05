import { describe, expect, it } from 'vitest';
import { buildRecommendations } from '../src/analysis/ranking';
import { sampleFundamentals, sampleHistory, sampleQuotes } from '../src/data/sampleStocks';

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
