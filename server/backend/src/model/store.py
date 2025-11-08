from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Store(Base):
    __tablename__ = "stores"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, unique=True, index=True)  # "store_a"
    name = Column(String)
    location = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    visits = relationship("StoreVisit", back_populates="store")
