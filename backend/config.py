"""Application configuration via environment variables."""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DATABASE_URL: str = "sqlite+aiosqlite:///./compy.db"
    DEBUG: bool = True
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    MAX_CRAWL_PAGES: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
