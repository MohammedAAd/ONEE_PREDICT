from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class LinkInstallationMasterPanel(Base):
    """Table de liaison entre les installations et master_panel (centres)"""
    __tablename__ = "link_installations_master_panel"
    
    installation = Column(String(255), ForeignKey("installations_production.installation"), primary_key=True)
    id_centre_desservi = Column(String(50), primary_key=True)
    lib_centre_desservi = Column(String(255), nullable=True)
    
    # Relations
    installation_obj = relationship("InstallationProduction", back_populates="liens_centres")
    centre = relationship("MasterPanel", back_populates="installations")
    
    # Contrainte d'unicité
    __table_args__ = (
        UniqueConstraint('installation', 'id_centre_desservi', name='uq_installation_centre'),
    )