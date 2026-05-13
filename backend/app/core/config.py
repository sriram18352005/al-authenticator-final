from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path

HOME = Path.home()
AL_DATA_DIR = HOME / ".al_authenticator"
AL_DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = AL_DATA_DIR / "sql_app.db"

class Settings(BaseSettings):
    PROJECT_NAME: str = "AL Authenticator"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "SECRET_KEY_PLACEHOLDER"  # Change in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # SQL Database - Use explicit local path to bypass OneDrive sync locks
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DATABASE_PATH}?check_same_thread=False"
    
    # Redis & Celery
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379
    CELERY_BROKER_URL: str = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    CELERY_RESULT_BACKEND: str = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    
    # Google Cloud Document AI
    GOOGLE_CLOUD_PROJECT: str = "your-project-id"
    GOOGLE_CLOUD_LOCATION: str = "us"  # 'us' or 'eu'
    GOOGLE_DOCUMENT_AI_PROCESSOR_ID: str = "your-processor-id"
    
    # Gemini API
    GEMINI_API_KEY: Optional[str] = None
    
    # AWS S3 Configuration
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID", "your_access_key")
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY", "your_secret_key")
    AWS_REGION: str = os.getenv("AWS_REGION", "your_region")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "your-bucket-name")
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
