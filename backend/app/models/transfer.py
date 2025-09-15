from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.core.database import Base

class Transfer(Base):
    """Transfer model for tracking warm transfer operations"""
    __tablename__ = "transfers"
    
    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(String(50), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Related entities
    call_id = Column(Integer, ForeignKey("calls.id"), nullable=False)
    source_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    target_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    # Transfer details
    transfer_type = Column(String(20), default="warm")  # warm, cold, escalation
    reason = Column(Text, nullable=True)
    transfer_room_name = Column(String(100), nullable=True)
    
    # Status tracking
    status = Column(String(20), default="initiated")  # initiated, in_progress, completed, failed, cancelled
    initiated_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # AI-generated context
    ai_summary = Column(Text, nullable=True)
    ai_context = Column(Text, nullable=True)
    sentiment_analysis = Column(JSON, nullable=True)
    escalation_assessment = Column(JSON, nullable=True)
    
    # Success metrics
    was_successful = Column(Boolean, nullable=True)
    customer_satisfaction = Column(Integer, nullable=True)  # 1-5 rating
    agent_feedback = Column(Text, nullable=True)
    
    # Metadata
    transfer_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    call = relationship("Call", back_populates="transfers")
    source_agent = relationship("Agent", foreign_keys=[source_agent_id], back_populates="source_transfers")
    target_agent = relationship("Agent", foreign_keys=[target_agent_id], back_populates="target_transfers")
    
    def __repr__(self):
        return f"<Transfer(id={self.id}, transfer_id={self.transfer_id}, status={self.status})>"