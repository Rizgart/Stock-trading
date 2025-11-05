import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { buildRecommendations, type StockRecommendation } from '../analysis/ranking';
import {
  createMarketDataProvider,
  type MarketSummary,
  type StockQuote,
  type MarketDataProvider,
  MockMarketDataProvider,
  type HistoricalCandle,
  type FundamentalSnapshot
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
  apiKey: string;
  toggleWatchlist: (symbol: string) => void;
  updateRiskProfile: (profile: RiskProfile) => void;
  updateApiKey: (apiKey: string) => void;
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

type QuoteLoadResult =
  | {
      quote: StockQuote;
      history: HistoricalCandle[];
      fundamentals: FundamentalSnapshot;
      ok: true;
    }
  | {
      quote: StockQuote;
      ok: false;
    };

const API_KEY_STORAGE_KEY = 'aktietipset.finnhubApiKey';

const readStoredApiKey = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
  } catch (error) {
    console.warn('Kunde inte läsa API-nyckel från localStorage', error);
    return '';
  }
};

export const AppDataProvider: React.FC<Props> = ({ children, provider }) => {
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
  const [apiKey, setApiKey] = useState<string>(() => readStoredApiKey());

  const dataProvider = useMemo(() => {
    if (provider) {
      return provider;
    }

    return createMarketDataProvider(apiKey || undefined);
  }, [provider, apiKey]);

  useEffect(() => {
    if (provider) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (apiKey) {
        window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      } else {
        window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Kunde inte spara API-nyckel i localStorage', error);
    }
  }, [apiKey, provider]);

  const updateApiKey = useCallback((key: string) => {
    setApiKey(key.trim());
  }, []);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      if (!active) {
        return;
      }

      setLoading(true);
      try {
        const fallbackProvider = new MockMarketDataProvider();

        let newQuotes = await dataProvider.getQuotes();
        if (newQuotes.length === 0) {
          console.warn('Inga realtidskurser kunde hämtas, använder fallback-data.');
          newQuotes = await fallbackProvider.getQuotes();
        }

        let summaryData: MarketSummary | null = null;
        try {
          summaryData = await dataProvider.getMarketSummary();
        } catch (error) {
          console.warn('Kunde inte hämta marknadssammanfattning', error);
        }

        if (!summaryData) {
          summaryData = await fallbackProvider.getMarketSummary();
        }

        const detailResults: QuoteLoadResult[] = [];
        const batchSize = 5;

        for (let index = 0; index < newQuotes.length; index += batchSize) {
          if (!active) {
            break;
          }

          const chunk = newQuotes.slice(index, index + batchSize);
          const chunkResults = await Promise.all(
            chunk.map(async (quote) => {
              try {
                const [history, fundamentals] = await Promise.all([
                  dataProvider.getHistory(quote.symbol, '1y'),
                  dataProvider.getFundamentals(quote.symbol)
                ]);
                return { quote, history, fundamentals, ok: true } as QuoteLoadResult;
              } catch (error) {
                console.warn(`Misslyckades att ladda data för ${quote.symbol}, försöker fallback`, error);
                try {
                  const [history, fundamentals] = await Promise.all([
                    fallbackProvider.getHistory(quote.symbol, '1y'),
                    fallbackProvider.getFundamentals(quote.symbol)
                  ]);
                  return { quote, history, fundamentals, ok: true } as QuoteLoadResult;
                } catch (fallbackError) {
                  console.warn(`Fick ingen data för ${quote.symbol} ens med fallback`, fallbackError);
                  return { quote, ok: false } as QuoteLoadResult;
                }
              }
            })
          );

          detailResults.push(...chunkResults);
        }

        const successfulQuotes = detailResults.filter(
          (result): result is Extract<QuoteLoadResult, { ok: true }> => result.ok
        );

        if (!active) {
          return;
        }

        if (successfulQuotes.length === 0) {
          console.warn('Hittade inga fullständiga datapaket att analysera.');
          setRecommendations([]);
        } else {
          const { minScore, maxVolatility } = riskProfileScoreMap[riskProfile];
          const computed = buildRecommendations(
            successfulQuotes.map(({ quote, history, fundamentals }) => ({ quote, history, fundamentals })),
            {
              sectors: sectors.length > 0 ? sectors : undefined,
              minScore,
              maxVolatility
            }
          );
          setRecommendations(computed);
        }

        setQuotes(newQuotes);
        setSummary(summaryData);
      } catch (error) {
        if (active) {
          console.error('Kunde inte hämta marknadsdata', error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [dataProvider, riskProfile, sectors]);

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
      apiKey,
      toggleWatchlist,
      updateRiskProfile: setRiskProfile,
      updateApiKey,
      setSectors
    }),
    [loading, quotes, recommendations, summary, watchlist, riskProfile, sectors, apiKey, updateApiKey]
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
