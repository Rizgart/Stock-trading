# AktieTipset

AktieTipset är en desktop-app byggd med Electron och React som analyserar ett urval av aktier, kombinerar tekniska indikatorer med fundamentala nyckeltal och genererar transparenta köprekommendationer. Prototypen innehåller en `MarketDataProvider` som kan växla mellan mockad data och en live-integration mot Finnhub (via personlig API-nyckel) och följer kontrakten i kravspecifikationen för att snabbt kunna kopplas till andra API:er som Nordnet eller Yahoo Finance.

## Funktioner

- **Rekommendationsmotor** – Rankar aktier baserat på MA20/50/200, RSI, ATR, ROE, P/E, skuldgrad m.m. och väger samman till ett poängintervall 0–100 med köp/behåll/sälj-signal och top-3 motiveringar.
- **Dashboard** – Ger snabb överblick av marknadssammanfattning, toppval och bevakningslista.
- **Watchlist** – Hantera bevakade bolag, se realtidsuppdaterade priser och nuvarande signal.
- **Filter & riskprofiler** – Växla mellan konservativ, balanserad och aggressiv profil för att påverka ranking och volatilitetstolerans, samt filtrera på sektorer och sök.
- **Inställningar** – Formulär för API-nycklar, språk och översikt över datahantering (OAuth2, caching, retrier).
- **Diskret ansvarsfriskrivning** – Tydlig text i sidopanelen som påminner om att appen inte ger finansiell rådgivning.

## Projektstruktur

```
├── electron/             # Huvud- och preload-process för Electron
├── public/               # Statisk tillgång (ikon)
├── src/
│   ├── analysis/         # Indikatorer och rankingmodell
│   ├── components/       # Layout och UI-komponenter
│   ├── context/          # Globalt tillstånd, marknadsdata och inställningar
│   ├── data/             # Mockad marknadsdata för prototypen
│   ├── services/         # MarketDataProvider-kontrakt och cache
│   ├── utils/            # Formatteringshjälpare
│   └── views/            # Dashboard, rekommendationer, watchlist, inställningar
├── tests/                # Vitest-enhetstester för analysmotorn
└── docs/                 # Kravspecifikationer och arkitekturdokument
```

## Kom igång

1. Kopiera `.env.example` till `.env` och fyll i din Finnhub-nyckel (behövs för live-data):
   ```bash
   cp .env.example .env
   # öppna .env och ersätt 'din_finnhub_nyckel' med din riktiga nyckel
   ```
   Om `VITE_FINNHUB_API_KEY` saknas används mockad data som fallback.
2. Installera beroenden:
   ```bash
   npm install
   ```
3. Starta utvecklingsläget (Vite + Electron):
   ```bash
   npm run dev
   ```
   - Render-processen körs på [http://localhost:5173](http://localhost:5173) och bäddas in i Electron.
4. Kör enhetstester (Vitest):
   ```bash
   npm test
   ```

## Nästa steg

- Backend-MVP enligt [docs/backend_architecture.md](docs/backend_architecture.md) (FastAPI, caching, analysmotor).
- Utöka analysmotorn med sektorjämförelser, fundamentala modeller och backtesting enligt `docs/analysis_engine_design.md`.
- Bygg ut frontend enligt [docs/frontend_features_plan.md](docs/frontend_features_plan.md) (dashboard, portfolio, alerts, export).
- Etablera säkerhets- och dataskyddsrutiner enligt [docs/security_data_plan.md](docs/security_data_plan.md).
- Implementera test- och kvalitetsstrategi enligt [docs/testing_quality_plan.md](docs/testing_quality_plan.md).
- Följ distributions- och roadmap-planen enligt [docs/distribution_roadmap_plan.md](docs/distribution_roadmap_plan.md).
- Implementera notifieringar (desktop push/e-post), portföljimport och rapportexport.
- Förbered CI/CD-pipeline med enhetstester, E2E och byggsteg för Windows/macOS distributabler.

## Ansvarsfriskrivning

> AktieTipset ger information i utbildningssyfte och utgör inte personlig finansiell rådgivning. Historisk avkastning är ingen garanti för framtida resultat.
