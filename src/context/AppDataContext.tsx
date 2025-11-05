import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  symbolLimit: number;
  toggleWatchlist: (symbol: string) => void;
  updateRiskProfile: (profile: RiskProfile) => void;
  updateApiKey: (apiKey: string) => void;
  updateSymbolLimit: (limit: number) => void;
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
const SYMBOL_LIMIT_STORAGE_KEY = 'aktietipset.symbolLimit';
const DEFAULT_SYMBOL_LIMIT = 150;

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

const readStoredSymbolLimit = (): number => {
  if (typeof window === 'undefined') {
    return DEFAULT_SYMBOL_LIMIT;
  }

  try {
    const stored = window.localStorage.getItem(SYMBOL_LIMIT_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SYMBOL_LIMIT;
    }
    const parsed = Number.parseInt(stored, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return DEFAULT_SYMBOL_LIMIT;
    }
    return Math.min(parsed, 2000);
  } catch (error) {
    console.warn('Kunde inte läsa symbolbegränsning från localStorage', error);
    return DEFAULT_SYMBOL_LIMIT;
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
  const [symbolLimit, setSymbolLimit] = useState<number>(() => readStoredSymbolLimit());
  const usingFallbackRef = useRef(false);

  const dataProvider = useMemo(() => {
    if (provider) {
      return provider;
    }

    return createMarketDataProvider(apiKey || undefined, { symbolLimit });
  }, [provider, apiKey, symbolLimit]);

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

  useEffect(() => {
    if (provider) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(SYMBOL_LIMIT_STORAGE_KEY, String(symbolLimit));
    } catch (error) {
      console.warn('Kunde inte spara symbolbegränsning i localStorage', error);
    }
  }, [symbolLimit, provider]);

  const updateApiKey = useCallback((key: string) => {
    setApiKey(key.trim());
  }, []);

  const updateSymbolLimit = useCallback((limit: number) => {
    setSymbolLimit((current) => {
      const next = Number.isFinite(limit) ? Math.max(25, Math.min(Math.floor(limit), 2000)) : current;
      return next;
    });
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
        const wasUsingFallback = usingFallbackRef.current;

        let chunkQuotes = await dataProvider.getQuotes();
        let usedFallbackQuotes = false;
        if (chunkQuotes.length === 0) {
          console.warn('Inga realtidskurser kunde hämtas, använder fallback-data.');
          chunkQuotes = await fallbackProvider.getQuotes();
          usedFallbackQuotes = true;
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

        const analysisTargets = chunkQuotes.slice(0, 40);

        for (let index = 0; index < analysisTargets.length; index += batchSize) {
          if (!active) {
            break;
          }

          const chunk = analysisTargets.slice(index, index + batchSize);
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

        setQuotes((current) => {
          if (usedFallbackQuotes) {
            return chunkQuotes;
          }

          const base = wasUsingFallback ? [] : current;
          const merged = new Map(base.map((quote) => [quote.symbol, quote]));
          chunkQuotes.forEach((quote) => {
            merged.set(quote.symbol, quote);
          });
          return Array.from(merged.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
        });
        usingFallbackRef.current = usedFallbackQuotes;
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
      symbolLimit,
      toggleWatchlist,
      updateRiskProfile: setRiskProfile,
      updateApiKey,
      updateSymbolLimit,
      setSectors
    }),
    [
      loading,
      quotes,
      recommendations,
      summary,
      watchlist,
      riskProfile,
      sectors,
      apiKey,
      symbolLimit,
      updateApiKey,
      updateSymbolLimit
    ]
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
