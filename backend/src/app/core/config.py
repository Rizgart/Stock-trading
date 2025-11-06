from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration."""

    app_name: str = "AktieTipset API"
    environment: str = Field(default="dev", env="ENVIRONMENT")

    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    reload: bool = Field(default=True, env="RELOAD")

    cors_allow_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost", "http://localhost:5173"],
        env="CORS_ALLOW_ORIGINS",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
