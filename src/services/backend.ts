import type { RiskProfile } from '../analysis/ranking';
import type { StockRecommendation } from '../analysis/ranking';

export interface RankingResponse {
  symbol: string;
  price: number;
  change_pct: number;
  score: number;
  signal: string;
  factors: string[];
  profile: RiskProfile;
}

export interface BacktestResponse {
  profile: RiskProfile;
  period: string;
  symbols: Array<{
    symbol: string;
    cagr: number;
    sharpe: number;
    max_drawdown: number;
  }>;
  equity_curve: Array<{ timestamp: string; value: number }>;
  metrics: Record<string, number>;
}

const buildHeaders = (apiKey?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
};

export const fetchRankings = async (params: {
  baseUrl: string;
  apiKey?: string;
  symbols?: string[];
  profile: RiskProfile;
  limit: number;
}): Promise<RankingResponse[]> => {
  const url = new URL(`${params.baseUrl}/v1/rankings`);
  if (params.symbols?.length) {
    url.searchParams.set('symbols', params.symbols.join(','));
  }
  url.searchParams.set('profile', params.profile);
  url.searchParams.set('limit', String(params.limit));

  const response = await fetch(url.toString(), {
    headers: buildHeaders(params.apiKey)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch rankings: ${response.statusText}`);
  }
  return (await response.json()) as RankingResponse[];
};

export const runBacktest = async (params: {
  baseUrl: string;
  apiKey?: string;
  symbols: string[];
  period: string;
  profile: RiskProfile;
}): Promise<BacktestResponse> => {
  const response = await fetch(`${params.baseUrl}/v1/backtests`, {
    method: 'POST',
    headers: buildHeaders(params.apiKey),
    body: JSON.stringify({
      symbols: params.symbols,
      period: params.period,
      profile: params.profile
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to run backtest: ${response.statusText}`);
  }
  return (await response.json()) as BacktestResponse;
};
