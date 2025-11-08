from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database.core import Base 

class StoreVisit(Base):
    """Store INDIVIDUAL store visit events"""
    __tablename__ = "store_visits"
    
    id = Column(Integer, primary_key=True, index=True)
    face_id = Column(Integer, ForeignKey("faces.id"), index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), index=True)
    
    # STORE THESE STATICALLY
    visited_at = Column(DateTime, default=datetime.utcnow, index=True)
    duration = Column(Float)  # seconds in store
    confidence_score = Column(Float)
    
    # Track if this person viewed billboard before visiting
    had_billboard_exposure = Column(Boolean, default=False)
    
    # Relationships
    face = relationship("Face", back_populates="store_visits")
    store = relationship("Store", back_populates="visits")
    
    # Indexes
    __table_args__ = (
        Index('idx_store_date', 'store_id', 'visited_at'),
        Index('idx_face_store', 'face_id', 'store_id'),
    )
