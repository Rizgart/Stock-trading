# Backend-arkitektur (MVP)

## Översikt

Backend byggs som en modulär FastAPI-applikation som fungerar som navet mellan externa datakällor (Massive API, framtida Nordnet/Yahoo) och klienterna (Electron/Tauri frontend). Tjänsten exponerar både REST och – för tyngre batchjobb – gRPC. En central princip är att all databehandling (caching, rate-limit-hantering, analys, notifieringar) flyttas hit så att frontenden kan hållas tunn.

```
┌────────────────────┐        ┌────────────────────┐         ┌────────────────────┐
│ Electron/Tauri CLI │ <----> │ FastAPI API Gateway │ <-----> │ External Providers │
│ Mobilklient (kons.)│        │  (REST + gRPC)      │         │ (Massive, Nordnet) │
└────────────────────┘        └────────────────────┘         └────────────────────┘
                                       │
             ┌─────────────────────────┴─────────────────────────┐
             │                                                   │
 ┌─────────────────────────┐                         ┌─────────────────────────┐
 │ Cache & Storage Layer   │                         │ Analys/Orkestrering     │
 │ - Redis (in-memory)     │                         │ - Teknik/Fundamental     │
 │ - PostgreSQL (persistent)│                        │   ranking pipelines      │
 │ - SQLite (edge fallback)│                         │ - Alert/Backtest motor   │
 └─────────────────────────┘                         └─────────────────────────┘
```

## Modulindelning

| Modul                     | Ansvar                                                                 | Teknologi          |
|---------------------------|-------------------------------------------------------------------------|--------------------|
| `api/rest`                | REST-endpoints (OpenAPI) för quotes, historik, ranking, alerts          | FastAPI            |
| `api/grpc`                | gRPC-tjänster för högvolym/batch (backtesting, import)                  | grpcio + FastAPI   |
| `services/providers`      | Adapters mot Massive, Nordnet, Yahoo; rate limit & failover             | httpx, asyncio     |
| `services/cache`          | Uniform cachinggränssnitt (Redis + Postgres + lokal SQLite fallback)    | aioredis, sqlalchemy|
| `services/analysis`       | Python-baserad analysmotor (pandas, numpy, ta-lib)                      | pandas/numpy/ta-lib|
| `services/alerts`         | Alertregler, notifieringskö, e-post/push integration                    | Celery / APScheduler|
| `services/backtesting`    | Walk-forward/backtest körningar, persistens av resultat                 | pandas, numpy      |
| `services/auth`           | OAuth2 + token vault (Keychain/DPAPI access via desktop app)            | python-jose        |
| `infra/monitoring`        | Logging, tracing, metrics                                               | structlog, OpenTelemetry |

## Datamodell (PostgreSQL)

```sql
TABLE instruments (
  id SERIAL PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL,
  name TEXT,
  market TEXT,
  exchange TEXT,
  currency TEXT,
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  last_updated TIMESTAMPTZ
);

TABLE quotes (
  instrument_id INT REFERENCES instruments(id),
  price NUMERIC,
  change_pct NUMERIC,
  volume BIGINT,
  as_of TIMESTAMPTZ,
  PRIMARY KEY (instrument_id, as_of)
);

TABLE fundamentals (
  instrument_id INT REFERENCES instruments(id),
  pe NUMERIC,
  ps NUMERIC,
  roe NUMERIC,
  debt_to_equity NUMERIC,
  growth_5y NUMERIC,
  profit_margin NUMERIC,
  beta NUMERIC,
  dividend_yield NUMERIC,
  as_of TIMESTAMPTZ,
  PRIMARY KEY (instrument_id, as_of)
);

TABLE rankings (
  instrument_id INT REFERENCES instruments(id),
  score NUMERIC,
  signal TEXT,
  factors JSONB,
  profile TEXT, -- riskprofil
  computed_at TIMESTAMPTZ,
  PRIMARY KEY (instrument_id, profile, computed_at)
);

TABLE alerts (
  id SERIAL PRIMARY KEY,
  instrument_id INT REFERENCES instruments(id),
  user_id UUID NOT NULL,
  rule JSONB,
  channel TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ
);
```

Redis används för kortlivade cacheobjekt (t.ex. quotes < 60s), medan PostgreSQL blir källan för historik och rankingresultat. SQLite används endast när klienten är offline och behöver lokalt cachad data (redan löst i frontenden).

## API-kontrakt (REST)

