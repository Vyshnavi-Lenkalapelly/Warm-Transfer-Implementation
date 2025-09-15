from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.core.database import Base

class Call(Base):
    """Call model for tracking all calls in the system"""
    __tablename__ = "calls"
    
    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(50), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Call metadata
    caller_phone = Column(String(20), nullable=True)
    caller_name = Column(String(100), nullable=True)
    caller_info = Column(JSON, nullable=True)
    
    # Room information
    room_name = Column(String(100), nullable=False)
    livekit_room_id = Column(String(100), nullable=True)
    
    # Call status
    status = Column(String(20), default="initiated")  # initiated, active, transferred, ended, failed
    priority = Column(String(10), default="medium")  # low, medium, high, critical
    
    # Timing
    started_at = Column(DateTime, default=func.now())
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # AI-generated insights
    summary = Column(Text, nullable=True)
    sentiment = Column(String(20), nullable=True)  # positive, neutral, negative
    urgency_level = Column(String(20), nullable=True)  # low, medium, high, critical
    
    # Additional data
    call_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    transfers = relationship("Transfer", back_populates="call")
    recordings = relationship("Recording", back_populates="call")
    
    def __repr__(self):
        return f"<Call(id={self.id}, call_id={self.call_id}, status={self.status})>"