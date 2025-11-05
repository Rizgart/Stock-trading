import type {
  FundamentalSnapshot,
  HistoricalCandle,
  StockQuote
} from '../services/marketData';
import { atr, movingAverage, rsi } from './indicators';

export type RecommendationSignal = 'Köp' | 'Behåll' | 'Sälj';

export interface StockRecommendation {
  symbol: string;
  name: string;
  score: number;
  signal: RecommendationSignal;
  price: number;
  changePct: number;
  sector: string;
  factors: string[];
}

interface RankingInputs {
  quote: StockQuote;
  history: HistoricalCandle[];
  fundamentals: FundamentalSnapshot;
}

const weightings = {
  technical: 0.45,
  fundamental: 0.4,
  risk: 0.15
};

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const technicalScore = (history: HistoricalCandle[]): { score: number; factors: string[] } => {
  const closes = history.map((candle) => candle.close);
  const ma20 = movingAverage(closes, 20);
  const ma50 = movingAverage(closes, 50);
  const ma200 = movingAverage(closes, 200);
  const rsiValues = rsi(closes);
  const last = closes[closes.length - 1];
  const ma20Last = ma20[ma20.length - 1];
  const ma50Last = ma50[ma50.length - 1];
  const ma200Last = ma200[ma200.length - 1];
  const rsiLast = rsiValues[rsiValues.length - 1];

  let score = 50;
  const reasons: string[] = [];

  if (!Number.isNaN(ma20Last) && last > ma20Last) {
    score += 10;
    reasons.push('Pris över MA20');
  }
  if (!Number.isNaN(ma50Last) && last > ma50Last) {
    score += 15;
    reasons.push('Pris över MA50');
  }
  if (!Number.isNaN(ma200Last) && last > ma200Last) {
    score += 20;
    reasons.push('Pris över MA200');
  }
  if (!Number.isNaN(rsiLast)) {
    if (rsiLast > 70) {
      score -= 15;
      reasons.push('RSI över 70 (överköpt)');
    } else if (rsiLast < 30) {
      score += 10;
      reasons.push('RSI under 30 (översåld)');
    }
  }

  return { score: clamp(score), factors: reasons };
};

const fundamentalScore = (
  fundamentals: FundamentalSnapshot,
  sectorMedian: Partial<FundamentalSnapshot>
): { score: number; factors: string[] } => {
  let score = 50;
  const factors: string[] = [];

  if (fundamentals.pe < (sectorMedian.pe ?? fundamentals.pe * 1.2)) {
    score += 10;
    factors.push('P/E under sektorsnitt');
  }
  if (fundamentals.roe > (sectorMedian.roe ?? 15)) {
    score += 15;
    factors.push('ROE över 15%');
  }
  if (fundamentals.growth5y > 10) {
    score += 10;
    factors.push('Tillväxt >10% (5y)');
  }
  if (fundamentals.profitMargin > 15) {
    score += 10;
    factors.push('Stark marginal');
  }
  if (fundamentals.dividendYield >= 3) {
    score += 5;
    factors.push('Utdelningsyield ≥3%');
  }
  if (fundamentals.debtToEquity > 0.8) {
    score -= 10;
    factors.push('Hög skuldsättning');
  }
  return { score: clamp(score), factors };
};

const riskScore = (
  history: HistoricalCandle[],
  fundamentals: FundamentalSnapshot
): { score: number; factors: string[] } => {
  const atrValues = atr(history);
  const lastAtr = atrValues[atrValues.length - 1];
  const lastClose = history[history.length - 1]?.close ?? 0;
  const atrPct = lastClose ? (lastAtr / lastClose) * 100 : 0;
  let score = 50;
  const factors: string[] = [];

  if (atrPct < 2.5) {
    score += 15;
    factors.push('Låg volatilitet');
  } else if (atrPct > 5) {
    score -= 10;
    factors.push('Hög volatilitet');
  }

  if (fundamentals.beta < 1) {
    score += 10;
    factors.push('Beta < 1');
  } else if (fundamentals.beta > 1.3) {
    score -= 10;
    factors.push('Beta > 1.3');
  }

  return { score: clamp(score), factors };
};

const toSignal = (score: number): RecommendationSignal => {
  if (score >= 70) return 'Köp';
  if (score <= 45) return 'Sälj';
  return 'Behåll';
};

export interface RankingOptions {
  sectors?: string[];
  minScore?: number;
  maxVolatility?: number;
}

export const buildRecommendations = (
  inputs: RankingInputs[],
  options: RankingOptions = {}
): StockRecommendation[] => {
  const sectorGroups = groupBy(inputs, (input) => input.quote.sector);
  const recommendations = inputs.map((input) => {
    const sectorMedian = computeSectorMedian(sectorGroups[input.quote.sector]);
    const technical = technicalScore(input.history);
    const fundamental = fundamentalScore(input.fundamentals, sectorMedian);
    const risk = riskScore(input.history, input.fundamentals);

    const composite =
      technical.score * weightings.technical +
      fundamental.score * weightings.fundamental +
      risk.score * weightings.risk;

    const factors = [...technical.factors, ...fundamental.factors, ...risk.factors]
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    return {
      symbol: input.quote.symbol,
      name: input.quote.name,
      score: Math.round(composite),
      signal: toSignal(composite),
      price: input.quote.price,
      changePct: input.quote.changePct,
      sector: input.quote.sector,
      factors
    } satisfies StockRecommendation;
  });

  return recommendations
    .filter((recommendation) => {
      if (options.sectors && options.sectors.length > 0) {
        return options.sectors.includes(recommendation.sector);
      }
      return true;
    })
    .filter((recommendation) =>
      options.minScore ? recommendation.score >= options.minScore : true
    )
    .filter((recommendation) =>
      options.maxVolatility
        ? recommendation.factors.every((factor) => factor !== 'Hög volatilitet')
        : true
    )
    .sort((a, b) => b.score - a.score);
};

const computeSectorMedian = (group: RankingInputs[]): Partial<FundamentalSnapshot> => {
  if (!group || group.length === 0) {
    return {};
  }
  const sortedPe = [...group].map((g) => g.fundamentals.pe).sort((a, b) => a - b);
  const sortedRoe = [...group].map((g) => g.fundamentals.roe).sort((a, b) => a - b);
  const middle = Math.floor(sortedPe.length / 2);
  return {
    pe: sortedPe[middle],
    roe: sortedRoe[middle]
  };
};

const groupBy = <T, K extends string | number | symbol>(
  array: T[],
  keyGetter: (item: T) => K
): Record<K, T[]> => {
  return array.reduce((acc, item) => {
    const key = keyGetter(item);
    if (!acc[key]) {
      acc[key] = [] as T[];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
};
