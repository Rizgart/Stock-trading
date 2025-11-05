# AktieTipset – Arkitekturöversikt

Denna arkitekturöversikt kompletterar kravspecifikationen i `aktietipset_spec.yaml` och beskriver hur systemet kan byggas upp för att möta funktions- och kvalitetskraven.

## Systemöversikt
- **UI-lager:** Byggt i React och paketerat med Electron eller Tauri för desktop. Komponenter för dashboard, rekommendationer, aktiedetaljer och watchlist struktureras med en delad design-system-modul.
- **Applikationslogik:** TypeScript-baserad tjänst som hanterar användarflöden, state management (t.ex. Redux Toolkit/Zustand) och kommunikation med analysmotor och datakällor via definierade gränssnitt.
- **Analysmotor:** Körs som Node.js-modul eller fristående Python-service nådd via gRPC/IPC. Utför tekniska indikatorer, fundamental analys och scoring. Resultaten levereras med förklaringsdata (top-3 faktorer) för transparens.
- **Dataadaptrar:** `MarketDataProvider`-implementeringar per källa (Nordnet, Yahoo Finance, etc.). Adaptrar ansvarar för autentisering, rate limit-hantering, caching och normalisering av dataformat.
- **Lokal datalagring:** SQLite för persistering av cache, watchlists, användarinställningar och backtest-resultat. Data åtkomst via repository-mönster för enkel testning.
- **Notifieringstjänst:** Abstraherar in-app-notiser, desktop push och e-post. Har stöd för tyst läge och regelbaserade alerts.

## Dataflöden
1. Användaren konfigurerar API-nycklar och watchlist i UI.
2. Applikationslogiken initierar `MarketDataProvider` som hämtar data (med caching) och skickar den till analysmotorn.
3. Analysmotorn beräknar indikatorer, kombinerar med fundamentala nyckeltal och genererar scorer och rekommendationer.
4. Resultat visas i UI tillsammans med motiveringar och lagras i SQLite för historik och backtesting.
5. Alert-regler övervakas och trigger notiser inom uppsatt SLA (<10 sek).

## Säkerhet & Efterlevnad
- OAuth2-token lagras krypterat via plattforms-API (macOS Keychain, Windows DPAPI).
- All extern trafik sker över TLS 1.2+.
- GDPR-efterlevnad genom användarens kontroll över lagrade data, inklusive möjligheten att radera lokala dataset.
- Tydlig ansvarsfriskrivning visas vid onboarding och i inställningar.

## Skalbarhet och mobil expansion
- Analysmotorn kan isoleras till en backend-service för återanvändning av logik i mobila klienter.
- GraphQL/REST-API kan exponeras för React Native/Flutter-appar med gemensam kodbas för databehandling.
- Komponentbibliotek och state management konfigureras för att kunna delas (t.ex. genom monorepo och paketpublicering).

## Testning och kvalitetssäkring
- Enhetstester för scoring, indikatorer och dataadaptrar för att uppnå 80 % täckning.
- E2E-tester med Playwright eller Spectron för kritiska flöden (import, ranking, alerts).
- Backtesting-modul stödjer walk-forward och out-of-sample-scenarion över 1–10 års perioder med mätetal (CAGR, Sharpe, MaxDD, WinRate).

## Distribution och DevOps
- CI/CD-pipeline som bygger och signerar Windows- (MSIX/EXE) och macOS-paket (DMG) med auto-uppdateringar.
- Miljöindelning (Dev, Beta, Prod) med feature-flags för gradvis utrullning.
- Observability via loggning (winston/pino), metrics och felrapportering (Sentry).
