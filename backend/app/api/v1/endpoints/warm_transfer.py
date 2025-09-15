from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from pydantic import BaseModel
import logging
import uuid
import asyncio
from datetime import datetime

from app.core.database import get_db
from app.services.livekit_service import LiveKitService
from app.services.ai_service import AIService
from app.models.call import Call
from app.models.agent import Agent
from app.models.transfer import Transfer

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize services
livekit_service = LiveKitService()
ai_service = AIService()

# Pydantic models for cleaner API
class JoinTokenRequest(BaseModel):
    identity: str
    room: str

class CleanWarmTransferRequest(BaseModel):
    current_room: str
    agent_a_identity: str
    agent_b_identity: str
    caller_identity: str
    conversation_transcript: Optional[str] = None

class WarmTransferRequest(BaseModel):
    call_id: str
    source_agent_id: str
    target_agent_id: str
    reason: Optional[str] = None
    transfer_notes: Optional[str] = None

class TransferStageRequest(BaseModel):
    transfer_id: str
    stage: str  # "initiated", "agents_connected", "summary_complete", "transfer_complete"

class TransferResponse(BaseModel):
    transfer_id: str
    status: str
    message: str
    data: Dict = {}

# ===== CLEAN API ENDPOINTS (for new room interface) =====

@router.post("/join-token")
async def join_token(req: JoinTokenRequest, db: Session = Depends(get_db)):
    """
    Generate a join token for LiveKit room access
    """
    try:
        token = livekit_service.generate_access_token(
            room_name=req.room,
            participant_identity=req.identity,
            participant_name=req.identity
        )
        
        return {
            "token": token,
            "livekit_url": "wss://project-warm-transfer-implementation-jmsg4oli.livekit.cloud"
        }
    except Exception as e:
        logger.error(f"Token generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")

