from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func, and_, or_
from typing import List, Optional, Dict, Any
from backend.repository.base_repository import BaseRepository
from backend.models.fact_aep import FactActiviteAEP
from backend.models.centres import CentreDesservi


class AEPRepository(BaseRepository):
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)  # Appel explicite au constructeur parent
    
    def get_model(self):
        return FactActiviteAEP
    
    async def get_production_by_centre(self, centre_desservi_id: str) -> List[FactActiviteAEP]:
        stmt = select(FactActiviteAEP).where(
            FactActiviteAEP.id_centre_desservi == centre_desservi_id
        ).order_by(FactActiviteAEP.annee)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_production_by_region(self, region_code: str) -> List[Dict]:
        query = text("""
            SELECT 
                r.libellé_region as region,
                fa.annee,
                SUM(fa.production) as production_totale,
                SUM(fa.distribution) as distribution_totale,
                AVG(fa.taux_branchement) as taux_branchement_moyen,
                AVG(fa.rend_distribution) as rendement_moyen
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            JOIN communes_2024 com ON c.code_commune = com.code_commune
            JOIN provinces p ON com.code_province = p.id_province
            JOIN regions r ON p.code_region_12 = r.code_region_12
            WHERE r.code_region_12 = :region_code
            GROUP BY r.libellé_region, fa.annee
            ORDER BY fa.annee
        """)
        
        result = await self.db.execute(query, {"region_code": region_code})
        return [{"region": row.region, "annee": row.annee, "production_totale": row.production_totale,
                 "distribution_totale": row.distribution_totale, "taux_branchement": row.taux_branchement_moyen,
                 "rendement": row.rendement_moyen} for row in result]
    
    async def get_centre_desservi_info(self, centre_desservi_id: str) -> Optional[Dict]:
        stmt = select(CentreDesservi).where(CentreDesservi.id_centre_desservi == centre_desservi_id)
        result = await self.db.execute(stmt)
        centre = result.scalar_one_or_none()
        if centre:
            return {"id": centre.id_centre_desservi, "nom": centre.lib_centre_desservi, "milieu": centre.milieu}
        return None

    async def get_production_by_year(self, annee: int) -> List[FactActiviteAEP]:
        stmt = select(FactActiviteAEP).where(FactActiviteAEP.annee == annee)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_global_statistics(self) -> Dict[str, Any]:
        query = text("""
            SELECT 
                SUM(production) as production_totale,
                SUM(distribution) as distribution_totale,
                AVG(taux_branchement) as taux_moyen,
                AVG(rend_distribution) as rendement_moyen,
                MIN(annee) as premiere_annee,
                MAX(annee) as derniere_annee
            FROM fact_activite_aep
        """)
        result = await self.db.execute(query)
        row = result.first()
        return {
            "production_totale": row.production_totale,
            "distribution_totale": row.distribution_totale,
            "taux_branchement_moyen": round(row.taux_moyen, 2) if row.taux_moyen else None,
            "rendement_moyen": round(row.rendement_moyen, 2) if row.rendement_moyen else None,
            "periode": f"{row.premiere_annee} - {row.derniere_annee}"
        }

    async def get_performance_indicators(self) -> Dict[str, Any]:
        query = text("""
            SELECT 
                AVG(taux_branchement) as taux_branchement,
                AVG(rend_distribution) as rendement,
                AVG(cons_pop_branchee) as conso_moyenne_habitant,
                AVG(production / NULLIF(population_2024, 0)) as production_par_habitant
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            WHERE fa.annee = (SELECT MAX(annee) FROM fact_activite_aep)
        """)
        result = await self.db.execute(query)
        row = result.first()
        return {
            "taux_branchement_moyen": round(row.taux_branchement, 2) if row.taux_branchement else None,
            "rendement_moyen": round(row.rendement, 2) if row.rendement else None,
            "consommation_moyenne_par_habitant": round(row.conso_moyenne_habitant, 2) if row.conso_moyenne_habitant else None,
            "production_moyenne_par_habitant": round(row.production_par_habitant, 2) if row.production_par_habitant else None
        }
        
    async def get_top_centres(self, limit: int = 10, annee: int = None) -> List[Dict]:
        where_clause = ""
        params = {"limit": limit}
        
        if annee:
            where_clause = "WHERE fa.annee = :annee"
            params["annee"] = annee
        
        query = text(f"""
            SELECT 
                cd.id_centre_desservi,
                cd.lib_centre_desservi,
                cd.milieu,
                com.lib_commune,
                p.lib_province,
                fa.annee,
                fa.production,
                fa.distribution,
                fa.nbre_abonnes_particuliers,
                fa.taux_branchement
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            LEFT JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            LEFT JOIN communes_2024 com ON c.code_commune = com.code_commune
            LEFT JOIN provinces p ON com.code_province = p.id_province
            {where_clause}
            ORDER BY fa.production DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(query, params)
        return [{"centre_desservi": row.lib_centre_desservi, "milieu": row.milieu,
                 "commune": row.lib_commune, "province": row.lib_province, "annee": row.annee,
                 "production": row.production, "distribution": row.distribution,
                 "abonnes": row.nbre_abonnes_particuliers, "taux_branchement": row.taux_branchement} 
                for row in result]