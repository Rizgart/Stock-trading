import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildRecommendations, type StockRecommendation } from '../analysis/ranking';
import {
  marketDataProvider,
  type MarketSummary,
  type StockQuote,
  type MarketDataProvider
} from '../services/marketData';

export type RiskProfile = 'konservativ' | 'balanserad' | 'aggressiv';

export interface WatchlistEntry {
  symbol: string;
  alertAbove?: number;
  alertBelow?: number;
}

interface AppState {
  loading: boolean;
  quotes: StockQuote[];
  recommendations: StockRecommendation[];
  summary: MarketSummary | null;
  watchlist: WatchlistEntry[];
  riskProfile: RiskProfile;
  sectors: string[];
  toggleWatchlist: (symbol: string) => void;
  updateRiskProfile: (profile: RiskProfile) => void;
  setSectors: React.Dispatch<React.SetStateAction<string[]>>;
}

const AppDataContext = createContext<AppState | undefined>(undefined);

interface Props {
  provider?: MarketDataProvider;
  children: React.ReactNode;
}

const riskProfileScoreMap: Record<RiskProfile, { minScore: number; maxVolatility: number }> = {
  konservativ: { minScore: 70, maxVolatility: 4 },
  balanserad: { minScore: 60, maxVolatility: 6 },
  aggressiv: { minScore: 55, maxVolatility: 10 }
};

export const AppDataProvider: React.FC<Props> = ({ children, provider = marketDataProvider }) => {
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>([]);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([
    { symbol: 'ERIC', alertBelow: 60 },
    { symbol: 'VOLV-B.ST', alertBelow: 230 }
  ]);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanserad');
  const [sectors, setSectors] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const newQuotes = await provider.getQuotes();
        const summaryData = await provider.getMarketSummary();
        const inputs = await Promise.all(
          newQuotes.map(async (quote) => ({
            quote,
            history: await provider.getHistory(quote.symbol, '1y'),
            fundamentals: await provider.getFundamentals(quote.symbol)
          }))
        );
        setQuotes(newQuotes);
        setSummary(summaryData);
        const { minScore, maxVolatility } = riskProfileScoreMap[riskProfile];
        const computed = buildRecommendations(inputs, {
          sectors: sectors.length > 0 ? sectors : undefined,
          minScore,
          maxVolatility
        });
        setRecommendations(computed);
      } catch (error) {
        console.error('Kunde inte hämta marknadsdata', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [provider, riskProfile, sectors]);

  const toggleWatchlist = (symbol: string) => {
    setWatchlist((current) => {
      const exists = current.find((entry) => entry.symbol === symbol);
      if (exists) {
        return current.filter((entry) => entry.symbol !== symbol);
      }
      return [...current, { symbol }];
    });
  };

  const value = useMemo<AppState>(
    () => ({
      loading,
      quotes,
      recommendations,
      summary,
      watchlist,
      riskProfile,
      sectors,
      toggleWatchlist,
      updateRiskProfile: setRiskProfile,
      setSectors
    }),
    [loading, quotes, recommendations, summary, watchlist, riskProfile, sectors]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = (): AppState => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
};
