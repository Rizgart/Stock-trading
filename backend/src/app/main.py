from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import health
from .core.config import settings


def create_app() -> FastAPI:
  """Application factory for FastAPI."""
  app = FastAPI(
    title="AktieTipset API",
    version="0.1.0",
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
