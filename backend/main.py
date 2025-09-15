from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import asyncio
import logging
from typing import List

from app.core.config import settings
from app.api.v1.api import api_router
from app.core.websocket_manager import ConnectionManager
from app.services.livekit_service import LiveKitService
from app.services.ai_service import AIService
from app.core.database import init_db

# Configure logging
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)

# Global managers
connection_manager = ConnectionManager()
livekit_service = LiveKitService()
ai_service = AIService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("🚀 Starting Warm Transfer System...")
    await init_db()
    await livekit_service.initialize()
    logger.info("✅ Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("🔄 Shutting down application...")
    await livekit_service.cleanup()
    logger.info("✅ Application shutdown complete")

app = FastAPI(
    title="Warm Transfer System API",
    description="Advanced LiveKit-based warm transfer system with AI integration",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# WebSocket endpoint for real-time updates
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time communication"""
    await connection_manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            await connection_manager.broadcast(f"Client {client_id}: {data}")
    except WebSocketDisconnect:
        connection_manager.disconnect(client_id)
        await connection_manager.broadcast(f"Client {client_id} disconnected")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "🔄 Warm Transfer System API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/api/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check LiveKit connection
        livekit_status = await livekit_service.health_check()
        
        # Check AI service
        ai_status = ai_service.health_check()
        
        return {
            "status": "healthy",
            "livekit": livekit_status,
            "ai_service": ai_status,
            "timestamp": asyncio.get_event_loop().time()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )