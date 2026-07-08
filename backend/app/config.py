from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    # PostgreSQL
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", os.getenv("DB_HOST", "localhost"))
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", os.getenv("DB_PORT", "5432"))
    POSTGRES_USER = os.getenv("POSTGRES_USER", os.getenv("DB_USER", "postgres"))
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", os.getenv("DB_PASSWORD", "2012"))
    POSTGRES_DB = os.getenv("POSTGRES_DB", os.getenv("DB_NAME", "onee_db"))
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # API Settings
    API_V1_PREFIX = "/api/v1"
    PROJECT_NAME = "ONEE API"
    VERSION = "1.0.0"
    
settings = Settings()