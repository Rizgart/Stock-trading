# AktieTipset

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
