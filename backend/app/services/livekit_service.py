from livekit import api, rtc
from livekit.api import AccessToken, VideoGrants
import asyncio
import logging
from typing import Dict, List, Optional, Set
from datetime import datetime, timedelta
import json
import uuid

from app.core.config import settings
from app.core.database import get_redis

logger = logging.getLogger(__name__)

class LiveKitService:
    """LiveKit service for managing rooms, participants, and transfers"""
    
    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.ws_url = settings.LIVEKIT_WS_URL
        
        # Initialize LiveKit API client lazily to avoid event loop issues
        self.lk_api = None
        
        # Active rooms and participants tracking
        self.active_rooms: Dict[str, dict] = {}
        self.active_transfers: Dict[str, dict] = {}
        self.participant_sessions: Dict[str, dict] = {}
        
        # Room event handlers
        self.room_handlers: Dict[str, callable] = {}

    def _get_api_client(self):
        """Get or initialize the LiveKit API client"""
        if self.lk_api is None:
            self.lk_api = api.LiveKitAPI(
                url=self.ws_url,
                api_key=self.api_key,
                api_secret=self.api_secret
            )
        return self.lk_api

    async def initialize(self):
        """Initialize LiveKit service"""
        try:
            # Test connection
            lk_api = self._get_api_client()
            rooms = await lk_api.room.list_rooms(api.ListRoomsRequest())
            logger.info(f"✅ LiveKit connected. Found {len(rooms.rooms)} existing rooms")
            
            # Clean up any stale rooms if needed
            await self._cleanup_stale_rooms()
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize LiveKit: {e}")
            raise

    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Close any remaining rooms
            for room_name in list(self.active_rooms.keys()):
                await self.delete_room(room_name)
            
            logger.info("✅ LiveKit cleanup completed")
        except Exception as e:
            logger.error(f"❌ LiveKit cleanup failed: {e}")

    async def health_check(self) -> dict:
        """Check LiveKit service health"""
        try:
            rooms = await self.lk_api.room.list_rooms(api.ListRoomsRequest())
            return {
                "status": "healthy",
                "total_rooms": len(rooms.rooms),
                "active_rooms": len(self.active_rooms),
                "active_transfers": len(self.active_transfers)
            }
        except Exception as e:
            logger.error(f"LiveKit health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}

    def generate_access_token(
        self, 
        room_name: str, 
        participant_identity: str, 
        participant_name: str = None,
        metadata: dict = None
    ) -> str:
        """Generate access token for participant"""
        token = AccessToken(self.api_key, self.api_secret)
        token.with_identity(participant_identity)
        token.with_name(participant_name or participant_identity)
        
        if metadata:
            token.with_metadata(json.dumps(metadata))
        
        # Grant permissions
        grant = VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        )
        token.with_grants(grant)
        
        # Token expires in 6 hours
        token.with_ttl(timedelta(hours=6))
        
        return token.to_jwt()

    async def create_room(
        self, 
        room_name: str = None, 
        max_participants: int = 10,
        metadata: dict = None
    ) -> dict:
        """Create a new LiveKit room"""
        if not room_name:
            room_name = f"room_{uuid.uuid4().hex[:8]}"
        
        try:
            # Create room configuration
            room_config = api.CreateRoomRequest(
                name=room_name,
                max_participants=max_participants,
                metadata=json.dumps(metadata or {})
            )
            
            # Create the room
            lk_api = self._get_api_client()
            room = await lk_api.room.create_room(room_config)
            
            # Track room locally
            self.active_rooms[room_name] = {
                "name": room_name,
                "created_at": datetime.utcnow(),
                "max_participants": max_participants,
                "metadata": metadata or {},
                "participants": {},
                "status": "active"
            }
            
            logger.info(f"✅ Created room: {room_name}")
            
            return {
                "room_name": room_name,
                "room_id": room.sid,
                "ws_url": self.ws_url,
                "created_at": room.creation_time,
                "max_participants": max_participants
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to create room {room_name}: {e}")
            raise Exception(f"Failed to create room: {e}")

    async def delete_room(self, room_name: str) -> bool:
        """Delete a LiveKit room"""
        try:
            # Delete from LiveKit
            lk_api = self._get_api_client()
            await lk_api.room.delete_room(api.DeleteRoomRequest(room=room_name))
            
            # Remove from local tracking
            if room_name in self.active_rooms:
                del self.active_rooms[room_name]
            
            logger.info(f"✅ Deleted room: {room_name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete room {room_name}: {e}")
            return False

    async def get_room_info(self, room_name: str) -> Optional[dict]:
        """Get room information"""
        try:
            # Get from LiveKit
            lk_api = self._get_api_client()
            rooms = await lk_api.room.list_rooms(
                api.ListRoomsRequest(names=[room_name])
            )
            
            if not rooms.rooms:
                return None
            
            room = rooms.rooms[0]
            
            # Get participants
            participants_response = await self.lk_api.room.list_participants(
                api.ListParticipantsRequest(room=room_name)
            )
            
            participants = []
            for p in participants_response.participants:
                participants.append({
                    "identity": p.identity,
                    "name": p.name,
                    "sid": p.sid,
                    "state": p.state.name,
                    "joined_at": p.joined_at,
                    "metadata": json.loads(p.metadata) if p.metadata else {}
                })
            
            return {
                "name": room.name,
                "sid": room.sid,
                "creation_time": room.creation_time,
                "num_participants": room.num_participants,
                "max_participants": room.max_participants,
                "participants": participants,
                "metadata": json.loads(room.metadata) if room.metadata else {}
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get room info for {room_name}: {e}")
            return None

    async def add_participant_to_room(
        self, 
        room_name: str, 
        participant_identity: str,
        participant_name: str = None,
        role: str = "participant",
        metadata: dict = None
    ) -> dict:
        """Add participant to room and return access token"""
        try:
            # Generate access token
            token = self.generate_access_token(
                room_name=room_name,
                participant_identity=participant_identity,
                participant_name=participant_name,
                metadata=metadata
            )
            
            # Track participant
            if room_name in self.active_rooms:
                self.active_rooms[room_name]["participants"][participant_identity] = {
                    "identity": participant_identity,
                    "name": participant_name or participant_identity,
                    "role": role,
                    "joined_at": datetime.utcnow(),
                    "metadata": metadata or {}
                }
            
            # Track session
            self.participant_sessions[participant_identity] = {
                "room_name": room_name,
                "joined_at": datetime.utcnow(),
                "role": role
            }
            
            logger.info(f"✅ Added participant {participant_identity} to room {room_name}")
            
            return {
                "access_token": token,
                "room_name": room_name,
                "ws_url": self.ws_url,
                "participant_identity": participant_identity,
                "role": role
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to add participant {participant_identity} to room {room_name}: {e}")
            raise Exception(f"Failed to add participant: {e}")

    async def remove_participant_from_room(
        self, 
        room_name: str, 
        participant_identity: str
    ) -> bool:
        """Remove participant from room"""
        try:
            # Remove from LiveKit
            await self.lk_api.room.remove_participant(
                api.RoomParticipantIdentity(
                    room=room_name,
                    identity=participant_identity
                )
            )
            
            # Remove from local tracking
            if room_name in self.active_rooms:
                self.active_rooms[room_name]["participants"].pop(participant_identity, None)
            
            # Remove session
            self.participant_sessions.pop(participant_identity, None)
            
            logger.info(f"✅ Removed participant {participant_identity} from room {room_name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to remove participant {participant_identity} from room {room_name}: {e}")
            return False

    async def create_transfer_room(
        self, 
        original_room: str,
        agent_a_identity: str,
        agent_b_identity: str,
        caller_identity: str,
        transfer_id: str
    ) -> dict:
        """Create a transfer room for warm handoff"""
        transfer_room_name = f"transfer_{transfer_id}_{uuid.uuid4().hex[:6]}"
        
        try:
            # Create transfer room
            room_info = await self.create_room(
                room_name=transfer_room_name,
                max_participants=3,  # Agent A, Agent B, Caller
                metadata={
                    "type": "transfer",
                    "transfer_id": transfer_id,
                    "original_room": original_room,
                    "agent_a": agent_a_identity,
                    "agent_b": agent_b_identity,
                    "caller": caller_identity
                }
            )
            
            # Track transfer
            self.active_transfers[transfer_id] = {
                "transfer_id": transfer_id,
                "transfer_room": transfer_room_name,
                "original_room": original_room,
                "agent_a": agent_a_identity,
                "agent_b": agent_b_identity,
                "caller": caller_identity,
                "status": "initiated",
                "created_at": datetime.utcnow()
            }
            
            logger.info(f"✅ Created transfer room {transfer_room_name} for transfer {transfer_id}")
            
            return {
                "transfer_room": transfer_room_name,
                "room_info": room_info,
                "transfer_id": transfer_id
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to create transfer room: {e}")
            raise Exception(f"Failed to create transfer room: {e}")

    async def complete_warm_transfer(
        self, 
        transfer_id: str,
        success: bool = True
    ) -> dict:
        """Complete warm transfer process"""
        if transfer_id not in self.active_transfers:
            raise Exception(f"Transfer {transfer_id} not found")
        
        transfer = self.active_transfers[transfer_id]
        
        try:
            if success:
                # Remove Agent A from original room
                await self.remove_participant_from_room(
                    transfer["original_room"],
                    transfer["agent_a"]
                )
                
                # Add Agent B to original room
                await self.add_participant_to_room(
                    transfer["original_room"],
                    transfer["agent_b"],
                    role="agent"
                )
                
                # Clean up transfer room
                await self.delete_room(transfer["transfer_room"])
                
                transfer["status"] = "completed"
                transfer["completed_at"] = datetime.utcnow()
                
                logger.info(f"✅ Completed warm transfer {transfer_id}")
            else:
                # Transfer failed - restore original state
                transfer["status"] = "failed"
                transfer["completed_at"] = datetime.utcnow()
                
                logger.warning(f"⚠️ Transfer {transfer_id} failed")
            
            return transfer
            
        except Exception as e:
            logger.error(f"❌ Failed to complete transfer {transfer_id}: {e}")
            transfer["status"] = "error"
            transfer["error"] = str(e)
            raise Exception(f"Failed to complete transfer: {e}")

    async def get_active_transfers(self) -> List[dict]:
        """Get all active transfers"""
        return list(self.active_transfers.values())

    async def get_active_rooms(self) -> List[dict]:
        """Get all active rooms"""
        return list(self.active_rooms.values())

    async def _cleanup_stale_rooms(self):
        """Clean up stale rooms (older than 24 hours)"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            
            rooms_to_delete = []
            for room_name, room_data in self.active_rooms.items():
                if room_data["created_at"] < cutoff_time:
                    rooms_to_delete.append(room_name)
            
            for room_name in rooms_to_delete:
                await self.delete_room(room_name)
                logger.info(f"🧹 Cleaned up stale room: {room_name}")
                
        except Exception as e:
            logger.error(f"❌ Failed to cleanup stale rooms: {e}")

    async def send_data_to_room(self, room_name: str, data: dict, participant_identities: List[str] = None):
        """Send data message to room participants"""
        try:
            # Convert data to bytes
            data_bytes = json.dumps(data).encode('utf-8')
            
            # Send to specific participants or all
            if participant_identities:
                for identity in participant_identities:
                    await self.lk_api.room.send_data(
                        api.SendDataRequest(
                            room=room_name,
                            data=data_bytes,
                            destination_identities=[identity]
                        )
                    )
            else:
                await self.lk_api.room.send_data(
                    api.SendDataRequest(
                        room=room_name,
                        data=data_bytes
                    )
                )
                
            logger.info(f"✅ Sent data to room {room_name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send data to room {room_name}: {e}")
            raise Exception(f"Failed to send data: {e}")