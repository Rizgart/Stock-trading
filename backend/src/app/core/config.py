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

    massive_api_key: str = Field(default="", env="MASSIVE_API_KEY")
    massive_base_url: str = Field(default="https://api.massive.com", env="MASSIVE_BASE_URL")
    massive_rate_limit_interval: float = Field(default=0.25, env="MASSIVE_RATE_LIMIT_INTERVAL")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