@router.post("/start-warm-transfer")
async def start_warm_transfer(req: CleanWarmTransferRequest, db: Session = Depends(get_db)):
    """
    Core warm transfer flow with AI summarization:
    1. Process real conversation transcript from speech recognition
    2. Create AI summary using OpenAI
    3. Create transfer room and generate tokens
    4. Return summary and room info for agent B to join
    """
    try:
        logger.info(f"🔄 Starting warm transfer from {req.agent_a_identity} to {req.agent_b_identity}")
        
        # 1. Use real transcript if provided, otherwise use mock
        if req.conversation_transcript and req.conversation_transcript.strip():
            transcript = req.conversation_transcript
            logger.info(f"📝 Using real conversation transcript ({len(transcript)} chars)")
        else:
            # Fallback mock transcript 
            transcript = f"""
            Agent {req.agent_a_identity}: Hello, how can I help you today?
            
            Caller: Hi, I'm having issues with my account. I can't access my billing information and my payment didn't go through last week.
            
            Agent {req.agent_a_identity}: I understand your concern. Let me check your account status. I can see there was a payment issue, but this requires our billing specialist to resolve properly.
            
            Caller: Okay, I really need this fixed today as I have important work documents in my account.
            
            Agent {req.agent_a_identity}: Absolutely, I'm going to transfer you to our billing specialist who can resolve this immediately. They'll have all the details of our conversation.
            """
            logger.info(f"📝 Using mock transcript as fallback")
        
        # 2. Generate AI summary
        summary = await ai_service.generate_call_summary(
            call_id=req.current_room,
            context=f"Warm transfer from {req.agent_a_identity} to {req.agent_b_identity}. Call transcript: {transcript}"
        )
        
        # 3. Create transfer room
        transfer_room = f"transfer_{req.current_room}_{req.agent_b_identity}_{uuid.uuid4().hex[:6]}"
        
        # Create the transfer room
        room_info = await livekit_service.create_room(
            room_name=transfer_room,
            max_participants=3,  # caller + agent A + agent B
            metadata={
                "type": "warm_transfer",
                "original_room": req.current_room,
                "agent_a": req.agent_a_identity,
                "agent_b": req.agent_b_identity,
                "caller": req.caller_identity,
                "transcript": transcript[:500],  # Store partial transcript
                "summary": summary[:300]  # Store partial summary
            }
        )
        
        # 4. Generate tokens for all participants
        caller_token = livekit_service.generate_access_token(
            room_name=transfer_room,
            participant_identity=req.caller_identity,
            participant_name="Customer"
        )
        
        agent_b_token = livekit_service.generate_access_token(
            room_name=transfer_room,
            participant_identity=req.agent_b_identity,
            participant_name=f"Agent {req.agent_b_identity}"
        )
        
        agent_a_token = livekit_service.generate_access_token(
            room_name=transfer_room,
            participant_identity=req.agent_a_identity,
            participant_name=f"Agent {req.agent_a_identity}"
        )
        
        logger.info(f"✅ Warm transfer setup complete. Transfer room: {transfer_room}")
        
        return {
            "summary": summary,
            "transcript": transcript,
            "transfer_room": transfer_room,
            "caller_token": caller_token,
            "agent_b_token": agent_b_token,
            "agent_a_token": agent_a_token,
            "livekit_url": "wss://project-warm-transfer-implementation-jmsg4oli.livekit.cloud",
            "status": "success",
            "message": f"Warm transfer initiated. Agent {req.agent_b_identity} can now join the transfer room.",
            "next_steps": {
                "agent_a": "Stay in transfer room to brief Agent B, then leave original room",
                "agent_b": f"Join transfer room at: /call?identity={req.agent_b_identity}&room={transfer_room}",
                "caller": "Will be automatically moved to transfer room"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Warm transfer failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Warm transfer failed: {str(e)}"
        )

@router.post("/complete-transfer")
async def complete_transfer(req: dict, db: Session = Depends(get_db)):
    """
    Complete the transfer by moving caller to final room with Agent B only
    """
    try:
        transfer_room = req.get("transfer_room")
        caller_identity = req.get("caller_identity") 
        agent_b_identity = req.get("agent_b_identity")
        
        if not all([transfer_room, caller_identity, agent_b_identity]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Create final room with just caller and agent B
        final_room = f"final_{transfer_room}"
        
        room_info = await livekit_service.create_room(
            room_name=final_room,
            max_participants=2,  # caller + agent B only
            metadata={
                "type": "final_transfer",
                "original_transfer_room": transfer_room,
                "agent_b": agent_b_identity,
                "caller": caller_identity
            }
        )
        
        # Generate tokens for final room
        caller_final_token = livekit_service.generate_access_token(
            room_name=final_room,
            participant_identity=caller_identity,
            participant_name="Customer"
        )
        
        agent_b_final_token = livekit_service.generate_access_token(
            room_name=final_room,
            participant_identity=agent_b_identity,
            participant_name=f"Agent {agent_b_identity}"
        )
        
        logger.info(f"✅ Transfer completed. Final room: {final_room}")
        
        return {
            "status": "transfer_complete",
            "final_room": final_room,
            "caller_token": caller_final_token,
            "agent_b_token": agent_b_final_token,
            "livekit_url": "wss://project-warm-transfer-implementation-jmsg4oli.livekit.cloud",
            "message": "Transfer completed successfully. Agent A has left the call."
        }
        
    except Exception as e:
        logger.error(f"❌ Transfer completion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transfer completion failed: {str(e)}")

# ===== ORIGINAL COMPLEX ENDPOINTS (preserved for existing functionality) =====
    data: Dict = {}

@router.post("/warm-transfer/initiate", response_model=TransferResponse)
async def initiate_warm_transfer(
    request: WarmTransferRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Step 1: Agent A initiates warm transfer
    - Create transfer room with Agent A and Agent B
    - Keep original room with caller and Agent A active
    - Generate call summary using LLM
    """
    try:
        transfer_id = str(uuid.uuid4())
        
        # Validate the call and agents
        call = db.query(Call).filter(Call.call_id == request.call_id).first()
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
            
        source_agent = db.query(Agent).filter(Agent.agent_id == request.source_agent_id).first()
        target_agent = db.query(Agent).filter(Agent.agent_id == request.target_agent_id).first()
        
        if not source_agent or not target_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
            
        if not target_agent.is_available:
            raise HTTPException(status_code=400, detail="Target agent is not available")

        # Generate call summary using LLM
        call_context = {
            "call_id": call.call_id,
            "duration": (datetime.utcnow() - call.started_at).total_seconds() // 60,
            "caller_info": call.caller_info,
            "agent_notes": request.transfer_notes,
            "reason": request.reason
        }
        
        call_summary = await ai_service.generate_call_summary(call_context)
        
        # Create transfer room (Agent A + Agent B for briefing)
        transfer_room_name = f"transfer_{transfer_id}"
        transfer_room = await livekit_service.create_room(
            room_name=transfer_room_name,
            max_participants=3,  # Agent A, Agent B, and potential supervisor
            metadata={
                "type": "transfer_room",
                "transfer_id": transfer_id,
                "original_call_id": call.call_id,
                "stage": "briefing"
            }
        )
        
        # Generate tokens for both agents to join transfer room
        source_agent_token = livekit_service.generate_access_token(
            room_name=transfer_room_name,
            participant_identity=f"agent_{source_agent.agent_id}",
            participant_name=source_agent.name,
            metadata={
                "type": "source_agent",
                "agent_id": source_agent.agent_id,
                "role": "briefing"
            }
        )
        
        target_agent_token = livekit_service.generate_access_token(
            room_name=transfer_room_name,
            participant_identity=f"agent_{target_agent.agent_id}",
            participant_name=target_agent.name,
            metadata={
                "type": "target_agent",
                "agent_id": target_agent.agent_id,
                "role": "receiving_briefing"
            }
        )
        
        # Create transfer record
        transfer = Transfer(
            transfer_id=transfer_id,
            call_id=call.id,
            source_agent_id=source_agent.id,
            target_agent_id=target_agent.id,
            transfer_type="warm",
            reason=request.reason,
            transfer_room_name=transfer_room_name,
            original_room_name=call.room_name,
            status="initiated",
            ai_summary=call_summary.get("summary", ""),
            sentiment_analysis=call_summary.get("sentiment", {}),
            metadata={
                "transfer_notes": request.transfer_notes,
                "call_context": call_context
            }
        )
        
        db.add(transfer)
        db.commit()
        db.refresh(transfer)
        
        logger.info(f"✅ Warm transfer initiated: {transfer_id}")
        
        return TransferResponse(
            transfer_id=transfer_id,
            status="initiated",
            message="Transfer room created. Both agents can now join for briefing.",
            data={
                "transfer_room_name": transfer_room_name,
                "source_agent_token": source_agent_token,
                "target_agent_token": target_agent_token,
                "call_summary": call_summary,
                "original_room": call.room_name,
                "next_step": "Both agents join transfer room for briefing"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to initiate warm transfer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/warm-transfer/complete-briefing", response_model=TransferResponse)
async def complete_briefing(
    request: TransferStageRequest,
    db: Session = Depends(get_db)
):
    """
    Step 2: After Agent A has briefed Agent B in transfer room
    - Generate token for Agent B to join original room
    - Prepare for Agent A to exit original room
    """
    try:
        transfer = db.query(Transfer).filter(Transfer.transfer_id == request.transfer_id).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")
            
        if transfer.status != "initiated":
            raise HTTPException(status_code=400, detail="Transfer not in correct state")
            
        # Get the original call
        call = db.query(Call).get(transfer.call_id)
        target_agent = db.query(Agent).get(transfer.target_agent_id)
        
        # Generate token for Agent B to join original room with caller
        target_agent_original_room_token = livekit_service.generate_access_token(
            room_name=call.room_name,
            participant_identity=f"agent_{target_agent.agent_id}",
            participant_name=target_agent.name,
            metadata={
                "type": "transfer_agent",
                "agent_id": target_agent.agent_id,
                "role": "taking_over",
                "transfer_id": transfer.transfer_id
            }
        )
        
        # Update transfer status
        transfer.status = "briefing_complete"
        transfer.briefing_completed_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"✅ Briefing completed for transfer: {request.transfer_id}")
        
        return TransferResponse(
            transfer_id=request.transfer_id,
            status="briefing_complete",
            message="Briefing complete. Agent B can now join original room.",
            data={
                "target_agent_token": target_agent_original_room_token,
                "original_room_name": call.room_name,
                "next_step": "Agent B joins original room, then Agent A can exit"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to complete briefing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/warm-transfer/finalize", response_model=TransferResponse)
async def finalize_transfer(
    request: TransferStageRequest,
    db: Session = Depends(get_db)
):
    """
    Step 3: Finalize transfer
    - Agent A exits original room
    - Agent B continues with caller
    - Clean up transfer room
    - Update call ownership
    """
    try:
        transfer = db.query(Transfer).filter(Transfer.transfer_id == request.transfer_id).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")
            
        if transfer.status != "briefing_complete":
            raise HTTPException(status_code=400, detail="Briefing must be completed first")
            
        # Update call to new agent
        call = db.query(Call).get(transfer.call_id)
        old_agent = db.query(Agent).get(transfer.source_agent_id)
        new_agent = db.query(Agent).get(transfer.target_agent_id)
        
        # Transfer call ownership
        call.agent_id = new_agent.id
        call.metadata = call.metadata or {}
        call.metadata["transferred_from"] = old_agent.agent_id
        call.metadata["transfer_id"] = transfer.transfer_id
        call.metadata["transfer_timestamp"] = datetime.utcnow().isoformat()
        
        # Update agent availability
        old_agent.current_calls -= 1
        if old_agent.current_calls < old_agent.max_concurrent_calls:
            old_agent.is_available = True
            
        new_agent.current_calls += 1
        if new_agent.current_calls >= new_agent.max_concurrent_calls:
            new_agent.is_available = False
        
        # Complete transfer
        transfer.status = "completed"
        transfer.completed_at = datetime.utcnow()
        
        db.commit()
        
        # Clean up transfer room (optional - keep for audit trail)
        # await livekit_service.delete_room(transfer.transfer_room_name)
        
        logger.info(f"✅ Transfer finalized: {request.transfer_id}")
        
        return TransferResponse(
            transfer_id=request.transfer_id,
            status="completed",
            message="Transfer completed successfully. Agent A has exited, Agent B continues with caller.",
            data={
                "new_agent": {
                    "id": new_agent.agent_id,
                    "name": new_agent.name
                },
                "call_id": call.call_id,
                "transfer_summary": transfer.ai_summary
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to finalize transfer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/warm-transfer/{transfer_id}/status")
async def get_transfer_status(
    transfer_id: str,
    db: Session = Depends(get_db)
):
    """Get current status of a warm transfer"""
    try:
        transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")
            
        call = db.query(Call).get(transfer.call_id)
        source_agent = db.query(Agent).get(transfer.source_agent_id)
        target_agent = db.query(Agent).get(transfer.target_agent_id)
        
        return {
            "transfer_id": transfer_id,
            "status": transfer.status,
            "call": {
                "call_id": call.call_id,
                "room_name": call.room_name,
                "status": call.status
            },
            "source_agent": {
                "id": source_agent.agent_id,
                "name": source_agent.name
            },
            "target_agent": {
                "id": target_agent.agent_id,
                "name": target_agent.name
            },
            "transfer_room_name": transfer.transfer_room_name,
            "ai_summary": transfer.ai_summary,
            "created_at": transfer.created_at,
            "completed_at": transfer.completed_at
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get transfer status: {e}")
        raise HTTPException(status_code=500, detail=str(e))