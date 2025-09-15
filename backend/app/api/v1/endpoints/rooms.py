from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.services.livekit_service import LiveKitService

logger = logging.getLogger(__name__)

router = APIRouter()

# Global services
livekit_service = LiveKitService()

# Pydantic models
class RoomCreateRequest(BaseModel):
    room_name: Optional[str] = None
    max_participants: Optional[int] = 10
    metadata: Optional[dict] = None

class JoinRoomRequest(BaseModel):
    participant_identity: str
    participant_name: Optional[str] = None
    role: Optional[str] = "participant"
    metadata: Optional[dict] = None

@router.post("/create")
async def create_room(request: RoomCreateRequest):
    """Create a new LiveKit room"""
    try:
        result = await livekit_service.create_room(
            room_name=request.room_name,
            max_participants=request.max_participants or 10,
            metadata=request.metadata
        )
        
        return {
            "status": "success",
            "message": "Room created successfully",
            "room": result
        }
        
    except Exception as e:
        logger.error(f"Error creating room: {e}")
        raise HTTPException(status_code=500, detail="Failed to create room")

@router.get("/{room_name}")
async def get_room_info(room_name: str):
    """Get room information and participants"""
    try:
        room_info = await livekit_service.get_room_info(room_name)
        
        if not room_info:
            raise HTTPException(status_code=404, detail="Room not found")
        
        return room_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting room info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get room info")

@router.post("/{room_name}/join")
async def join_room(room_name: str, request: JoinRoomRequest):
    """Join a room as a participant"""
    try:
        result = await livekit_service.add_participant_to_room(
            room_name=room_name,
            participant_identity=request.participant_identity,
            participant_name=request.participant_name,
            role=request.role,
            metadata=request.metadata
        )
        
        return {
            "status": "success",
            "message": f"Participant {request.participant_identity} joined room",
            "access_info": result
        }
        
    except Exception as e:
        logger.error(f"Error joining room: {e}")
        raise HTTPException(status_code=500, detail="Failed to join room")

@router.delete("/{room_name}/participants/{participant_identity}")
async def remove_participant(room_name: str, participant_identity: str):
    """Remove a participant from room"""
    try:
        success = await livekit_service.remove_participant_from_room(
            room_name=room_name,
            participant_identity=participant_identity
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to remove participant")
        
        return {
            "status": "success",
            "message": f"Participant {participant_identity} removed from room"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing participant: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove participant")

@router.delete("/{room_name}")
async def delete_room(room_name: str):
    """Delete a LiveKit room"""
    try:
        success = await livekit_service.delete_room(room_name)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete room")
        
        return {
            "status": "success",
            "message": f"Room {room_name} deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting room: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete room")

@router.get("/")
async def list_rooms():
    """List all active rooms"""
    try:
        active_rooms = await livekit_service.get_active_rooms()
        
        return {
            "rooms": active_rooms,
            "count": len(active_rooms)
        }
        
    except Exception as e:
        logger.error(f"Error listing rooms: {e}")
        raise HTTPException(status_code=500, detail="Failed to list rooms")

@router.post("/{room_name}/data")
async def send_data_to_room(
    room_name: str,
    data: dict,
    participant_identities: Optional[List[str]] = None
):
    """Send data message to room participants"""
    try:
        await livekit_service.send_data_to_room(
            room_name=room_name,
            data=data,
            participant_identities=participant_identities
        )
        
        return {
            "status": "success",
            "message": "Data sent to room participants"
        }
        
    except Exception as e:
        logger.error(f"Error sending data to room: {e}")
        raise HTTPException(status_code=500, detail="Failed to send data to room")