# AktieTipset

AktieTipset är en desktop-app byggd med Electron och React som analyserar ett urval av aktier, kombinerar tekniska indikatorer med fundamentala nyckeltal och genererar transparenta köprekommendationer. Prototypen innehåller en `MarketDataProvider` som kan växla mellan mockad data och en live-integration mot Finnhub (via personlig API-nyckel) och följer kontrakten i kravspecifikationen för att snabbt kunna kopplas till andra API:er som Nordnet eller Yahoo Finance.
AktieTipset är en desktop-app byggd med Electron och React som analyserar ett urval av aktier, kombinerar tekniska indikatorer med fundamentala nyckeltal och genererar transparenta köprekommendationer. Prototypen använder mockad marknadsdata men följer kontrakten i kravspecifikationen för att snabbt kunna kopplas till riktiga API:er som Nordnet eller Yahoo Finance.

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
1. Installera beroenden:
   ```bash
   npm install
   ```
2. Starta utvecklingsläget (Vite + Electron):
   ```bash
   npm run dev
   ```
   - Render-processen körs på [http://localhost:5173](http://localhost:5173) och bäddas in i Electron.
4. Kör enhetstester (Vitest):
3. Kör enhetstester (Vitest):
   ```bash
   npm test
   ```

## Nästa steg

- Koppla `MarketDataProvider` till en riktig datakälla (OAuth2, caching med SQLite, rate-limit hantering).
- Utöka analysmotorn med sektorjämförelser, fundamentala modeller och backtesting enligt `docs/aktietipset_spec.yaml`.
- Implementera notifieringar (desktop push/e-post), portföljimport och rapportexport.
- Förbered CI/CD-pipeline med enhetstester, E2E och byggsteg för Windows/macOS distributabler.

## Ansvarsfriskrivning

> AktieTipset ger information i utbildningssyfte och utgör inte personlig finansiell rådgivning. Historisk avkastning är ingen garanti för framtida resultat.
En konceptuell desktop-applikation som analyserar aktier och genererar köprekommendationer med möjlighet att expandera till mobila plattformar. Projektet innehåller krav- och designunderlag för att kunna påbörja implementationen av AktieTipset.

## Innehåll
- `docs/aktietipset_spec.yaml` – Samlad kravspecifikation i YAML-format.

## Snabböversikt
- Målplattformar: macOS, Windows (desktop) med framtida stöd för iOS och Android.
- UI-ramverk: Electron eller Tauri med React på desktop, samt React Native/Flutter som mobila alternativ.
- Kärnfunktioner: aktierekommendationer, teknisk och fundamental analys, realtidsuppdateringar, watchlists, notifieringar och export.
- Arkitektur: modulär lagerindelning (UI, applikationslogik, analysmotor, dataadaptrar, lokal databas) och gränssnitt för datakällor, scoring och notifieringar.
- Datasäkerhet: krypterad lagring av tokens, TLS, GDPR-efterlevnad och tydliga ansvarsfriskrivningar.

## Nästa steg
1. Upprätta prototyp av UI-flöden med vald desktop-stack.
2. Implementera `MarketDataProvider`-adapter mot vald marknadsdata-API (t.ex. Nordnet).
3. Påbörja analysmotorn med tekniska indikatorer och rankingmodell.
4. Etablera teststrategi inklusive enhetstester och backtesting enligt specifikationen.
