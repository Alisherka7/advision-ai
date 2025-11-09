from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from ..database.core import Base

class Visitor(Base):
    __tablename__ = "visitors"
    
    
    
    def __repr__(self):
        return f"<Visitor(id={self.id}, email={self.email}, full_name={self.full_name}, is_active={self.is_active})>"