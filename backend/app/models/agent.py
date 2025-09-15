from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.core.database import Base

class Agent(Base):
    """Agent model for tracking agent information and availability"""
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String(50), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Agent information
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20), nullable=True)
    
    # Agent capabilities
    skills = Column(JSON, nullable=True)  # List of skills/specializations
    languages = Column(JSON, nullable=True)  # Supported languages
    max_concurrent_calls = Column(Integer, default=3)
    
    # Status
    status = Column(String(20), default="offline")  # online, busy, away, offline
    current_calls = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    
    # Performance metrics
    total_calls_handled = Column(Integer, default=0)
    successful_transfers = Column(Integer, default=0)
    average_call_duration = Column(Float, default=0.0)
    customer_satisfaction_rating = Column(Float, default=0.0)
    
    # Scheduling
    shift_start = Column(DateTime, nullable=True)
    shift_end = Column(DateTime, nullable=True)
    last_active = Column(DateTime, default=func.now())
    
    # Metadata
    agent_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    source_transfers = relationship("Transfer", foreign_keys="Transfer.source_agent_id", back_populates="source_agent")
    target_transfers = relationship("Transfer", foreign_keys="Transfer.target_agent_id", back_populates="target_agent")
    
    def __repr__(self):
        return f"<Agent(id={self.id}, agent_id={self.agent_id}, name={self.name}, status={self.status})>"