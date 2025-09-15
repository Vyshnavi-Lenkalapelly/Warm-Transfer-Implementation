from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.websocket_manager import ConnectionManager
from app.models.agent import Agent

logger = logging.getLogger(__name__)

router = APIRouter()

# Global services
connection_manager = ConnectionManager()

# Pydantic models
class AgentCreateRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    max_concurrent_calls: Optional[int] = 3

class AgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    max_concurrent_calls: Optional[int] = None
    is_available: Optional[bool] = None

class AgentStatusRequest(BaseModel):
    status: str  # online, busy, away, offline

class AgentResponse(BaseModel):
    agent_id: str
    status: str
    message: str
    data: dict = {}

@router.post("/create", response_model=AgentResponse)
async def create_agent(
    request: AgentCreateRequest,
    db: Session = Depends(get_db)
):
    """Create a new agent"""
    try:
        # Check if email already exists
        existing_agent = db.query(Agent).filter(Agent.email == request.email).first()
        if existing_agent:
            raise HTTPException(status_code=400, detail="Agent with this email already exists")
        
        agent_id = str(uuid.uuid4())
        
        agent = Agent(
            agent_id=agent_id,
            name=request.name,
            email=request.email,
            phone=request.phone,
            skills=request.skills or [],
            languages=request.languages or ["en"],
            max_concurrent_calls=request.max_concurrent_calls or 3,
            status="offline",
            is_available=True
        )
        
        db.add(agent)
        db.commit()
        db.refresh(agent)
        
        logger.info(f"✅ Created agent {agent_id}: {request.name}")
        
        return AgentResponse(
            agent_id=agent_id,
            status="success",
            message="Agent created successfully",
            data={
                "agent_id": agent_id,
                "name": agent.name,
                "email": agent.email,
                "status": agent.status
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to create agent")

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    request: AgentUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update agent information"""
    try:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Update fields if provided
        if request.name is not None:
            agent.name = request.name
        if request.phone is not None:
            agent.phone = request.phone
        if request.skills is not None:
            agent.skills = request.skills
        if request.languages is not None:
            agent.languages = request.languages
        if request.max_concurrent_calls is not None:
            agent.max_concurrent_calls = request.max_concurrent_calls
        if request.is_available is not None:
            agent.is_available = request.is_available
        
        agent.updated_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"✅ Updated agent {agent_id}")
        
        return AgentResponse(
            agent_id=agent_id,
            status="success",
            message="Agent updated successfully",
            data={
                "agent_id": agent_id,
                "name": agent.name,
                "email": agent.email,
                "status": agent.status,
                "is_available": agent.is_available
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to update agent")

@router.post("/{agent_id}/status", response_model=AgentResponse)
async def update_agent_status(
    agent_id: str,
    request: AgentStatusRequest,
    db: Session = Depends(get_db)
):
    """Update agent status (online, busy, away, offline)"""
    try:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        valid_statuses = ["online", "busy", "away", "offline"]
        if request.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        old_status = agent.status
        agent.status = request.status
        agent.last_active = datetime.utcnow()
        
        # Update availability based on status
        agent.is_available = request.status == "online"
        
        db.commit()
        
        # Notify via WebSocket if agent is connected
        await connection_manager.send_personal_message(
            {
                "type": "status_updated",
                "agent_id": agent_id,
                "old_status": old_status,
                "new_status": request.status,
                "timestamp": datetime.utcnow().isoformat()
            },
            agent_id
        )
        
        logger.info(f"✅ Updated agent {agent_id} status from {old_status} to {request.status}")
        
        return AgentResponse(
            agent_id=agent_id,
            status="success",
            message=f"Agent status updated to {request.status}",
            data={
                "agent_id": agent_id,
                "status": agent.status,
                "is_available": agent.is_available,
                "last_active": agent.last_active.isoformat()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update agent status")

@router.get("/{agent_id}")
async def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Get agent information"""
    try:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {
            "agent_id": agent.agent_id,
            "name": agent.name,
            "email": agent.email,
            "phone": agent.phone,
            "skills": agent.skills,
            "languages": agent.languages,
            "status": agent.status,
            "is_available": agent.is_available,
            "current_calls": agent.current_calls,
            "max_concurrent_calls": agent.max_concurrent_calls,
            "total_calls_handled": agent.total_calls_handled,
            "successful_transfers": agent.successful_transfers,
            "average_call_duration": agent.average_call_duration,
            "customer_satisfaction_rating": agent.customer_satisfaction_rating,
            "last_active": agent.last_active.isoformat() if agent.last_active else None,
            "created_at": agent.created_at.isoformat() if agent.created_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to get agent")

@router.get("/")
async def list_agents(
    status: Optional[str] = None,
    available: Optional[bool] = None,
    skills: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List agents with filtering"""
    try:
        query = db.query(Agent)
        
        # Apply filters
        if status:
            query = query.filter(Agent.status == status)
        
        if available is not None:
            query = query.filter(Agent.is_available == available)
        
        if skills:
            # Filter by skill (assuming skills is a JSON array)
            query = query.filter(Agent.skills.contains([skills]))
        
        # Order by name
        query = query.order_by(Agent.name)
        
        # Apply pagination
        agents = query.offset(offset).limit(limit).all()
        total = query.count()
        
        # Convert to response format
        agents_data = []
        for agent in agents:
            agent_data = {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "email": agent.email,
                "status": agent.status,
                "is_available": agent.is_available,
                "current_calls": agent.current_calls,
                "max_concurrent_calls": agent.max_concurrent_calls,
                "skills": agent.skills,
                "languages": agent.languages,
                "total_calls_handled": agent.total_calls_handled,
                "successful_transfers": agent.successful_transfers,
                "customer_satisfaction_rating": agent.customer_satisfaction_rating,
                "last_active": agent.last_active.isoformat() if agent.last_active else None
            }
            agents_data.append(agent_data)
        
        return {
            "agents": agents_data,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error listing agents: {e}")
        raise HTTPException(status_code=500, detail="Failed to list agents")

@router.get("/available/list")
async def list_available_agents(
    skills: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List available agents for transfer"""
    try:
        query = db.query(Agent).filter(
            Agent.is_available == True,
            Agent.status == "online",
            Agent.current_calls < Agent.max_concurrent_calls
        )
        
        if skills:
            query = query.filter(Agent.skills.contains([skills]))
        
        agents = query.order_by(Agent.current_calls.asc()).all()  # Least busy first
        
        available_agents = []
        for agent in agents:
            agent_data = {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "current_calls": agent.current_calls,
                "max_concurrent_calls": agent.max_concurrent_calls,
                "capacity_percentage": (agent.current_calls / agent.max_concurrent_calls) * 100,
                "skills": agent.skills,
                "languages": agent.languages,
                "customer_satisfaction_rating": agent.customer_satisfaction_rating,
                "total_calls_handled": agent.total_calls_handled
            }
            available_agents.append(agent_data)
        
        return {
            "available_agents": available_agents,
            "count": len(available_agents)
        }
        
    except Exception as e:
        logger.error(f"Error listing available agents: {e}")
        raise HTTPException(status_code=500, detail="Failed to list available agents")

@router.get("/{agent_id}/performance")
async def get_agent_performance(
    agent_id: str,
    db: Session = Depends(get_db)
):
    """Get agent performance metrics"""
    try:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Calculate additional metrics
        transfer_success_rate = 0
        if agent.total_calls_handled > 0:
            transfer_success_rate = (agent.successful_transfers / agent.total_calls_handled) * 100
        
        utilization_rate = (agent.current_calls / agent.max_concurrent_calls) * 100
        
        performance_metrics = {
            "agent_id": agent.agent_id,
            "name": agent.name,
            "total_calls_handled": agent.total_calls_handled,
            "successful_transfers": agent.successful_transfers,
            "transfer_success_rate": round(transfer_success_rate, 2),
            "average_call_duration": agent.average_call_duration,
            "customer_satisfaction_rating": agent.customer_satisfaction_rating,
            "current_utilization": round(utilization_rate, 2),
            "max_concurrent_calls": agent.max_concurrent_calls,
            "status": agent.status,
            "last_active": agent.last_active.isoformat() if agent.last_active else None
        }
        
        return performance_metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to get agent performance")

@router.post("/{agent_id}/connect")
async def connect_agent_websocket(
    agent_id: str,
    client_id: str,
    db: Session = Depends(get_db)
):
    """Register agent WebSocket connection"""
    try:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Register agent connection
        await connection_manager.register_agent(agent_id, client_id)
        
        # Update agent status if they're connecting
        if agent.status == "offline":
            agent.status = "online"
            agent.is_available = True
            agent.last_active = datetime.utcnow()
            db.commit()
        
        return {
            "agent_id": agent_id,
            "status": "connected",
            "message": "Agent WebSocket connection registered"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting agent WebSocket: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect agent")

@router.post("/{agent_id}/disconnect")
async def disconnect_agent_websocket(
    agent_id: str,
    db: Session = Depends(get_db)
):
    """Unregister agent WebSocket connection"""
    try:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Unregister agent connection
        await connection_manager.unregister_agent(agent_id)
        
        # Update agent status
        agent.status = "offline"
        agent.is_available = False
        agent.last_active = datetime.utcnow()
        db.commit()
        
        return {
            "agent_id": agent_id,
            "status": "disconnected",
            "message": "Agent WebSocket connection unregistered"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting agent WebSocket: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect agent")