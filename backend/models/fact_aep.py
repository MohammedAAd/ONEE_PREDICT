from sqlalchemy import Column, String, Integer, Double, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class FactActiviteAEP(Base):
    __tablename__ = "fact_activite_aep"
    
    id_centre_desservi = Column(String(50), ForeignKey("centres_desservis.id_centre_desservi"), primary_key=True)
    annee = Column(Integer, primary_key=True)
    production = Column(Double)
    distribution = Column(Double)
    cons_pop_branchee = Column(Double)
    cons__bf = Column(Double)
    cons_administrative = Column(Double)
    cons_industrielle = Column(Double)
    cons_autres = Column(Double)
    nbre_abonnes_particuliers = Column(Double)
    nbre_bf = Column(Double)
    abon_administratifs = Column(Double)
    abon_industrielle = Column(Double)
    autres_abonnes = Column(Double)
    taux_branchement = Column(Double)
    rend_distribution = Column(Double)
    rend_adduction = Column(Double)
    organisme_distributeur = Column(String(100))
    dot_pop_branchee = Column(Double)
    dot_bf = Column(Double)
    dot_administrative = Column(Double)
    dot_industrielle = Column(Double)
    dot_globale_nette = Column(Double)
    dot_globale_brute = Column(Double)
    dr = Column(String(50))
    kp = Column(Double)
    regie = Column(String(100))
    
    # Relations
    centre_desservi = relationship("CentreDesservi", back_populates="fact_aep")