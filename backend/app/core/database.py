from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import redis
import asyncio
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# SQLAlchemy setup
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=StaticPool if "sqlite" in settings.DATABASE_URL else None,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Redis setup (optional)
redis_client = None
try:
    if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        logger.info("✅ Redis connected")
except Exception as e:
    logger.warning(f"⚠️ Redis not available: {e}")

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_redis():
    """Dependency to get Redis client"""
    return redis_client

async def init_db():
    """Initialize database tables"""
    try:
        # Import all models to ensure they are registered
        from app.models import call, agent, transfer, recording
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created successfully")
        
        # Test Redis connection (if available)
        if redis_client:
            redis_client.ping()
            logger.info("✅ Redis connection established")
        else:
            logger.info("ℹ️ Redis not configured - running without cache")
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise

class DatabaseManager:
    """Database manager for advanced operations"""
    
    def __init__(self):
        self.engine = engine
        self.SessionLocal = SessionLocal
        self.redis = redis_client
    
    async def health_check(self) -> dict:
        """Check database health"""
        try:
            # Test PostgreSQL
            with self.SessionLocal() as db:
                db.execute("SELECT 1")
            
            # Test Redis
            self.redis.ping()
            
            return {"status": "healthy", "database": "connected", "redis": "connected"}
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}
    
    async def get_stats(self) -> dict:
        """Get database statistics"""
        try:
            with self.SessionLocal() as db:
                # Get basic stats (implement based on your models)
                stats = {
                    "total_calls": 0,  # Implement actual queries
                    "active_transfers": 0,
                    "total_agents": 0,
                    "redis_keys": len(self.redis.keys("*"))
                }
            return stats
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {}

# Global database manager instance
db_manager = DatabaseManager()