import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import uuid

from app.services.livekit_service import LiveKitService
from app.services.ai_service import AIService
from app.core.websocket_manager import ConnectionManager
from app.core.database import get_db, get_redis
from app.models.call import Call
from app.models.agent import Agent
from app.models.transfer import Transfer
from app.core.config import settings

logger = logging.getLogger(__name__)

class WarmTransferService:
    """Core service for managing warm transfer operations"""
    
    def __init__(
        self, 
        livekit_service: LiveKitService,
        ai_service: AIService,
        connection_manager: ConnectionManager
    ):
        self.livekit = livekit_service
        self.ai = ai_service
        self.connection_manager = connection_manager
        self.redis = get_redis()
        
        # Transfer state tracking
        self.active_transfers: Dict[str, dict] = {}
        self.transfer_timeouts: Dict[str, asyncio.Task] = {}

    async def initiate_warm_transfer(
        self,
        call_id: str,
        source_agent_id: str,
        target_agent_id: str,
        reason: str = None,
        priority: str = "medium"
    ) -> dict:
        """Initiate a warm transfer from Agent A to Agent B"""
        
        transfer_id = str(uuid.uuid4())
        
        try:
            # Validate agents and call
            with next(get_db()) as db:
                call = db.query(Call).filter(Call.call_id == call_id).first()
                source_agent = db.query(Agent).filter(Agent.agent_id == source_agent_id).first()
                target_agent = db.query(Agent).filter(Agent.agent_id == target_agent_id).first()
                
                if not call:
                    raise ValueError(f"Call {call_id} not found")
                if not source_agent:
                    raise ValueError(f"Source agent {source_agent_id} not found")
                if not target_agent:
                    raise ValueError(f"Target agent {target_agent_id} not found")
                
                # Check target agent availability
                if not target_agent.is_available or target_agent.status != "online":
                    raise ValueError(f"Target agent {target_agent_id} is not available")
                
                if target_agent.current_calls >= target_agent.max_concurrent_calls:
                    raise ValueError(f"Target agent {target_agent_id} is at capacity")
            
            # Generate AI call summary and context
            call_data = await self._prepare_call_data(call)
            ai_summary = await self.ai.generate_call_summary(call_data)
            
            # Create transfer room
            transfer_room_info = await self.livekit.create_transfer_room(
                original_room=call.room_name,
                agent_a_identity=source_agent_id,
                agent_b_identity=target_agent_id,
                caller_identity=call.caller_info.get("identity", "caller") if call.caller_info else "caller",
                transfer_id=transfer_id
            )
            
            # Create transfer record
            with next(get_db()) as db:
                transfer = Transfer(
                    transfer_id=transfer_id,
                    call_id=call.id,
                    source_agent_id=source_agent.id,
                    target_agent_id=target_agent.id,
                    transfer_type="warm",
                    reason=reason,
                    transfer_room_name=transfer_room_info["transfer_room"],
                    status="initiated",
                    ai_summary=ai_summary["summary"],
                    sentiment_analysis=ai_summary["sentiment"]
                )
                db.add(transfer)
                db.commit()
                db.refresh(transfer)
            
            # Track transfer state
            self.active_transfers[transfer_id] = {
                "transfer_id": transfer_id,
                "call_id": call_id,
                "source_agent_id": source_agent_id,
                "target_agent_id": target_agent_id,
                "transfer_room": transfer_room_info["transfer_room"],
                "original_room": call.room_name,
                "status": "initiated",
                "ai_summary": ai_summary,
                "created_at": datetime.utcnow(),
                "phase": "waiting_for_agents"
            }
            
            # Set transfer timeout
            timeout_task = asyncio.create_task(
                self._handle_transfer_timeout(transfer_id)
            )
            self.transfer_timeouts[transfer_id] = timeout_task
            
            # Notify agents about transfer
            await self._notify_transfer_initiation(transfer_id)
            
            logger.info(f"✅ Initiated warm transfer {transfer_id} from {source_agent_id} to {target_agent_id}")
            
            return {
                "transfer_id": transfer_id,
                "status": "initiated",
                "transfer_room": transfer_room_info["transfer_room"],
                "ai_summary": ai_summary,
                "next_steps": [
                    f"Agent {source_agent_id} should join transfer room",
                    f"Agent {target_agent_id} should join transfer room",
                    "AI summary will be shared with Agent B",
                    "Agent A should brief Agent B",
                    "Agent A will leave original call"
                ]
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to initiate warm transfer: {e}")
            # Cleanup on failure
            if transfer_id in self.active_transfers:
                del self.active_transfers[transfer_id]
            raise Exception(f"Transfer initiation failed: {e}")

    async def join_transfer_room(
        self,
        transfer_id: str,
        agent_id: str,
        role: str = "agent"
    ) -> dict:
        """Agent joins the transfer room"""
        
        if transfer_id not in self.active_transfers:
            raise ValueError(f"Transfer {transfer_id} not found")
        
        transfer = self.active_transfers[transfer_id]
        
        try:
            # Add agent to transfer room
            access_info = await self.livekit.add_participant_to_room(
                room_name=transfer["transfer_room"],
                participant_identity=agent_id,
                participant_name=f"Agent-{agent_id}",
                role=role,
                metadata={"transfer_id": transfer_id, "role": role}
            )
            
            # Update transfer state
            if "participants" not in transfer:
                transfer["participants"] = {}
            
            transfer["participants"][agent_id] = {
                "joined_at": datetime.utcnow(),
                "role": role
            }
            
            # Check if both agents have joined
            source_joined = transfer["source_agent_id"] in transfer["participants"]
            target_joined = transfer["target_agent_id"] in transfer["participants"]
            
            if source_joined and target_joined and transfer["phase"] == "waiting_for_agents":
                transfer["phase"] = "briefing"
                transfer["status"] = "in_progress"
                
                # Generate context for target agent
                agent_context = await self.ai.generate_agent_context(
                    call_summary=transfer["ai_summary"]["summary"],
                    agent_profile=None  # Could load from database
                )
                
                # Share AI context with target agent
                await self._share_ai_context(transfer_id, agent_context)
                
                # Update database
                with next(get_db()) as db:
                    db_transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
                    if db_transfer:
                        db_transfer.status = "in_progress"
                        db_transfer.ai_context = agent_context["context"]
                        db.commit()
                
                logger.info(f"✅ Both agents joined transfer {transfer_id}, starting briefing phase")
            
            # Notify about join
            await self.connection_manager.notify_transfer_status(
                transfer_id=transfer_id,
                status="agent_joined",
                details={
                    "agent_id": agent_id,
                    "role": role,
                    "phase": transfer["phase"]
                }
            )
            
            return {
                "access_token": access_info["access_token"],
                "room_name": access_info["room_name"],
                "ws_url": access_info["ws_url"],
                "transfer_phase": transfer["phase"],
                "ai_summary": transfer["ai_summary"] if agent_id == transfer["target_agent_id"] else None
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to join transfer room for agent {agent_id}: {e}")
            raise Exception(f"Failed to join transfer room: {e}")

    async def complete_transfer(
        self,
        transfer_id: str,
        success: bool = True,
        feedback: str = None
    ) -> dict:
        """Complete the warm transfer process"""
        
        if transfer_id not in self.active_transfers:
            raise ValueError(f"Transfer {transfer_id} not found")
        
        transfer = self.active_transfers[transfer_id]
        
        try:
            # Cancel timeout
            if transfer_id in self.transfer_timeouts:
                self.transfer_timeouts[transfer_id].cancel()
                del self.transfer_timeouts[transfer_id]
            
            if success:
                # Complete the transfer in LiveKit
                livekit_result = await self.livekit.complete_warm_transfer(
                    transfer_id=transfer_id,
                    success=True
                )
                
                # Update agent availability
                await self._update_agent_post_transfer(
                    source_agent_id=transfer["source_agent_id"],
                    target_agent_id=transfer["target_agent_id"],
                    success=True
                )
                
                transfer["status"] = "completed"
                transfer["completed_at"] = datetime.utcnow()
                
                logger.info(f"✅ Successfully completed warm transfer {transfer_id}")
            else:
                # Transfer failed - restore original state
                transfer["status"] = "failed"
                transfer["completed_at"] = datetime.utcnow()
                
                logger.warning(f"⚠️ Transfer {transfer_id} failed")
            
            # Update database
            with next(get_db()) as db:
                db_transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
                if db_transfer:
                    db_transfer.status = transfer["status"]
                    db_transfer.completed_at = transfer["completed_at"]
                    db_transfer.was_successful = success
                    db_transfer.agent_feedback = feedback
                    
                    if success:
                        duration = (transfer["completed_at"] - transfer["created_at"]).total_seconds()
                        db_transfer.duration_seconds = int(duration)
                    
                    db.commit()
            
            # Notify completion
            await self.connection_manager.notify_transfer_status(
                transfer_id=transfer_id,
                status="completed" if success else "failed",
                details={
                    "success": success,
                    "feedback": feedback,
                    "duration": (transfer["completed_at"] - transfer["created_at"]).total_seconds() if success else None
                }
            )
            
            # Cleanup
            self._cleanup_transfer(transfer_id)
            
            return {
                "transfer_id": transfer_id,
                "status": transfer["status"],
                "success": success,
                "duration": (transfer["completed_at"] - transfer["created_at"]).total_seconds() if success else None
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to complete transfer {transfer_id}: {e}")
            transfer["status"] = "error"
            raise Exception(f"Transfer completion failed: {e}")

    async def cancel_transfer(
        self,
        transfer_id: str,
        reason: str = None
    ) -> dict:
        """Cancel an ongoing transfer"""
        
        if transfer_id not in self.active_transfers:
            raise ValueError(f"Transfer {transfer_id} not found")
        
        transfer = self.active_transfers[transfer_id]
        
        try:
            # Cancel timeout
            if transfer_id in self.transfer_timeouts:
                self.transfer_timeouts[transfer_id].cancel()
                del self.transfer_timeouts[transfer_id]
            
            # Clean up transfer room
            if "transfer_room" in transfer:
                await self.livekit.delete_room(transfer["transfer_room"])
            
            # Update status
            transfer["status"] = "cancelled"
            transfer["cancelled_at"] = datetime.utcnow()
            
            # Update database
            with next(get_db()) as db:
                db_transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
                if db_transfer:
                    db_transfer.status = "cancelled"
                    db_transfer.agent_feedback = reason
                    db.commit()
            
            # Notify cancellation
            await self.connection_manager.notify_transfer_status(
                transfer_id=transfer_id,
                status="cancelled",
                details={"reason": reason}
            )
            
            # Cleanup
            self._cleanup_transfer(transfer_id)
            
            logger.info(f"✅ Cancelled transfer {transfer_id}")
            
            return {
                "transfer_id": transfer_id,
                "status": "cancelled",
                "reason": reason
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to cancel transfer {transfer_id}: {e}")
            raise Exception(f"Transfer cancellation failed: {e}")

    async def get_transfer_status(self, transfer_id: str) -> dict:
        """Get current transfer status"""
        
        if transfer_id in self.active_transfers:
            transfer = self.active_transfers[transfer_id]
            return {
                "transfer_id": transfer_id,
                "status": transfer["status"],
                "phase": transfer.get("phase", "unknown"),
                "participants": list(transfer.get("participants", {}).keys()),
                "created_at": transfer["created_at"].isoformat(),
                "ai_summary": transfer.get("ai_summary", {})
            }
        
        # Check database for completed transfers
        with next(get_db()) as db:
            db_transfer = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
            if db_transfer:
                return {
                    "transfer_id": transfer_id,
                    "status": db_transfer.status,
                    "phase": "completed" if db_transfer.completed_at else "unknown",
                    "created_at": db_transfer.initiated_at.isoformat(),
                    "completed_at": db_transfer.completed_at.isoformat() if db_transfer.completed_at else None,
                    "duration_seconds": db_transfer.duration_seconds,
                    "was_successful": db_transfer.was_successful
                }
        
        raise ValueError(f"Transfer {transfer_id} not found")

    async def list_active_transfers(self) -> List[dict]:
        """List all active transfers"""
        return [
            {
                "transfer_id": transfer_id,
                "status": transfer["status"],
                "phase": transfer.get("phase", "unknown"),
                "source_agent": transfer["source_agent_id"],
                "target_agent": transfer["target_agent_id"],
                "created_at": transfer["created_at"].isoformat()
            }
            for transfer_id, transfer in self.active_transfers.items()
        ]

    async def _prepare_call_data(self, call: Call) -> dict:
        """Prepare call data for AI summary generation"""
        # In a real implementation, this would gather conversation history,
        # agent notes, etc. For now, we'll create a basic structure
        
        return {
            "duration": (datetime.utcnow() - call.started_at).total_seconds() / 60 if call.started_at else 0,
            "caller_info": call.caller_info or {},
            "conversation_history": "Call in progress",  # Would be actual conversation
            "current_issue": "Customer inquiry",  # Would be extracted from call
            "agent_notes": "Initial contact",  # Would be agent's notes
            "call_id": call.call_id,
            "priority": call.priority
        }

    async def _notify_transfer_initiation(self, transfer_id: str):
        """Notify agents about transfer initiation"""
        transfer = self.active_transfers[transfer_id]
        
        # Notify source agent
        await self.connection_manager.send_personal_message(
            {
                "type": "transfer_initiated",
                "transfer_id": transfer_id,
                "role": "source_agent",
                "transfer_room": transfer["transfer_room"],
                "target_agent": transfer["target_agent_id"],
                "ai_summary": transfer["ai_summary"]
            },
            transfer["source_agent_id"]
        )
        
        # Notify target agent
        await self.connection_manager.send_personal_message(
            {
                "type": "transfer_request",
                "transfer_id": transfer_id,
                "role": "target_agent",
                "transfer_room": transfer["transfer_room"],
                "source_agent": transfer["source_agent_id"],
                "ai_summary": transfer["ai_summary"]
            },
            transfer["target_agent_id"]
        )

    async def _share_ai_context(self, transfer_id: str, agent_context: dict):
        """Share AI-generated context with agents in transfer room"""
        transfer = self.active_transfers[transfer_id]
        
        # Send context data to transfer room
        await self.livekit.send_data_to_room(
            room_name=transfer["transfer_room"],
            data={
                "type": "ai_context",
                "transfer_id": transfer_id,
                "context": agent_context["context"],
                "sentiment": agent_context["sentiment_analysis"],
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    async def _handle_transfer_timeout(self, transfer_id: str):
        """Handle transfer timeout"""
        await asyncio.sleep(settings.TRANSFER_TIMEOUT_SECONDS)
        
        if transfer_id in self.active_transfers:
            logger.warning(f"⏰ Transfer {transfer_id} timed out")
            await self.cancel_transfer(transfer_id, reason="timeout")

    async def _update_agent_post_transfer(
        self,
        source_agent_id: str,
        target_agent_id: str,
        success: bool
    ):
        """Update agent metrics after transfer"""
        with next(get_db()) as db:
            # Update source agent
            source_agent = db.query(Agent).filter(Agent.agent_id == source_agent_id).first()
            if source_agent:
                if success:
                    source_agent.successful_transfers += 1
                source_agent.current_calls = max(0, source_agent.current_calls - 1)
            
            # Update target agent
            target_agent = db.query(Agent).filter(Agent.agent_id == target_agent_id).first()
            if target_agent:
                target_agent.current_calls += 1
                target_agent.total_calls_handled += 1
            
            db.commit()

    def _cleanup_transfer(self, transfer_id: str):
        """Clean up transfer resources"""
        if transfer_id in self.active_transfers:
            del self.active_transfers[transfer_id]
        
        if transfer_id in self.transfer_timeouts:
            self.transfer_timeouts[transfer_id].cancel()
            del self.transfer_timeouts[transfer_id]