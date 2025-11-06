# Analysmotor & Backtesting – Design

## Mål
- Flytta rankingberäkningar från frontend (TypeScript) till backend (Python) enligt `docs/backend_architecture.md`.
- Stötta både tekniska och fundamentala indikatorer, riskmodeller och förklarbarhet (top-3 faktorer).
- Tillhandahålla API för realtidsranking, alertregler och backtesting (1–10 år).

## Arkitekturöversikt

```
backend/
└── services/
    ├── analysis/
    │   ├── __init__.py
    │   ├── models.py           # Pydantic/Pandas strukturer för inputs/outputs
    │   ├── indicators.py       # MA, MACD, RSI, ATR, momentum
    │   ├── fundamentals.py     # Värdering, tillväxt, profitability
    │   ├── risk.py             # Beta, volatilitet, drawdown
    │   ├── scoring.py          # Viktning, normalisering, faktoruttag
    │   └── pipeline.py         # Orkestrerar hela flödet
    ├── backtesting/
    │   ├── engine.py           # Walk-forward, CAGR, Sharpe, MaxDD
    │   ├── scenarios.py        # Fördefinierade perioder/profiler
    │   └── persistence.py      # Lagra resultat i PostgreSQL
    └── alerts/
        └── rules.py            # (byggs i steg 4, referens här)

```

### Inputmodeller (analysis/models.py)
```python
from pydantic import BaseModel
from typing import List

class Candle(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float

class Fundamentals(BaseModel):
    pe: float
    ps: float
    roe: float
    debt_to_equity: float
    growth_5y: float
    profit_margin: float
    beta: float
    dividend_yield: float

class InstrumentSnapshot(BaseModel):
    ticker: str
    name: str
    sector: str
    price: float
    change_pct: float
    currency: str
    history: List[Candle]
    fundamentals: Fundamentals
```

Output:
```python
class Recommendation(BaseModel):
    ticker: str
    name: str
    sector: str
    score: float
    signal: Literal["BUY", "HOLD", "SELL"]
    price: float
    change_pct: float
    factors: List[str]
    profile: Literal["konservativ", "balanserad", "aggressiv"]
    computed_at: datetime
```

## Indicator Pipeline (indicators.py)
- Använd `pandas` och `ta-lib` (eller `pandas-ta` om ta-lib ej tillgängligt).
- Funktioner:
  - `moving_average(series, window)`
  - `macd(series)`
  - `rsi(series, window=14)`
  - `atr(high, low, close, window=14)`
  - `momentum(series, window=20)`
- Returnera både råa värden och normaliserade score (0–100).

## Fundamentals (fundamentals.py)
- Jämförelse mot sektor/marknadssnitt (PostgreSQL håller aggregerade medel).
- Score heuristik enligt YAML: undervärdering, tillväxt > 10%, stark marginal, utdelning.
- Output: dict med `score: float` och `factors: List[str]`.

## Risk (risk.py)
- ATR % av pris (belöna låg volatilitet för konservativa profiler).
- Beta-justering.
- Max drawdown på vald period.
- Output likt fundamentals: `score` + `factors`.

## Scoring (scoring.py)
- Viktning (0.45 teknisk, 0.4 fundamental, 0.15 risk).
- Normalisera 0–100, definiera signalgränser (>=70 BUY, <=45 SELL).
- Slumpa inte faktorer längre; välj top-3 baserat på scorebidrag.

## Pipeline (pipeline.py)
- Tar lista av `InstrumentSnapshot`.
- Kör indikatorer/fundamentals/risk parallellt (async / ThreadPool).
- Returnerar sorterat resultat + metadata (profil, filters).
- Cache: Om samma uppsättning tickers och datahash, återanvänd resultat via Redis.

### Funktionell pseudokod
```python
async def build_recommendations(snapshots: List[InstrumentSnapshot], profile: RiskProfile) -> List[Recommendation]:
    technical = await compute_technical_scores(snapshots, profile)
    fundamental = compute_fundamental_scores(snapshots, profile)
    risk = compute_risk_scores(snapshots, profile)
    return combine_scores(technical, fundamental, risk, profile)
```

## Backtesting

### engine.py
- Input: lista tickers, period (1y/3y/5y/10y), profil.
- Datahämtning: via provider service (Massive) eller lokala snapshots.
- Metod: Walk-forward (t.ex. 6m träningsfönster, 3m framåt) + jämförelse mot benchmark (S&P500).
- Metrics:
  - CAGR
  - Sharpe ratio (riskfri ränta ~ 0.5 %)
  - Max drawdown
  - Win rate (% trades med positiv avkastning)
- Output: `BacktestResult` (JSONB): aggregat, equity curve, top råd per period.

### persistence.py
- Lagra resultat i tabell `backtests`:
```sql
TABLE backtests (
  id UUID PRIMARY KEY,
  params JSONB,
  metrics JSONB,
  equity_curve JSONB,
  created_at TIMESTAMPTZ
);
```

## API Integration
- REST endpoint: `POST /v1/rankings/recompute` triggar pipeline och returnerar JSON.
- REST endpoint: `POST /v1/backtests` startar asynkron backtest-jobb → svar med job-id.
- gRPC service `AnalysisService` med metoder:
  - `ComputeRanking(ComputeRankingRequest) returns (RankingResponse)`
  - `RunBacktest(RunBacktestRequest) returns (BacktestJob)`
- Job queue (Celery) konsumerar backlog (ranking refresh och backtest) och skriver resultat till DB + cache.

## Infrastruktur & Dev Workflow
- Requirements (pyproject):
  - `pandas`, `numpy`, `ta-lib` (med fallback till `pandas-ta`), `scikit-learn` (för eventuell ML), `fastapi`, `pydantic`, `sqlalchemy`, `celery`, `redis`, `python-dotenv`.
- Testning:
  - Pytest med fixtures (historik/fundamentals).
  - Property-based tester (hypothesis) för indikatorer.
  - Integrationstester mot sqlite/redis docker container.
- Benchmark:
  - Skript för att mäta runtime per 100 tickers/40 indikatorer.

## Migration från frontend TS
- `src/analysis/ranking.ts` blir referens för scoring men porteras till Python.
- Frontend byter i nästa steg till att hämta ranking via API istället för lokal beräkning.
- Temporärt kan fronten anropa Node-baserad adapter tills backend är klart (feature flag).

## Backlog (implementation)
1. Skapa Python-projektstruktur (`backend/`) med Poetry, tox, pre-commit.
2. Implementera data modeller + indikatorer (unit tests).
3. Implementera scoring pipeline + REST endpoint stub (dummy data).
4. Portera backtesting logik (walk-forward) + persistens.
5. Koppla till Massive provider via backend adapter (hämtar historik/fundamentals).
6. Integrationstester + benchmarks.
7. Frontend: byta till att konsumera `/v1/rankings`.
8. Avveckla TS-ranking (sista steg).
