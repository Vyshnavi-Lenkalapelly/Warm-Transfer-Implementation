from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.core.database import Base

class Recording(Base):
    """Recording model for storing call recordings and transcripts"""
    __tablename__ = "recordings"
    
    id = Column(Integer, primary_key=True, index=True)
    recording_id = Column(String(50), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Related call
    call_id = Column(Integer, ForeignKey("calls.id"), nullable=False)
    
    # Recording details
    recording_type = Column(String(20), default="audio")  # audio, video, screen
    file_path = Column(String(500), nullable=True)
    s3_url = Column(String(500), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # Transcription
    transcript = Column(Text, nullable=True)
    transcript_confidence = Column(Float, nullable=True)
    transcript_language = Column(String(10), nullable=True)
    
    # AI Analysis
    ai_summary = Column(Text, nullable=True)
    sentiment_analysis = Column(JSON, nullable=True)
    key_phrases = Column(JSON, nullable=True)
    action_items = Column(JSON, nullable=True)
    
    # Processing status
    processing_status = Column(String(20), default="pending")  # pending, processing, completed, failed
    processed_at = Column(DateTime, nullable=True)
    
    # Metadata
    recording_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    call = relationship("Call", back_populates="recordings")
    
    def __repr__(self):
        return f"<Recording(id={self.id}, recording_id={self.recording_id}, type={self.recording_type})>"