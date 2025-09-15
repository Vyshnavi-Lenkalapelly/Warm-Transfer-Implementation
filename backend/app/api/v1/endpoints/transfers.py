from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.services.transfer_service import WarmTransferService
from app.services.livekit_service import LiveKitService
from app.services.ai_service import AIService
from app.core.websocket_manager import ConnectionManager
from app.models.transfer import Transfer
from app.models.call import Call
from app.models.agent import Agent

logger = logging.getLogger(__name__)

router = APIRouter()

# Global services (in a real app, these would be injected properly)
livekit_service = LiveKitService()
ai_service = AIService()
connection_manager = ConnectionManager()
transfer_service = WarmTransferService(livekit_service, ai_service, connection_manager)

# Pydantic models for request/response
class TransferInitiateRequest(BaseModel):
    call_id: str
    source_agent_id: str
    target_agent_id: str
    reason: Optional[str] = None
    priority: Optional[str] = "medium"

class TransferJoinRequest(BaseModel):
    agent_id: str
    role: Optional[str] = "agent"

class TransferCompleteRequest(BaseModel):
    success: bool = True
    feedback: Optional[str] = None

class TransferCancelRequest(BaseModel):
    reason: Optional[str] = None

class TransferResponse(BaseModel):
    transfer_id: str
    status: str
    message: str
    data: dict = {}

@router.post("/initiate", response_model=TransferResponse)
async def initiate_transfer(
    request: TransferInitiateRequest,
    db: Session = Depends(get_db)
):
    """Initiate a warm transfer between agents"""
    try:
        result = await transfer_service.initiate_warm_transfer(
            call_id=request.call_id,
            source_agent_id=request.source_agent_id,
            target_agent_id=request.target_agent_id,
            reason=request.reason,
            priority=request.priority
        )
        
        return TransferResponse(
            transfer_id=result["transfer_id"],
            status="success",
            message="Transfer initiated successfully",
            data=result
        )
        
    except ValueError as e:
        logger.error(f"Validation error in transfer initiation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error initiating transfer: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate transfer")

@router.post("/{transfer_id}/join", response_model=TransferResponse)
async def join_transfer(
    transfer_id: str,
    request: TransferJoinRequest
):
    """Join a transfer room as an agent"""
    try:
        result = await transfer_service.join_transfer_room(
            transfer_id=transfer_id,
            agent_id=request.agent_id,
            role=request.role
        )
        
        return TransferResponse(
            transfer_id=transfer_id,
            status="success",
            message=f"Agent {request.agent_id} joined transfer room",
            data=result
        )
        
    except ValueError as e:
        logger.error(f"Validation error joining transfer: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error joining transfer: {e}")
        raise HTTPException(status_code=500, detail="Failed to join transfer")

@router.post("/{transfer_id}/complete", response_model=TransferResponse)
async def complete_transfer(
    transfer_id: str,
    request: TransferCompleteRequest,
    background_tasks: BackgroundTasks
):
    """Complete a warm transfer"""
    try:
        result = await transfer_service.complete_transfer(
            transfer_id=transfer_id,
            success=request.success,
            feedback=request.feedback
        )
        
        # Add background task for analytics update
        background_tasks.add_task(update_transfer_analytics, transfer_id, request.success)
        
        return TransferResponse(
            transfer_id=transfer_id,
            status="success",
            message="Transfer completed successfully" if request.success else "Transfer marked as failed",
            data=result
        )
        
    except ValueError as e:
        logger.error(f"Validation error completing transfer: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error completing transfer: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete transfer")

@router.post("/{transfer_id}/cancel", response_model=TransferResponse)
async def cancel_transfer(
    transfer_id: str,
    request: TransferCancelRequest
):
    """Cancel an ongoing transfer"""
    try:
        result = await transfer_service.cancel_transfer(
            transfer_id=transfer_id,
            reason=request.reason
        )
        
        return TransferResponse(
            transfer_id=transfer_id,
            status="success",
            message="Transfer cancelled successfully",
            data=result
        )
        
    except ValueError as e:
        logger.error(f"Validation error cancelling transfer: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling transfer: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel transfer")

