from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import backtests, health, market, rankings
from .core.config import settings
from .services.providers import MassiveProvider


@asynccontextmanager
async def lifespan(app: FastAPI):
    provider: MassiveProvider | None = None
    if settings.massive_api_key:
        provider = MassiveProvider(
            api_key=settings.massive_api_key,
            base_url=settings.massive_base_url,
            rate_limit_interval=settings.massive_rate_limit_interval,
        )
        app.state.provider = provider
    else:
        app.state.provider = None

    try:
        yield
    finally:
        if provider:
            await provider.aclose()


def create_app() -> FastAPI:
    """Application factory for FastAPI."""
    app = FastAPI(
        title="AktieTipset API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc"
    )

  app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
  )

  app.include_router(health.router, prefix="/health", tags=["health"])
  app.include_router(market.router, prefix="/v1", tags=["market"])
  app.include_router(rankings.router, prefix="/v1", tags=["rankings"])
  app.include_router(backtests.router, prefix="/v1", tags=["backtests"])

  return app


app = create_app()


def run() -> None:
  """Entry point for poetry script."""
  import uvicorn

  uvicorn.run(
    "src.app.main:app",
    host=settings.host,
    port=settings.port,
    reload=settings.reload
  )
