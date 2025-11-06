# AktieTipset Backend

Detta är startpunkten för FastAPI-baserade backend som beskrivs i `docs/backend_architecture.md`. Projektet är strukturerat för att byggas med Poetry och Python 3.11.

## Snabbstart

```bash
cd backend
poetry install
poetry run uvicorn src.app.main:app --reload
```

Öppna `http://127.0.0.1:8000/health` för att verifiera att API:t svarar.

## Struktur

```
backend/
├── pyproject.toml
├── README.md
└── src/
    └── app/
        ├── __init__.py
        ├── main.py
        ├── api/
        │   ├── __init__.py
        │   └── v1/
        │       ├── __init__.py
        │       └── health.py
        ├── core/
        │   ├── __init__.py
        │   └── config.py
        └── services/
            ├── __init__.py
            └── providers/
                ├── __init__.py
                └── massive_stub.py
```

Backend följer planerna i `docs/backend_architecture.md`, med modulindelning för API, tjänster, cache och analys. Den nuvarande implementationen är ett skelett med en health-check och stub för Massive provider.

## Tester

```bash
poetry run pytest
```

Pytest är konfigurerat med async-stöd (`pytest-asyncio`).

## Nästa steg
- Implementera riktiga providers för Massive/Nordnet enligt design.
- Lägg till Redis/PostgreSQL-klienter och cachinglager.
- Flytta rankinglogik till `services/analysis` (se `docs/analysis_engine_design.md`).
- Anslut REST/gRPC endpoints och Celery workers.

Se även:
- `docs/backend_architecture.md`
- `docs/security_data_plan.md`
- `docs/testing_quality_plan.md`
