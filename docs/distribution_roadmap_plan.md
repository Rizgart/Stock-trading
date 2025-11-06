# Distribution & Roadmap – Plan

## Distribution

### Desktop (Electron/Tauri)
- **Byggtyper**
  - Windows: MSIX + EXE (Squirrel) med kodsignering (EV-certifikat).
  - macOS: DMG + notarized pkg (Apple Developer ID, staplad notarization).
  - Tauri-spår: skapa `src-tauri/` (Rust) med bundlingskonfiguration för lättviktsbuild.
- **Auto-updates**
  - Electron: use `electron-builder` + update server (GitHub Releases eller Nuts) med signering.
  - Tauri: `tauri-bundler` + `tauri updater`.
- **Pipeline**
  - GitHub Actions:
    - Matrix build (macOS, Windows).
    - Koder signering via secrets (Azure Key Vault, Apple notarization credentials).
    - Artefaktpublicering som pre-release → release.
  - Installer tests via Playwright (run post-install automation).

### Mobile roadmap
- React Native kapaciteter planeras – se `app.mobile_roadmap`.
- Prioritera backend API-stabilitet innan mobil pilot.
- Använd samma design system (tokens) för att minimera gap.

### Backend deployment
- Env: Dev, Beta, Prod.
- CI/CD: Build Docker (FastAPI + workers + nginx).
- Deploy targets: AWS ECS/Fargate eller Azure App Service.
- DB migrations (Alembic) automatiserade via pipeline.
- Use blue/green deployments för noll-downtime.

## Release Train
- **Cadence**: 4 veckors releasecykel.
- **Stages**:
  1. **Dev**: feature branches → PR → merge → nightly builds.
  2. **Beta**: feature freeze, regression testing, staging release.
  3. **Prod**: Release candidate taggad, signerad distribution.
- **Feature flags**: LaunchDarkly eller egen toggling (backend + frontend).

## Roadmap (fler detaljer baserat på YAML)

### MVP (0.1)
- Realtidskurser + historik (Massive API).
- Grundläggande tekniska signaler (MA, RSI, ATR).
- Ranking & rekommendationer (förklaringar).
- Watchlist + notiser (lokala notiser).
- Backend skeleton + auth (OAuth2, secure storage).
- Test pipeline (unit + integration).

### v1.1
- Fundamentalanalys & sektormodeller.
- Portföljimport (CSV/API) + P&L dashboard.
- Alerts med desktop push/e-post.
- Backtesting API & UI integration.
- Auto-updates (Electron/Tauri) + signering.
- Sentry/observability + metrics dashboards.

### v1.2
- Nyheter/sentiment integration.
- PDF-rapport & CSV export förbättrad.
- Recommendation sharing (permalink, rapporter).
- Mobile read-only pilot (React Native) – watchlist + push.
- A/B testing-infrastruktur (feature toggles).

### Mobile pilot (roadmap)
- Fokus på read-only features (watchlist, alerts push).
- Backend får mobil-specifika endpoints (lightweight payloads).
- App store distribution plan (Apple/Google dev accounts, CI pipeline).

## Release Checklist (per version)
1. Testresultat grön (unit, integration, E2E).
2. Lint/format passerat.
3. Performance budget OK (Lighthouse, API latency).
4. Security review (dependency scan, secrets).
5. Changelog uppdaterad.
6. Dokumentation (README + docs/ uppdaterade).
7. Signerade binärer laddade upp.
8. Rollout plan (beta testers, push notif).

## Operational Runbook
- Release manager roll (roterande).
- Incident response plan (referera `docs/security_data_plan.md`).
- Post-release retrospektiv med KPIs (adoption, crash rate).

## Backlog för distribution & roadmap
1. Setup GitHub Actions workflows (build/test/lint, packaging).
2. Automatisera notarization + signing (macOS/Windows).
3. Implementera auto-update server (electron-updater/tauri updater).
4. Dockerize backend + deploy scripts (Terraform/ECS).
5. Pre-release beta channel (internal testers).
6. Roadmap tracking board (Linear/Jira) med milstolpar.
7. Document release checklist och runbook i Confluence/wiki.
8. Mobile pilot spike (React Native scaffold + backend endpoints).
