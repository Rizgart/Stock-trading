# Säkerhet & Datahantering – Plan

## Mål
- Skydda API-nycklar, tokens och känslig data (GDPR, MiFID).
- Säkerställa TLS, kryptering at-rest/in-transit, minst privilegieprincip.
- Erbjuda verktyg för samtycke, dataradering och revisionsspår.

## Autentisering & Autorisation

### Desktop (Electron/Tauri)
- OAuth2 PKCE mot backend (Authlib).
- Tokens lagras krypterat:
  - macOS: Keychain via `keytar`/Tauri `tauri-plugin-store`.
  - Windows: DPAPI (`node-dpapi` eller Tauri secure storage).
- Refresh tokens hålls i backend (token exchange → short-lived access tokens).

### Backend
- Central auth-service (FastAPI dependency):
  - Introspektion av access tokens.
  - RBAC: roller (`user`, `analyst`, `admin`).
  - API-keys för partners (rate-limited).
- Multi-factor roadmap via WebAuthn.
- Sessionsloggning (user-agent, IP, tidsstämplar).

## Transport & nätverk
- All kommunikation via HTTPS (TLS 1.2+).  
- Certifikatshantering:
  - Dev: mkcert / self-signed.
  - Prod: ACME/Let’s Encrypt eller AWS ACM.
- Desktop → backend: pinna certifikat (Tauri `dangerous_remote_asset`) + man-in-the-middle-skydd.
- Bastion/VPN för admin-gränssnitt, anslutningar loggas.

## Data at rest
- PostgreSQL: aktivera `pgcrypto` (kolumnkryptering) för känsligt innehåll (alert-regler, notifieringsinställningar).
- Redis: TLS + AUTH, option att använda AWS ElastiCache med Transit/At-rest encryption.
- Filsystem (rapporter, export): lagras i S3 med KMS; signerade URLs.
- Lokala caches (IndexedDB/SQLite): kryptera med AES-GCM, nyckel härledd från device secret.

## Rate limiting & Abuse prevention
- Backend: per-API key och per-IP limiter (Redis-based token bucket).
- Alerts: max X regler per användare, anti-spam.
- Portfolio import/export: throttlas och valideras (storlek, schema).
- Logging & SIEM integration (ELK/Splunk) + alert vid felmönster (t.ex. 401 spikes).

## GDPR/MiFID
- Samtycke: UI ruta vid första start (lagras i backend `consents` tabell).
- Datatillgång:
  - Endpoint `GET /v1/compliance/export` – genererar zip med användardata.
  - Backend job queue (Celery) packar data, email-notifiering/ download-länk.
- Radering:
  - `POST /v1/compliance/delete` – flagga användare för radering.
  - Data anonymiseras, tokens återkallas, alert-historik pseudonymiseras.
- Logg retention: 12 månader, sedan pseudonymiseras.
- Disclaimer visas i UI (Settings/Dashboard).

## Secret management & DevOps
- Backend config via `.env` (utveckling), i produktion via Vault (HashiCorp) eller AWS Secrets Manager.
- Github Actions/CI: använd OpenID Connect -> moln-SM.
- Secrets roteras automatiskt (30 dagar).
- Infrastructure-as-Code (Terraform) med secrets placeholders.

## Endpoint Security
- CSRF-skydd: Access tokens via Authorization header, state-check i PKCE flöde.
- Content Security Policy (Electron/Tauri): disabla eval, remote content only via allowlist.
- Sanitera all import-data (CSV/JSON) med schema (pydantic + pandas validation).
- Anti-automation: reCAPTCHA eller hCaptcha på publika formulär (kontakt/registrering).
- Notis-webhooks: signera nyttolast (HMAC) och verifiera på mottagarsidan.

## Monitoring & Incident Response
- Metrics (Prometheus) för auth failures, API-latens, cache hits.
- Alerting: PagerDuty/Slack integration.
- Realtime log processing (Fluent Bit) -> central log storage.
- Incident playbook (Confluence) + retrospectives.

## Implementation backlog
1. **Secret storage clients**
   - Integrera `keytar`/Tauri secure storage i UI.
   - Backend: Authlib + DB schema för tokens (revocation list).

2. **TLS & cert pipeline**
   - Dev script för self-signed certs.
   - Prod: IaC script för ACM/Let's Encrypt.

3. **Rate limiting middleware**
   - Redis-backed limiter + logging.

4. **Compliance endpoints**
   - Export/Delete flows, Celery tasks, audits (PostgreSQL `audit` table).

5. **Encryption at rest**
   - PostgreSQL migration med kryptokolumner.
   - CLI för nyckelrotation.

6. **Offline cache kryptering**
   - Implementera AES-lager för SQLite/IndexedDB.

7. **Monitoring**
   - Metrics + dashboards (Grafana), log pipelines.

8. **Incident plan**
   - Dokumentera process, roller, kommunikation.

Ny funktionalitet bör hänvisa hit för säkerhetskrav innan implementation.
