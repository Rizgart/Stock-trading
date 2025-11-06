# Test & Kvalitetsplan

## Översikt
Målet är att nå minst 80 % testtäckning i kärnlogik, säkra kritiska flöden med E2E-tester, samt etablera automatiserad kvalitetssäkring (lint, format, pre-commit, performance regression). Planen omfattar både frontend (React/Electron) och backend (FastAPI + analysmotor).

## Testpyramid

```
                ┌───────────────────────────┐
                │  E2E / Playwright         │  (kritiska användarflöden)
                └────────────┬──────────────┘
                             │
                ┌────────────┴──────────────┐
                │  Integration (API, gRPC)  │  (httpx, pytest, testcontainers)
                └────────────┬──────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │   Enhetstester (frontend & backend)      │
        │   - Jest/RTL                              │
        │   - Pytest (pandas/numpy/ta-lib)          │
        └──────────────────────────────────────────┘
```

## Frontend

### Enhetstester
- **Verktyg**: Jest + React Testing Library + Vitest (komponenter).
- **Omfång**:
  - Presentationskomponenter (tables, charts wrappers).
  - Hooks (ex. `useQuotes`, `useAlerts`, `usePortfolio`).
  - Utility-funktioner (`format.ts`, `accessibility.ts`).
- **Mål**: ≥80 % line/branch coverage för `src/components`, `src/hooks`, `src/utils`.

### Storybook & Visual Regression
- Storybook för centrala komponenter.
- Chromatic eller Loki för att upptäcka UI-regressions.
- Storybook a11y add-on (kontrollera kontrast och semantik).

### End-to-End (Playwright)
- Kör i CI mot dev-backend (mockad eller staging).
- Testfall:
  1. Autentisering (mockad token) + visa dashboard.
  2. Filtrera rekommendationer + exportera CSV.
  3. Lägg till alert i watchlist och trigga notis (via mockad websocket).
  4. Portföljimport av CSV + kontrollera P&L.
  5. Inställningar: uppdatera API-nyckel och språk.
- Kör Playwright på Windows/macOS i matrix (Electron/Tauri).

### Performance & Accessibility
- Lighthouse CI (desktop och PWA).
- Axe-core integration i Playwright för sidor.
- Profilera render-tider (React Profiler) i CI (budgetar).

## Backend

### Enhetstester (Pytest)
- `services/analysis`: indikatorer, fundamentals, risk, scoring (testa med fixtures).
- `services/providers`: mocka Massive API (responses), testa pagination och schema-validering (pydantic).
- `services/backtesting`: walk-forward simulering, metrics beräkning.
- `services/cache`: Redis/Postgres (använd testcontainers).
- `api/rest`: FastAPI TestClient för endpoints (quotes, rankings, alerts).
- Coverage ≥85 % i analysmotor, ≥75 % generellt.

### Integrationstester
- **Verktyg**: pytest + testcontainers (PostgreSQL, Redis, Massive-mock).
- Testscenarier:
  - Hämta quotes → cache → ranking → persistens.
  - Backtest-jobb via Celery → resultat i DB.
  - Compliance export → genererar zip med datadump.
  - Rate limit scenario (429 → retry).

### Load/Performance
- Locust/Gatling script:
  - `/v1/quotes` spikes (100 req/s)
  - `/v1/rankings` med 1k tickers
  - Backtest-job queue stress
- Mål: <300 ms P95 för API, ranking pipeline < 5s för 500 tickers.

### Static Analysis
- Ruff, Black, MyPy (backend).
- ESLint, Stylelint, TypeScript strict (frontend).
- Pre-commit hooks för formattering och linting.

## Data Kvalitet & Regression
- Snapshot tester för ranking-outcome (jämför med baseline dataset).
- Property-based tests (hypothesis) för indikatorer – t.ex. att RSI alltid inom 0–100.
- Golden master för backtesting (kända resultat mot index).
- Data pipeline assertions: schema validation med Pydantic både i backend och i ingestion.

## CI/CD Integration
- Github Actions (eller annan CI):
  - Lint → Unit tests → Integration tests → E2E (nightly).
  - Bygg artefakter (Electron/Tauri) endast på merge till main.
  - Upload coverage rapporter (Codecov/Sonar).
- Nightly job:
  - Full Playwright suite.
  - Load test (Locust) mot staging.
  - Security scans (Snyk/Trivy).

## Release Process & Quality Gates
- PR-mallar med checklista (tests, docs, a11y).
- Code review krav: minst två reviewers för känsliga moduler.
- Feature flags (LaunchDarkly el. egen) för gradvis lansering.
- QA checklist inför release:
  - Regression run (manual/E2E).
  - Performance budget check.
  - Security review (if relevant changes).

## Bug/ Incident workflow
- Bugs loggas med severity (S0-S3).
- S0/S1 måste ha hotfix <24h.
- Root Cause Analysis krävs för alla S0/S1 (Confluence logg).
- Error tracking: Sentry (frontend + backend).

## Mätetal
- Test coverage (frontend/backend).
- Mean time to detect/resolution (MTTD/MTTR).
- Release frequency vs rollback count.
- Lighthouse performance score (target ≥85).
- a11y violation count (måste vara 0 blockerande).

## Backlog (test & kvalitet)
1. Sätt upp CI pipeline (lint, unit tests) – både frontend och backend.
2. Introducera react-query/test utilities + enhetstester för hooks.
3. Pytest fixtures för Massive API mock (integration).
4. Playwright + Storybook ± Chromatic integration.
5. Testcontainers setup (Postgres, Redis, Celery worker) i CI.
6. Load test scripts (Locust) + staging pipeline.
7. Implementera Sentry + Crash reporting (Electron).
8. Automatisera compliance regression (data exports, alerts).
9. Dokumentera QA checklist & RCA process.
