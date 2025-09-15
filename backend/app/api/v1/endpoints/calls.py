from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
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

logger = logging.getLogger(__name__)

router = APIRouter()

# Global services
livekit_service = LiveKitService()
ai_service = AIService()

# Pydantic models
class CallStartRequest(BaseModel):
    caller_name: Optional[str] = None
    caller_phone: Optional[str] = None
    caller_info: Optional[dict] = None
    priority: Optional[str] = "medium"
    agent_id: Optional[str] = None  # If specific agent requested

class CallEndRequest(BaseModel):
    reason: Optional[str] = None
    summary: Optional[str] = None
    customer_satisfaction: Optional[int] = None

class CallResponse(BaseModel):
    call_id: str
    status: str
    message: str
    data: dict = {}

@router.post("/start", response_model=CallResponse)
async def start_call(
    request: CallStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start a new call and connect to an available agent"""
    try:
        # Generate unique identifiers
        call_id = f"call_{uuid.uuid4().hex[:8]}"
        room_name = f"room_{uuid.uuid4().hex[:8]}"
        
        # Find available agent or use specific agent
        agent = None
        if request.agent_id:
            agent = db.query(Agent).filter(Agent.agent_id == request.agent_id).first()
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
        else:
            # Find first available agent
            agent = db.query(Agent).filter(
                Agent.is_available == True,
                Agent.status == "online"
            ).first()
            
            if not agent:
                raise HTTPException(status_code=503, detail="No agents available")
        
        # Create LiveKit room
        room_info = await livekit_service.create_room(
            room_name=room_name,
            max_participants=5,  # Customer + agent + potential transfer agents
            metadata={
                "call_id": call_id,
                "type": "call",
                "created_by": agent.agent_id
            }
        )
        
        # Generate tokens for participants
        caller_identity = f"caller_{uuid.uuid4().hex[:8]}"
        agent_identity = agent.agent_id
        
        caller_token = livekit_service.generate_access_token(
            room_name=room_name,
            participant_identity=caller_identity,
            participant_name=request.caller_name or "Customer",
            metadata={
                "type": "customer",
                "phone": request.caller_phone,
                "call_id": call_id
            }
        )
        
        agent_token = livekit_service.generate_access_token(
            room_name=room_name,
            participant_identity=agent_identity,
            participant_name=agent.name,
            metadata={
                "type": "agent",
                "agent_id": agent.agent_id,
                "call_id": call_id
            }
        )
        
        # Create call record
        call = Call(
            call_id=call_id,
            caller_name=request.caller_name,
            caller_phone=request.caller_phone,
            caller_info={
                "name": request.caller_name,
                "phone": request.caller_phone,
                "identity": caller_identity,
                "agent_id": agent.agent_id,  # Store in caller_info instead
                **(request.caller_info or {})
            },
            room_name=room_name,
            status="active",
            priority=request.priority
        )
        
        db.add(call)
        db.commit()
        db.refresh(call)
        
        # Update agent status
        agent.current_calls += 1
        if agent.current_calls >= agent.max_concurrent_calls:
            agent.is_available = False
        db.commit()
        
        logger.info(f"✅ Started call {call_id} with agent {agent.agent_id}")
        
        return CallResponse(
            call_id=call_id,
            status="started",
            message="Call started successfully",
            data={
                "room_name": room_name,
                "caller_token": caller_token,
                "agent_token": agent_token,
                "room_info": room_info,
                "agent": {
                    "id": agent.agent_id,
                    "name": agent.name,
                    "skills": agent.skills
                }
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to start call: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/join-room")
async def join_room(
    room_name: str,
    participant_name: str,
    participant_type: str = "agent",
    agent_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Generate token to join an existing room"""
    try:
        # Verify room exists
        room_info = await livekit_service.get_room_info(room_name)
        if not room_info:
            raise HTTPException(status_code=404, detail="Room not found")
        
        # Generate unique identity
        participant_identity = f"{participant_type}_{uuid.uuid4().hex[:8]}"
        
        # Prepare metadata
        metadata = {
            "type": participant_type,
            "joined_at": datetime.utcnow().isoformat()
        }
        
        if agent_id:
            metadata["agent_id"] = agent_id
            # Verify agent exists
            agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
            if agent:
                metadata["agent_name"] = agent.name
                metadata["department"] = agent.department
        
        # Generate token
        token = livekit_service.generate_access_token(
            room_name=room_name,
            participant_identity=participant_identity,
            participant_name=participant_name,
            metadata=metadata
        )
        
        return {
            "token": token,
            "room_name": room_name,
            "participant_identity": participant_identity,
            "room_info": room_info
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to join room: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        call_id = str(uuid.uuid4())
        room_name = f"call_{call_id[:8]}"
        
        # Find available agent
        available_agent = None
        if request.agent_id:
            # Specific agent requested
            available_agent = db.query(Agent).filter(
                Agent.agent_id == request.agent_id,
                Agent.is_available == True,
                Agent.status == "online"
            ).first()
            
            if not available_agent:
                raise HTTPException(status_code=400, detail=f"Requested agent {request.agent_id} not available")
        else:
            # Find any available agent
            available_agent = db.query(Agent).filter(
                Agent.is_available == True,
                Agent.status == "online",
                Agent.current_calls < Agent.max_concurrent_calls
            ).first()
            
            if not available_agent:
                raise HTTPException(status_code=503, detail="No agents available")
        
        # Create LiveKit room
        room_info = await livekit_service.create_room(
            room_name=room_name,
            max_participants=5,  # Caller + Agent + potential transfer agents
            metadata={
                "type": "call",
                "call_id": call_id,
                "priority": request.priority
            }
        )
        
        # Create call record
        call = Call(
            call_id=call_id,
            caller_name=request.caller_name,
            caller_phone=request.caller_phone,
            caller_info=request.caller_info or {},
            room_name=room_name,
            livekit_room_id=room_info["room_id"],
            status="initiated",
            priority=request.priority
        )
        
        db.add(call)
        db.commit()
        db.refresh(call)
        
        # Generate access tokens
        caller_identity = f"caller_{call_id[:8]}"
        agent_identity = available_agent.agent_id
        
        # Caller access token
        caller_token = livekit_service.generate_access_token(
            room_name=room_name,
            participant_identity=caller_identity,
            participant_name=request.caller_name or "Caller",
            metadata={"role": "caller", "call_id": call_id}
        )
        
        # Agent access token
        agent_token = livekit_service.generate_access_token(
            room_name=room_name,
            participant_identity=agent_identity,
            participant_name=available_agent.name,
            metadata={"role": "agent", "call_id": call_id, "agent_id": available_agent.agent_id}
        )
        
        # Update agent status
        available_agent.current_calls += 1
        available_agent.total_calls_handled += 1
        available_agent.last_active = datetime.utcnow()
        db.commit()
        
        # Add background task for call monitoring
        background_tasks.add_task(monitor_call_start, call_id)
        
        result = {
            "call_id": call_id,
            "room_name": room_name,
            "ws_url": room_info["ws_url"],
            "caller_access": {
                "token": caller_token,
                "identity": caller_identity
            },
            "agent_access": {
                "token": agent_token,
                "identity": agent_identity,
                "name": available_agent.name
            },
            "agent_info": {
                "agent_id": available_agent.agent_id,
                "name": available_agent.name,
                "skills": available_agent.skills
            }
        }
        
        logger.info(f"✅ Started call {call_id} with agent {available_agent.agent_id}")
        
        return CallResponse(
            call_id=call_id,
            status="success",
            message="Call started successfully",
            data=result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting call: {e}")
        raise HTTPException(status_code=500, detail="Failed to start call")

@router.post("/{call_id}/end", response_model=CallResponse)
async def end_call(
    call_id: str,
    request: CallEndRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """End an active call"""
    try:
        call = db.query(Call).filter(Call.call_id == call_id).first()
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        if call.status == "ended":
            raise HTTPException(status_code=400, detail="Call already ended")
        
        # Update call record
        call.status = "ended"
        call.ended_at = datetime.utcnow()
        if call.started_at:
            call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())
        
        if request.summary:
            call.summary = request.summary
        
        db.commit()
        
        # Clean up LiveKit room
        await livekit_service.delete_room(call.room_name)
        
        # Update agent availability
        # Find agents who were on this call and update their status
        # This is simplified - in a real system you'd track participant history
        
        # Add background task for call analysis
        background_tasks.add_task(analyze_call_completion, call_id, request.customer_satisfaction)
        
        result = {
            "call_id": call_id,
            "duration_seconds": call.duration_seconds,
            "ended_at": call.ended_at.isoformat()
        }
        
        logger.info(f"✅ Ended call {call_id}")
        
        return CallResponse(
            call_id=call_id,
            status="success",
            message="Call ended successfully",
            data=result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending call: {e}")
        raise HTTPException(status_code=500, detail="Failed to end call")

@router.get("/{call_id}/status")
async def get_call_status(call_id: str, db: Session = Depends(get_db)):
    """Get current call status"""
    try:
        call = db.query(Call).filter(Call.call_id == call_id).first()
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # Get room info from LiveKit
        room_info = None
        if call.status in ["initiated", "active"]:
            room_info = await livekit_service.get_room_info(call.room_name)
        
        response = {
            "call_id": call.call_id,
            "status": call.status,
            "priority": call.priority,
            "caller_name": call.caller_name,
            "started_at": call.started_at.isoformat() if call.started_at else None,
            "ended_at": call.ended_at.isoformat() if call.ended_at else None,
            "duration_seconds": call.duration_seconds,
            "room_info": room_info
        }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting call status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get call status")

@router.get("/{call_id}/summary")
async def get_call_summary(call_id: str, db: Session = Depends(get_db)):
    """Get AI-generated call summary"""
    try:
        call = db.query(Call).filter(Call.call_id == call_id).first()
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # If summary already exists, return it
        if call.summary:
            return {
                "call_id": call_id,
                "summary": call.summary,
                "sentiment": call.sentiment,
                "urgency_level": call.urgency_level,
                "cached": True
            }
        
        # Generate new summary if call is ended
        if call.status == "ended":
            call_data = {
                "duration": call.duration_seconds / 60 if call.duration_seconds else 0,
                "caller_info": call.caller_info or {},
                "conversation_history": "Call completed",  # Would be actual conversation
                "current_issue": "Customer inquiry resolved",
                "agent_notes": "Call completed successfully"
            }
            
            ai_summary = await ai_service.generate_call_summary(call_data)
            
            # Update call record
            call.summary = ai_summary["summary"]
            call.sentiment = ai_summary["sentiment"].get("overall_sentiment", "neutral")
            call.urgency_level = ai_summary["sentiment"].get("urgency_level", "low")
            db.commit()
            
            return {
                "call_id": call_id,
                "summary": ai_summary["summary"],
                "sentiment": ai_summary["sentiment"],
                "provider": ai_summary["provider"],
                "generated_at": ai_summary["generated_at"],
                "cached": False
            }
        else:
            raise HTTPException(status_code=400, detail="Cannot generate summary for active call")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting call summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get call summary")

@router.get("/active")
async def list_active_calls(db: Session = Depends(get_db)):
    """List all active calls"""
    try:
        active_calls = db.query(Call).filter(
            Call.status.in_(["initiated", "active"])
        ).all()
        
        calls_data = []
        for call in active_calls:
            # Get room info
            room_info = await livekit_service.get_room_info(call.room_name)
            
            call_data = {
                "call_id": call.call_id,
                "caller_name": call.caller_name,
                "status": call.status,
                "priority": call.priority,
                "started_at": call.started_at.isoformat() if call.started_at else None,
                "room_name": call.room_name,
                "participants": room_info["participants"] if room_info else [],
                "participant_count": room_info["num_participants"] if room_info else 0
            }
            calls_data.append(call_data)
        
        return {
            "active_calls": calls_data,
            "count": len(calls_data)
        }
        
    except Exception as e:
        logger.error(f"Error listing active calls: {e}")
        raise HTTPException(status_code=500, detail="Failed to list active calls")

@router.get("/history")
async def get_call_history(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get call history with filtering"""
    try:
        query = db.query(Call)
        
        # Apply filters
        if status:
            query = query.filter(Call.status == status)
        
        if priority:
            query = query.filter(Call.priority == priority)
        
        # Order by most recent first
        query = query.order_by(Call.started_at.desc())
        
        # Apply pagination
        calls = query.offset(offset).limit(limit).all()
        total = query.count()
        
        # Convert to response format
        calls_data = []
        for call in calls:
            call_data = {
                "call_id": call.call_id,
                "caller_name": call.caller_name,
                "caller_phone": call.caller_phone,
                "status": call.status,
                "priority": call.priority,
                "started_at": call.started_at.isoformat() if call.started_at else None,
                "ended_at": call.ended_at.isoformat() if call.ended_at else None,
                "duration_seconds": call.duration_seconds,
                "summary": call.summary,
                "sentiment": call.sentiment
            }
            calls_data.append(call_data)
        
        return {
            "calls": calls_data,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error getting call history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get call history")

async def monitor_call_start(call_id: str):
    """Background task to monitor call start"""
    try:
        # Wait a bit for call to establish
        await asyncio.sleep(10)
        
        with next(get_db()) as db:
            call = db.query(Call).filter(Call.call_id == call_id).first()
            if call and call.status == "initiated":
                # Check if anyone joined the room
                room_info = await livekit_service.get_room_info(call.room_name)
                if room_info and room_info["num_participants"] > 0:
                    call.status = "active"
                    db.commit()
                    logger.info(f"📞 Call {call_id} is now active")
    except Exception as e:
        logger.error(f"Error monitoring call start: {e}")

class BriefingRoomRequest(BaseModel):
    original_room: str
    source_agent_id: str
    target_agent_id: str
    summary: str

@router.post("/create-briefing-room")
async def create_briefing_room(
    request: BriefingRoomRequest,
    db: Session = Depends(get_db)
):
    """Create a briefing room for warm transfer Agent A + Agent B"""
    try:
        logger.info(f"🏢 Creating briefing room for transfer from {request.source_agent_id} to {request.target_agent_id}")
        
        # Generate unique briefing room name
        briefing_room_name = f"briefing_{request.source_agent_id}_{request.target_agent_id}_{int(datetime.now().timestamp())}"
        
        # Create the briefing room
        room_info = await livekit_service.create_room(
            room_name=briefing_room_name,
            max_participants=3,  # Agent A, Agent B, AI
            metadata={
                "type": "briefing",
                "original_room": request.original_room,
                "summary": request.summary,
                "transfer_time": datetime.now().isoformat()
            }
        )
        
        # Generate tokens for both agents
        source_token = await livekit_service.create_access_token(
            room_name=briefing_room_name,
            identity=f"agent_{request.source_agent_id}",
            metadata={"role": "source_agent", "name": f"Agent {request.source_agent_id}"}
        )
        
        target_token = await livekit_service.create_access_token(
            room_name=briefing_room_name,
            identity=f"agent_{request.target_agent_id}",
            metadata={"role": "target_agent", "name": f"Agent {request.target_agent_id}"}
        )
        
        # AI token for speaking summary
        ai_token = await livekit_service.create_access_token(
            room_name=briefing_room_name,
            identity="ai_assistant",
            metadata={"role": "ai_assistant", "name": "AI Assistant"}
        )
        
        logger.info(f"✅ Briefing room {briefing_room_name} created successfully")
        
        return {
            "success": True,
            "briefing_room": briefing_room_name,
            "source_token": source_token,
            "target_token": target_token,
            "ai_token": ai_token,
            "room_info": room_info,
            "message": "Briefing room created for warm transfer"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to create briefing room: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create briefing room: {e}"
        )

async def analyze_call_completion(call_id: str, customer_satisfaction: Optional[int]):
    """Background task to analyze completed call"""
    try:
        logger.info(f"📊 Analyzing completed call {call_id}")
        # This would perform post-call analysis, update metrics, etc.
        # Implementation would include:
        # - Generate detailed call summary
        # - Update agent performance metrics
        # - Update customer satisfaction scores
        # - Trigger any follow-up actions
    except Exception as e:
        logger.error(f"Error analyzing call completion: {e}")