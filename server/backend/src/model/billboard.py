from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database.core import Base 

class Billboard(Base):
    __tablename__ = "billboards"
    
    id = Column(Integer, primary_key=True, index=True)
    billboard_id = Column(String, unique=True, index=True)  # "billboard_gangnam"
    name = Column(String)
    location = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    detections = relationship("Detection", back_populates="billboard")
