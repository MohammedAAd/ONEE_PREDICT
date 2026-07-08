from sqlalchemy import Column, String, Double, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class CentreHCP2004(Base):
    __tablename__ = "centres_hcp_2004"
    
    id_centre_hcp_2004 = Column(String(50), primary_key=True, index=True)
    lib_centre = Column(String(255))
    type_centre = Column(String(100))
    sa_centre = Column(String(100))
    id_commune_2004 = Column(String(50))
    population_1994 = Column(Double)
    population_2004 = Column(Double)
    menages_1994 = Column(Double)
    menages_2004 = Column(Double)

class CentreHCP2014(Base):
    __tablename__ = "centres_hcp_2014"
    
    ancien_code_géographique = Column(String(50))
    code_commune_2014 = Column(String(50))
    code_centre_2014 = Column(String(50), primary_key=True, index=True)
    lib_centre_2014 = Column(String(255))
    type_centre = Column(String(100))
    sa_centre = Column(String(100))
    menages_2014 = Column(Double)
    population_2014 = Column(Double)

class CentreDesservi(Base):
    __tablename__ = "centres_desservis"
    
    id_centre_desservi = Column(String(50), primary_key=True, index=True)
    lib_centre_desservi = Column(String(255))
    milieu = Column(String(50))
    
    # Relations
    centres_2024 = relationship("RefCentreHCP2024", back_populates="centre_desservi", foreign_keys="RefCentreHCP2024.id_centre_desservi")
    fact_aep = relationship("FactActiviteAEP", back_populates="centre_desservi", foreign_keys="FactActiviteAEP.id_centre_desservi")

class RefCentreHCP2024(Base):
    __tablename__ = "ref_centres_hcp_2024"
    
    id_centre_2024 = Column(String(50), primary_key=True, index=True)
    lib_centre_uniformisé = Column(String(255))
    code_commune = Column(String(50), ForeignKey("communes_2024.code_commune"))
    type_centre = Column(String(100))
    sa_centre = Column(String(100))
    population_2024 = Column(Double)
    ménages_2024 = Column(Double)
    communes_territoriales = Column(String(500))
    id_centre_desservi = Column(String(50), ForeignKey("centres_desservis.id_centre_desservi"))
    observations = Column(String(500))
    
    # Relations
    commune = relationship("Commune2024", back_populates="centres")
    centre_desservi = relationship("CentreDesservi", back_populates="centres_2024")

class LinkCentres2014_2004(Base):
    __tablename__ = "link_centres_2014_2004"
    
    id_centre_hcp_2004 = Column(String(50), ForeignKey("centres_hcp_2004.id_centre_hcp_2004"), primary_key=True)
    code_centre_2014 = Column(String(50), ForeignKey("centres_hcp_2014.code_centre_2014"), primary_key=True)

class LinkCentres2024_2014(Base):
    __tablename__ = "link_centres_2024_2014"
    
    id_centre_2024 = Column(String(50), ForeignKey("ref_centres_hcp_2024.id_centre_2024"), primary_key=True)
    code_centre_2014 = Column(String(50), ForeignKey("centres_hcp_2014.code_centre_2014"), primary_key=True)

class LinkCentresDesservisHCP(Base):
    __tablename__ = "link_centres_desservis_hcp"
    
    id_centre_desservi = Column(String(50), ForeignKey("centres_desservis.id_centre_desservi"), primary_key=True)
    id_centre_2024 = Column(String(50), ForeignKey("ref_centres_hcp_2024.id_centre_2024"), primary_key=True)