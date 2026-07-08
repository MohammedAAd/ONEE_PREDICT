from sqlalchemy import Column, String, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class FactLong(Base):
    """Table des consommations par type (format long)"""
    __tablename__ = "fact_long"
    
    id_centre_desservi = Column(String(50), primary_key=True)
    annee = Column(Integer, primary_key=True)
    type_consommation = Column(String(50), primary_key=True)
    consommation = Column(Float, nullable=True)
    dotation = Column(Float, nullable=True)
    
    # Relations
    centre_desservi = relationship("CentreDesservi", foreign_keys=[id_centre_desservi])