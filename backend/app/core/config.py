from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional
import os

class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = Field(default="dev-secret-key", env="SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # LiveKit Configuration
    LIVEKIT_API_KEY: str = Field(default="APIppeTKHuvycEy", env="LIVEKIT_API_KEY")
    LIVEKIT_API_SECRET: str = Field(default="YYom6f3b2D3XGLIhXkwo2sVAjbQLkporo6LAtVTnZIT", env="LIVEKIT_API_SECRET")
    LIVEKIT_WS_URL: str = Field(default="wss://project-warm-transfer-implementation-jmsg4oli.livekit.cloud", env="LIVEKIT_WS_URL")
    
    # AI/LLM Configuration
    OPENAI_API_KEY: Optional[str] = Field(None, env="OPENAI_API_KEY")
    GROQ_API_KEY: Optional[str] = Field(None, env="GROQ_API_KEY")
    OPENROUTER_API_KEY: Optional[str] = Field(None, env="OPENROUTER_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = Field(None, env="ANTHROPIC_API_KEY")
    
    # Default AI provider
    DEFAULT_AI_PROVIDER: str = "openai"
    AI_MODEL_CONFIG: dict = {
        "openai": {
            "model": "gpt-3.5-turbo",  # More reliable and faster
            "max_tokens": 500,
            "temperature": 0.7
        },
        "groq": {
            "model": "llama3-70b-8192",
            "max_tokens": 500,
            "temperature": 0.7
        },
        "anthropic": {
            "model": "claude-3-sonnet-20240229",
            "max_tokens": 500
        }
    }
    
    # Database Configuration
    DATABASE_URL: str = Field(default="sqlite:///./warmtransfer.db", env="DATABASE_URL")
    REDIS_URL: Optional[str] = Field(None, env="REDIS_URL")
    
    # Twilio Configuration (Optional)
    TWILIO_ACCOUNT_SID: Optional[str] = Field(None, env="TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = Field(None, env="TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER: Optional[str] = Field(None, env="TWILIO_PHONE_NUMBER")
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000"
    ]
    
    # Recording Configuration
    RECORDING_ENABLED: bool = Field(True, env="RECORDING_ENABLED")
    RECORDING_STORAGE_PATH: str = Field("./recordings", env="RECORDING_STORAGE_PATH")
    S3_BUCKET_NAME: Optional[str] = Field(None, env="S3_BUCKET_NAME")
    AWS_ACCESS_KEY_ID: Optional[str] = Field(None, env="AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(None, env="AWS_SECRET_ACCESS_KEY")
    
    # Application Configuration
    ENVIRONMENT: str = Field("development", env="ENVIRONMENT")
    DEBUG: bool = Field(True, env="DEBUG")
    LOG_LEVEL: str = Field("INFO", env="LOG_LEVEL")
    
    # Transfer Configuration
    TRANSFER_TIMEOUT_SECONDS: int = 300  # 5 minutes
    MAX_CONCURRENT_TRANSFERS: int = 100
    AI_SUMMARY_TIMEOUT_SECONDS: int = 30
    
    # Agent Configuration
    MAX_AGENTS_PER_QUEUE: int = 50
    AGENT_HEARTBEAT_INTERVAL: int = 30
    AGENT_IDLE_TIMEOUT: int = 600  # 10 minutes
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Create global settings instance
settings = Settings()