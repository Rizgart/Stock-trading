# Frontend – Funktioner & Arkitekturplan

## Mål
- Täcka kärnflöden från specifikationen (`docs/aktietipset_spec.yaml`): dashboard, rekommendationer, detaljvy, watchlist/portfölj, filter/sök, exporter, notiser.
- Integrera mot backend-API: ranking, historik, fundamentals, alerts, portföljimport, backtesting-resultat.
- Säkerställa god prestanda (uppstart < 1.5s, graf-render < 120ms) och tillgänglighet (tangentbord, kontrast, textstorlek).

## Översikt

```
src/
├── app/
│   ├── routes.tsx             # Route-konfiguration (React Router)
│   ├── providers/             # Context providers (AppData, Theme, i18n)
│   └── hooks/                 # Custom hooks (useQuotes, useAlerts, usePortfolio)
├── components/
│   ├── charts/                # D3/Recharts-grafer (pris, indikatorer)
│   ├── tables/                # Datagrids med sort/filter/pagination
│   ├── forms/                 # Formulärkomponenter (API-nyckel, alert-regler)
│   └── common/                # Buttons, modals, badges, cards
├── views/
│   ├── Dashboard/
│   ├── Recommendations/
│   ├── InstrumentDetail/
│   ├── Watchlist/
│   ├── Portfolio/
│   ├── Alerts/
│   └── Settings/
├── services/
│   ├── apiClient.ts           # HTTP-klient (REST + WebSocket)
│   ├── ranking.ts             # Konsumerar backend-ranking
│   ├── portfolio.ts           # Import/export, P&L
│   ├── alerts.ts              # CRUD för alertregler
│   └── notifications.ts       # Desktop push, e-post webhooks
├── store/
│   ├── queryClient.ts         # react-query tanstack configuration
│   └── slices/                # Zustand/Redux slices om behov
└── utils/
    ├── format.ts              # Valutor, procentsatser
    ├── i18n.ts                # Lokaliseringshjälp
    └── accessiblity.ts        # Focus & keyboard helpers
```

## State & Datahantering
- Inför `@tanstack/react-query` eller Zustand för server state (quotes, rankings, portfolio).
- AppDataContext reduceras till UI-state (språk, tema, riskprofil). Serverdata kommer från query hooks.
- WebSocket/Server-Sent Events för realtidsuppdateringar (quotes/alerts).
- Lokal cache (IndexedDB via `Dexie`) för offline-läge (watchlist, portfölj).

## vyer & funktioner

### 1. Dashboard
- Kort: Marknadssammanfattning, topprekommendationer, "senaste alert".
- Sparkline-grafer (pris senaste 7d) med Recharts.
- Widgets konfigurerbara (drag/drop? backlog).

### 2. Recommendations
- Tabell med sort/sök/filter (sektor, marknad, P/E, volatilitet).
- Chips för riskprofil.
- Expandable row -> visar top-3 faktorer + snabb graf.
- Export-knapp (CSV/PDF).

### 3. InstrumentDetail
- Graf (pris + indikatorer: MA50/200, RSI, MACD).
- Fundamentala nyckeltal (kort, jämförelse mot sektor).
- Backtest preview: "Om du följt signalen ...".
- Möjlighet att lägga till i watchlist/portfölj/alerts.

### 4. Watchlist
- Realtidsuppdaterad tabell med alertstatus (färgkoder).
- Inline-edit för alert thresholds.
- Segment "uppfyllda alerts".

### 5. Portfolio
- Import (CSV drag/drop) + “Hämta från Nordnet” (OAuth flow).
- Tabbar: Översikt (P&L, avkastning, riskmått), Innehav, Transaktioner.
- Diagram: allokering sektor/region, avkastning över tid.

### 6. Alerts
- Lista alertregler; skapa/ändra via modal (prisnivå, procent, indikator crossing).
- Notisinställningar (kanaler, tyst läge).
- Integrera med backend queue -> visa status (pending/triggered).

### 7. Settings
- API-bas-URL och nycklar (Massive, Nordnet).
- Riskprofil default, språk (sv/en), tema (ljus/mörk).
- Export av data, GDPR (begär radering).
- “Om appen” sektion med version / release notes.

## UI/UX Riktlinjer
- Design System:
  - Färgpalett i `styles/tokens.css`.
  - Border/Radius, spacing tokens.
  - Komponentbibliotek: antingen Radix UI + Tailwind eller eget.
- Tillgänglighet:
  - Keyboard focus outlines, skip links.
  - Kontrast > 4.5:1, test i Storybook.
  - Textstorlek justerbar (root font-size slider).
  - Screen reader labels för grafer (aria-describedby + tabulering).
- Internationalisering:
  - `react-i18next` med namespaces (`dashboard`, `portfolio`, `alerts`).
  - Datum/valuta via `Intl`.

## Notiser & Realtid
- WebSocket/GQL subscription från backend (`quotes`, `alerts` channel).
- I Electron: `ipcRenderer` för desktop push via OS.
- Browser fallback: Notification API (med användarens godkännande).
- Buffering/throttling i UI (samla realtidsuppdateringar var 1 sekund).

## Export / Rapporter
- PDF: använd `@react-pdf/renderer` eller server-side generation (backend).
- CSV: fronten genererar via `PapaParse`.
- Delningsbar länk: genererar snapshot i backend (t.ex. `/reports/{id}`).

## Teststrategi (frontend)
- Storybook med a11y- och visual regression (Chromatic).
- Jest/RTL för komponenter.
- Playwright för end-to-end:
  - `import portfolio`
  - `create alert`
  - `filter recommendations`
  - `export report`
- Performance regression (Lighthouse CI).

## Backlog (frontend)
1. **State refactor** – införa react-query/Zustand, koppla mot backend API klient.
2. **Dashboard overhaul** – nya widgets, realtidskoppling.
3. **Recommendations v2** – filterkomponent, exportfunktion.
4. **InstrumentDetail** – graf + indikatorer (D3/Recharts), fundamentals.
5. **Watchlist/Alerts** – alert CRUD UI, notifieringsinställningar.
6. **Portfolio** – importflöde, P&L-beräkning, grafer.
7. **Settings** – språk/tema, API-hantering, GDPR.
8. **Reports** – PDF/CSV, delningslänkar.
9. **Accessibility pass** – tangentbord, kontrast, SR.

## Integrationer
- Backend endpoints definierade i `docs/backend_architecture.md`.
- Notifieringar/alerts integreras med backend queue (poll/WebSocket).
- iOS/Android roadmap: komponenter byggs med design system kompatibelt med React Native (ex. genom att separera ren logik och styling).

---

Denna plan guidar kommande implementationer. För varje backlogpunkt kan vi skapa specifika issues/tasks och iterera.
