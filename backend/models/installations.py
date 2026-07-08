from sqlalchemy import Column, String, Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class InstallationProduction(Base):
    """Table des installations de production"""
    __tablename__ = "installations_production"
    
    id_dr = Column(String(50), nullable=True)
    lib_centre_prod_gde = Column(String(255), nullable=True)
    code_centre_prod_gde = Column(String(50), nullable=True)
    installation = Column(String(255), primary_key=True, index=True)
    type_traitement = Column(String(100), nullable=True)
    debit_equipe = Column(Float, nullable=True)
    debit_exploitable = Column(Float, nullable=True)
    
    # Relations
    productions_mensuelles = relationship("ProductionMensuelle", back_populates="installation_obj", cascade="all, delete-orphan")
    liens_centres = relationship("LinkInstallationMasterPanel", back_populates="installation", cascade="all, delete-orphan")


class ProductionMensuelle(Base):
    """Table des productions mensuelles par installation"""
    __tablename__ = "production_mensuelle"
    
    installation = Column(String(255), ForeignKey("installations_production.installation"), primary_key=True)
    année = Column(String(10), primary_key=True)
    mois = Column(String(10), primary_key=True)
    debit_equipe = Column(Float, nullable=True)
    debit_exploitable = Column(Float, nullable=True)
    volume_produit_brut = Column(Float, nullable=True)
    volume_produit_traite = Column(Float, nullable=True)
    volume_lavage_et_vidange = Column(Float, nullable=True)
    volume_recycle = Column(Float, nullable=True)
    taux_d_utilisation = Column(Float, nullable=True)
    
    # Relation
    installation_obj = relationship("InstallationProduction", back_populates="productions_mensuelles")


class LinkInstallationMasterPanel(Base):
    """Table de liaison entre les installations et master_panel (centres)"""
    __tablename__ = "link_installations_master_panel"
    
    installation = Column(String(255), ForeignKey("installations_production.installation"), primary_key=True)
    id_centre_desservi = Column(String(50), primary_key=True)
    lib_centre_desservi = Column(String(255), nullable=True)
    
    # Relations
    installation_obj = relationship("InstallationProduction", back_populates="liens_centres")
    
    # Contrainte d'unicité
    __table_args__ = (
        UniqueConstraint('installation', 'id_centre_desservi', name='uq_installation_centre'),
    )


# Mise à jour de MasterPanel pour ajouter la relation inverse
# À ajouter dans backend/models/master_panel.py