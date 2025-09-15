from fastapi import WebSocket
from typing import Dict, List, Set
import json
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time communication"""
    
    def __init__(self):
        # Active connections by client_id
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Room-based connections
        self.room_connections: Dict[str, Set[str]] = {}
        
        # Agent connections
        self.agent_connections: Dict[str, str] = {}  # agent_id -> client_id
        
        # Call connections
        self.call_connections: Dict[str, Set[str]] = {}  # call_id -> set of client_ids

    async def connect(self, websocket: WebSocket, client_id: str):
        """Connect a new WebSocket client"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"✅ Client {client_id} connected. Total connections: {len(self.active_connections)}")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat()
        }, client_id)

    def disconnect(self, client_id: str):
        """Disconnect a WebSocket client"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        # Remove from rooms
        for room_id, clients in self.room_connections.items():
            clients.discard(client_id)
        
        # Remove from agent connections
        agent_to_remove = None
        for agent_id, conn_id in self.agent_connections.items():
            if conn_id == client_id:
                agent_to_remove = agent_id
                break
        if agent_to_remove:
            del self.agent_connections[agent_to_remove]
        
        # Remove from call connections
        for call_id, clients in self.call_connections.items():
            clients.discard(client_id)
        
        logger.info(f"❌ Client {client_id} disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, client_id: str):
        """Send message to specific client"""
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message to {client_id}: {e}")
                self.disconnect(client_id)

    async def broadcast(self, message: dict, exclude_clients: List[str] = None):
        """Broadcast message to all connected clients"""
        exclude_clients = exclude_clients or []
        
        disconnected_clients = []
        for client_id, websocket in self.active_connections.items():
            if client_id not in exclude_clients:
                try:
                    await websocket.send_text(json.dumps(message) if isinstance(message, dict) else message)
                except Exception as e:
                    logger.error(f"Failed to broadcast to {client_id}: {e}")
                    disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    async def join_room(self, client_id: str, room_id: str):
        """Add client to a room"""
        if room_id not in self.room_connections:
            self.room_connections[room_id] = set()
        
        self.room_connections[room_id].add(client_id)
        
        await self.send_personal_message({
            "type": "room_joined",
            "room_id": room_id,
            "participants": list(self.room_connections[room_id])
        }, client_id)
        
        # Notify other room participants
        await self.broadcast_to_room({
            "type": "participant_joined",
            "room_id": room_id,
            "client_id": client_id,
            "total_participants": len(self.room_connections[room_id])
        }, room_id, exclude_clients=[client_id])

    async def leave_room(self, client_id: str, room_id: str):
        """Remove client from room"""
        if room_id in self.room_connections:
            self.room_connections[room_id].discard(client_id)
            
            # Clean up empty rooms
            if not self.room_connections[room_id]:
                del self.room_connections[room_id]
            else:
                # Notify remaining participants
                await self.broadcast_to_room({
                    "type": "participant_left",
                    "room_id": room_id,
                    "client_id": client_id,
                    "total_participants": len(self.room_connections[room_id])
                }, room_id)

    async def broadcast_to_room(self, message: dict, room_id: str, exclude_clients: List[str] = None):
        """Broadcast message to all clients in a room"""
        if room_id not in self.room_connections:
            return
        
        exclude_clients = exclude_clients or []
        
        for client_id in self.room_connections[room_id]:
            if client_id not in exclude_clients:
                await self.send_personal_message(message, client_id)

    async def register_agent(self, agent_id: str, client_id: str):
        """Register an agent connection"""
        self.agent_connections[agent_id] = client_id
        
        await self.send_personal_message({
            "type": "agent_registered",
            "agent_id": agent_id,
            "status": "online"
        }, client_id)

    async def unregister_agent(self, agent_id: str):
        """Unregister an agent connection"""
        if agent_id in self.agent_connections:
            client_id = self.agent_connections[agent_id]
            del self.agent_connections[agent_id]
            
            await self.send_personal_message({
                "type": "agent_unregistered",
                "agent_id": agent_id,
                "status": "offline"
            }, client_id)

    async def notify_transfer_status(self, transfer_id: str, status: str, details: dict = None):
        """Notify relevant clients about transfer status changes"""
        message = {
            "type": "transfer_status_update",
            "transfer_id": transfer_id,
            "status": status,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Broadcast to all connections (you might want to be more selective)
        await self.broadcast(message)

    async def notify_call_event(self, call_id: str, event_type: str, data: dict = None):
        """Notify clients about call events"""
        message = {
            "type": "call_event",
            "call_id": call_id,
            "event": event_type,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to clients associated with this call
        if call_id in self.call_connections:
            for client_id in self.call_connections[call_id]:
                await self.send_personal_message(message, client_id)

    def get_connection_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": len(self.active_connections),
            "total_rooms": len(self.room_connections),
            "total_agents": len(self.agent_connections),
            "room_details": {
                room_id: len(clients) 
                for room_id, clients in self.room_connections.items()
            }
        }