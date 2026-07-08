from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class MasterPanel(Base):
    """Table principale des données AEP (panel master)"""
    __tablename__ = "master_panel"
    
    id_centre_desservi = Column(String(50), primary_key=True)
    annee = Column(Integer, primary_key=True)
    
    # Indicateurs de production/distribution
    distribution = Column(Float, nullable=True)
    production = Column(Float, nullable=True)
    cons_pop_branchee = Column(Float, nullable=True)
    cons_bf = Column(Float, nullable=True)
    cons_administrative = Column(Float, nullable=True)
    cons_industrielle = Column(Float, nullable=True)
    cons_autres = Column(Float, nullable=True)
    
    # Dotations
    dot_pop_branchee = Column(Float, nullable=True)
    dot_bf = Column(Float, nullable=True)
    dot_administrative = Column(Float, nullable=True)
    dot_industrielle = Column(Float, nullable=True)
    dot_globale_nette = Column(Float, nullable=True)
    dot_globale_brute = Column(Float, nullable=True)
    
    # Rendements
    rend_distribution = Column(Float, nullable=True)
    rend_adduction = Column(Float, nullable=True)
    taux_branchement = Column(Float, nullable=True)
    
    # Abonnés
    nbre_abonnes_particuliers = Column(Float, nullable=True)
    nbre_bf = Column(Float, nullable=True)
    abon_administratifs = Column(Float, nullable=True)
    abon_industrielle = Column(Float, nullable=True)
    autres_abonnes = Column(Float, nullable=True)
    
    # Métadonnées
    dr = Column(String(50), nullable=True)
    kp = Column(Float, nullable=True)
    regie = Column(String(100), nullable=True)
    organisme_distributeur = Column(String(100), nullable=True)
    consommation_totale = Column(Float, nullable=True)
    
    # Informations centre
    lib_centre_uniformise = Column(String(255), nullable=True)
    milieu = Column(String(50), nullable=True)
    code_commune = Column(String(50), nullable=True)
    lib_commune = Column(String(255), nullable=True)
    lib_province = Column(String(255), nullable=True)
    code_region_12 = Column(String(50), nullable=True)
    libelle_region = Column(String(255), nullable=True)
    srm = Column(String(50), nullable=True)
    id_dr_admin = Column(String(50), nullable=True)
    type_centre = Column(String(50), nullable=True)
    sa_centre = Column(String(50), nullable=True)
    population_2024 = Column(Float, nullable=True)
    menages_2024 = Column(Float, nullable=True)
    mappable = Column(Boolean, nullable=True)
    systeme_aep = Column(String(100), nullable=True)
    n_installations_centre = Column(Integer, nullable=True)
    capacite_equipee_centre = Column(Float, nullable=True)
    capacite_exploitable_centre = Column(Float, nullable=True)
    population_interp = Column(Float, nullable=True)
    pop_multi_ancre = Column(Float, nullable=True)
    dr_volume_produit_traite = Column(Float, nullable=True)
    dr_debit_exploitable = Column(Float, nullable=True)
    dr_n_installations = Column(Integer, nullable=True)
    
    # Relations - NOUVELLE RELATION VERS LES INSTALLATIONS
    installations = relationship("LinkInstallationMasterPanel", back_populates="centre")