@router.get("/{transfer_id}/status")
async def get_transfer_status(transfer_id: str):
    """Get current transfer status"""
    try:
        status = await transfer_service.get_transfer_status(transfer_id)
        return status
        
    except ValueError as e:
        logger.error(f"Transfer not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting transfer status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get transfer status")

@router.get("/active")
async def list_active_transfers():
    """List all active transfers"""
    try:
        transfers = await transfer_service.list_active_transfers()
        return {
            "active_transfers": transfers,
            "count": len(transfers)
        }
        
    except Exception as e:
        logger.error(f"Error listing active transfers: {e}")
        raise HTTPException(status_code=500, detail="Failed to list active transfers")

@router.get("/history")
async def get_transfer_history(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    agent_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get transfer history with filtering"""
    try:
        query = db.query(Transfer)
        
        # Apply filters
        if status:
            query = query.filter(Transfer.status == status)
        
        if agent_id:
            # Find agent by agent_id
            agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
            if agent:
                query = query.filter(
                    (Transfer.source_agent_id == agent.id) | 
                    (Transfer.target_agent_id == agent.id)
                )
        
        # Apply pagination
        transfers = query.offset(offset).limit(limit).all()
        total = query.count()
        
        # Convert to response format
        transfer_list = []
        for transfer in transfers:
            transfer_data = {
                "transfer_id": transfer.transfer_id,
                "call_id": transfer.call.call_id if transfer.call else None,
                "source_agent": transfer.source_agent.name if transfer.source_agent else None,
                "target_agent": transfer.target_agent.name if transfer.target_agent else None,
                "status": transfer.status,
                "transfer_type": transfer.transfer_type,
                "initiated_at": transfer.initiated_at.isoformat() if transfer.initiated_at else None,
                "completed_at": transfer.completed_at.isoformat() if transfer.completed_at else None,
                "duration_seconds": transfer.duration_seconds,
                "was_successful": transfer.was_successful,
                "reason": transfer.reason
            }
            transfer_list.append(transfer_data)
        
        return {
            "transfers": transfer_list,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error getting transfer history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get transfer history")

@router.get("/{transfer_id}/details")
async def get_transfer_details(transfer_id: str, db: Session = Depends(get_db)):
    """Get detailed transfer information"""
    try:
        transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
        
        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")
        
        # Build detailed response
        details = {
            "transfer_id": transfer.transfer_id,
            "status": transfer.status,
            "transfer_type": transfer.transfer_type,
            "reason": transfer.reason,
            "initiated_at": transfer.initiated_at.isoformat() if transfer.initiated_at else None,
            "completed_at": transfer.completed_at.isoformat() if transfer.completed_at else None,
            "duration_seconds": transfer.duration_seconds,
            "was_successful": transfer.was_successful,
            "agent_feedback": transfer.agent_feedback,
            "call": {
                "call_id": transfer.call.call_id,
                "caller_name": transfer.call.caller_name,
                "status": transfer.call.status,
                "started_at": transfer.call.started_at.isoformat() if transfer.call.started_at else None
            } if transfer.call else None,
            "source_agent": {
                "agent_id": transfer.source_agent.agent_id,
                "name": transfer.source_agent.name,
                "email": transfer.source_agent.email
            } if transfer.source_agent else None,
            "target_agent": {
                "agent_id": transfer.target_agent.agent_id,
                "name": transfer.target_agent.name,
                "email": transfer.target_agent.email
            } if transfer.target_agent else None,
            "ai_summary": transfer.ai_summary,
            "ai_context": transfer.ai_context,
            "sentiment_analysis": transfer.sentiment_analysis,
            "escalation_assessment": transfer.escalation_assessment
        }
        
        return details
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transfer details: {e}")
        raise HTTPException(status_code=500, detail="Failed to get transfer details")

async def update_transfer_analytics(transfer_id: str, success: bool):
    """Background task to update analytics after transfer completion"""
    try:
        # This would update analytics tables, send metrics, etc.
        logger.info(f"📊 Updating analytics for transfer {transfer_id}, success: {success}")
        # Implementation would go here
    except Exception as e:
        logger.error(f"Failed to update analytics for transfer {transfer_id}: {e}")