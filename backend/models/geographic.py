from sqlalchemy import Column, String, Double, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Region(Base):
    __tablename__ = "regions"
    
    code_region_12 = Column(String(50), primary_key=True, index=True)
    libellé_region = Column(String(255))
    srm = Column(String(50))
    
    provinces = relationship("Province", back_populates="region", foreign_keys="Province.code_region_12")

class Province(Base):
    __tablename__ = "provinces"
    
    id_province = Column(String(50), primary_key=True, index=True)
    code_region_12 = Column(String(50), ForeignKey("regions.code_region_12"))
    lib_province = Column(String(255))
    id_region = Column(String(50))
    id_dr = Column(String(50))
    
    region = relationship("Region", back_populates="provinces")
    communes = relationship("Commune2024", back_populates="province", foreign_keys="Commune2024.code_province")

class Commune2024(Base):
    __tablename__ = "communes_2024"
    
    code_commune = Column(String(50), primary_key=True, index=True)
    lib_commune = Column(String(255))
    flg = Column(String(10))
    code_province = Column(String(50), ForeignKey("provinces.id_province"))
    communes = Column(String(255))  # Colonne arabe
    
    province = relationship("Province", back_populates="communes")
    centres = relationship("RefCentreHCP2024", back_populates="commune", foreign_keys="RefCentreHCP2024.code_commune")