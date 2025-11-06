import { DateTime } from 'luxon';
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
  apiBaseUrl: string;
  symbolLimit: number;
  toggleWatchlist: (symbol: string) => void;
  updateRiskProfile: (profile: RiskProfile) => void;
  updateApiKey: (apiKey: string) => void;
  updateApiBaseUrl: (url: string) => void;
  updateSymbolLimit: (limit: number) => void;
  fetchQuoteByName: (name: string) => Promise<StockQuote | null>;
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
const API_BASE_URL_STORAGE_KEY = 'aktietipset.apiBaseUrl';
const DEFAULT_SYMBOL_LIMIT = 150;
const DEFAULT_API_BASE_URL = 'https://api.massive.com';

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

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const candidate = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    const sanitizedPath = url.pathname.replace(/\/+$/, '').replace(/\/v\d+$/i, '');
    const normalized = `${url.protocol}//${url.host}${sanitizedPath}`;
    return normalized || DEFAULT_API_BASE_URL;
  } catch (error) {
    console.warn('Ogiltig API-bas-URL, använder standardvärdet.', error);
    return DEFAULT_API_BASE_URL;
  }
};

const readStoredApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const stored = window.localStorage.getItem(API_BASE_URL_STORAGE_KEY);
    return stored ? normalizeApiBaseUrl(stored) : DEFAULT_API_BASE_URL;
  } catch (error) {
    console.warn('Kunde inte läsa API-bas-URL från localStorage', error);
    return DEFAULT_API_BASE_URL;
  }
};

const REQUEST_TIMEOUT_MS = 7000;

const withTimeout = async <T,>(
  operation: () => Promise<T>,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
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
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(() => readStoredApiBaseUrl());
  const [symbolLimit, setSymbolLimit] = useState<number>(() => readStoredSymbolLimit());

  const dataProvider = useMemo(() => {
    if (provider) {
      return provider;
    }

    return createMarketDataProvider(apiKey || undefined, { symbolLimit, apiBaseUrl });
  }, [provider, apiKey, apiBaseUrl, symbolLimit]);

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
      if (apiBaseUrl) {
        window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, apiBaseUrl);
      } else {
        window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Kunde inte spara API-bas-URL i localStorage', error);
    }
  }, [apiBaseUrl, provider]);

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

  const updateApiBaseUrl = useCallback((url: string) => {
    setApiBaseUrl(normalizeApiBaseUrl(url));
  }, []);

  const updateSymbolLimit = useCallback((limit: number) => {
    setSymbolLimit((current) => {
      const next = Number.isFinite(limit) ? Math.max(25, Math.min(Math.floor(limit), 2000)) : current;
      return next;
    });
  }, []);

  const fetchQuoteByName = useCallback(
    async (name: string): Promise<StockQuote | null> => {
      const query = name.trim();
      if (!query) {
        return null;
      }

      const normalized = query.toLowerCase();
      const cached = quotes.find(
        (quote) =>
          quote.symbol.toLowerCase() === normalized || quote.name.toLowerCase() === normalized
      );
      if (cached) {
        return cached;
      }

      try {
        const matches = await withTimeout(
          () => dataProvider.searchTicker(query),
          REQUEST_TIMEOUT_MS
        );
        const preferred =
          matches.find(
            (quote) => quote.name.toLowerCase() === normalized || quote.symbol.toLowerCase() === normalized
          ) ?? matches[0];

        if (preferred) {
          try {
            const [liveQuote] = await withTimeout(
              () => dataProvider.getQuotes([preferred.symbol]),
              REQUEST_TIMEOUT_MS
            );
            if (liveQuote) {
              return liveQuote;
            }
          } catch (quoteError) {
            console.warn(`Kunde inte hämta live-data för ${preferred.symbol}`, quoteError);
          }
          return preferred;
        }
      } catch (error) {
        console.warn(`Ticker-sökning misslyckades för "${query}"`, error);
      }

      console.warn(`Hittade ingen data för "${query}"`);
      return null;
    },
    [dataProvider, quotes]
  );

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      if (!active) {
        return;
      }

      setLoading(true);
      try {
        let chunkQuotes: StockQuote[] = [];
        try {
          chunkQuotes = await withTimeout(() => dataProvider.getQuotes(), REQUEST_TIMEOUT_MS);
        } catch (error) {
          console.warn('Kunde inte hämta kurser i tid.', error);
        }
        const hasQuotes = chunkQuotes.length > 0;
        if (!hasQuotes) {
          console.warn('Inga realtidskurser kunde hämtas från API:et.');
        }

        let summaryData: MarketSummary | null = null;
        try {
          summaryData = await withTimeout(
            () => dataProvider.getMarketSummary(),
            REQUEST_TIMEOUT_MS
          );
        } catch (error) {
          console.warn('Kunde inte hämta marknadssammanfattning', error);
        }

        if (!summaryData) {
          summaryData = {
            updatedAt: DateTime.now().toISO(),
            headline: 'Ingen data tillgänglig just nu',
            movers: []
          };
        }

        const detailResults: QuoteLoadResult[] = [];
        const batchSize = 5;
        const analysisTargets = chunkQuotes.slice(0, 40);

        for (let index = 0; index < analysisTargets.length && hasQuotes; index += batchSize) {
          if (!active) {
            break;
          }

          const chunk = analysisTargets.slice(index, index + batchSize);
          const chunkResults = await Promise.all(
            chunk.map(async (quote) => {
              try {
                const [history, fundamentals] = await Promise.all([
                  withTimeout(
                    () => dataProvider.getHistory(quote.symbol, '1y'),
                    REQUEST_TIMEOUT_MS
                  ),
                  withTimeout(
                    () => dataProvider.getFundamentals(quote.symbol),
                    REQUEST_TIMEOUT_MS
                  )
                ]);
                return { quote, history, fundamentals, ok: true } as QuoteLoadResult;
              } catch (error) {
                console.warn(`Misslyckades att ladda data för ${quote.symbol}`, error);
                return { quote, ok: false } as QuoteLoadResult;
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

        setQuotes(chunkQuotes);
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
      apiBaseUrl,
      symbolLimit,
      toggleWatchlist,
      updateRiskProfile: setRiskProfile,
      updateApiKey,
      updateApiBaseUrl,
      updateSymbolLimit,
      fetchQuoteByName,
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
      apiBaseUrl,
      symbolLimit,
      updateApiKey,
      updateApiBaseUrl,
      updateSymbolLimit,
      fetchQuoteByName
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
