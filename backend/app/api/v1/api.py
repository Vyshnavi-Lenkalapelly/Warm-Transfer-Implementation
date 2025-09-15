from fastapi import APIRouter
from app.api.v1.endpoints import calls, transfers, agents, rooms, analytics, ai, warm_transfer

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(calls.router, prefix="/calls", tags=["calls"])
api_router.include_router(transfers.router, prefix="/transfers", tags=["transfers"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(warm_transfer.router, prefix="/warm-transfer", tags=["warm-transfer"])