| Metod | Path                          | Beskrivning                                 |
|-------|-------------------------------|---------------------------------------------|
| GET   | `/v1/quotes`                  | Lista quotes (filter på tickers, sektor)    |
| GET   | `/v1/quotes/{ticker}`         | Enskild quote + metadata                    |
| GET   | `/v1/history/{ticker}`        | Historiska OHLC (param: period, interval)   |
| GET   | `/v1/fundamentals/{ticker}`   | Fundamentala datapunkter                    |
| GET   | `/v1/rankings`                | Rankinglista (param: profil, limit, filter) |
| POST  | `/v1/rankings/recompute`      | Trigger recalculation (protected)           |
| GET   | `/v1/alerts`                  | List alerts (auth)                          |
| POST  | `/v1/alerts`                  | Skapa alert                                  |
| PATCH | `/v1/alerts/{id}`             | Aktivera/inaktivera alert                   |
| POST  | `/v1/import/portfolio`        | Ta emot CSV/JSON för portföljimport         |
| GET   | `/v1/backtests`               | Starta/kontrollera backtest-jobb            |

Alla endpoints säkras med OAuth2 (PKCE) där desktop-klienten lagrar access tokens lokalt (Keychain/DPAPI). För peer-to-peer (desktop → backend) används mTLS i framtida förlängning.

## Provider-adapters

```
services/providers/
  ├── base.py             # Interface & common utilities (retry, caching)
  ├── massive.py          # Massive API-integration
  ├── nordnet.py          # OAuth2 + Nordnet endpoints (roadmap)
  ├── yahoo.py            # (Fallback) modul
```

Gemensam features:
- httpx med AsyncClient
- Circuit breaker + exponential backoff
- Schematisk validering (pydantic v2) för alla svar
- Automatisk pagination via `next_url` (Massive)
- Rate limit token bucket (redis-backed)

## Caching-strategi

| Data                | Primär cache | TTL      | Persistens |
|---------------------|--------------|----------|------------|
| Quotes              | Redis        | 15s-30s  | Ja (PostgreSQL snapshots) |
| History OHLC        | PostgreSQL   | 24h      | Ja         |
| Fundamentals        | PostgreSQL   | 24h      | Ja         |
| Ranking             | PostgreSQL   | 1h       | Ja         |
| Alerts state        | PostgreSQL   | N/A      | Ja         |

### Cache flow
1. Kontrollera Redis
2. Om miss, fråga PostgreSQL (senaste snapshot)
3. Om stale/miss, hämta från extern provider → uppdatera Postgres → hydrera Redis

## Analys & batch

- Async worker (Celery eller RQ) körs för ranking/alerts/backtests.
- Scheduler (APScheduler) triggar:
  - Intraday refresh var 1:e minut (quotes + ranking)
  - EOD refresh (fundamentals, backtests)
  - Notifiering av alerts
- Backtesting-jobb linearisers via gRPC call (för att undvika HTTP timeouts).

## Observability

- Logging: structlog + JSON output (ELK)
- Metrics: Prometheus exporter (uvicorn middleware)
- Tracing: OpenTelemetry (Massive-anrop, ranking pipeline)
- Audit trail för alla skrivoperationer (alerts, portfolio import)

## Deployment pipeline

1. Docker multi-stage (FastAPI + uvicorn-gunicorn).
2. CI: lint (ruff/mypy), pytest, integrationstester (httpx + testcontainers).
3. CD: bygg till container registry, deploy till AWS ECS eller Azure WebApps.
4. Migrationer sköts via Alembic; seed jobs visar initial metadata (t.ex. index).

## Nästa steg (utvecklingsbacklog)

1. **Skeleton repo**
   - Skapa `backend/` katalog med FastAPI baseline, Poetry, pyproject, Dockerfile.
   - Sätta upp lint/format (ruff, black) och teststruktur.

2. **Provider adapter (Massive)**
   - Implementera `MassiveProvider` i Python – schema, caching, rate limits.
   - Integrationstester mot sandbox/mock.

3. **Cache-lager**
   - Redis-klient + fallback till Postgres.
   - Alembic migrationer för tabeller enligt modellen.

4. **REST endpoints (v1)**
   - `/v1/quotes`, `/v1/history`, `/v1/fundamentals`, `/v1/rankings`.
   - OpenAPI + Pydantic modeller.

5. **Analys-service**
   - Flytta TS-rankinglogik till Python (pandas, numpy).
   - Enhetstester och benchmarks.

6. **Alerts + notifieringar**
   - Persistens + scheduler.
   - Integrera med e-post/desktop-push webhook.

7. **Observability & auth**
   - OAuth2 server (Authlib), loggning, metrics.

Denna backlog kan brytas ned i Jira/GitHub Issues med etiketter `backend`, `provider`, `analysis`, `alerts`.
