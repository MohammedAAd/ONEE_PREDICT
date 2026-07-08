from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class StatisticService:
    """Service pour les statistiques globales et rapports"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_global_statistics(self) -> Dict[str, Any]:
        """Statistiques globales de la base ONEE"""
        query = text("""
            SELECT 
                (SELECT COUNT(*) FROM regions) as nb_regions,
                (SELECT COUNT(*) FROM provinces) as nb_provinces,
                (SELECT COUNT(*) FROM communes_2024) as nb_communes,
                (SELECT COUNT(*) FROM ref_centres_hcp_2024) as nb_centres_2024,
                (SELECT COUNT(*) FROM centres_hcp_2014) as nb_centres_2014,
                (SELECT COUNT(*) FROM centres_hcp_2004) as nb_centres_2004,
                (SELECT COUNT(*) FROM centres_desservis) as nb_centres_desservis,
                (SELECT COUNT(*) FROM installations_production) as nb_installations,
                (SELECT COUNT(DISTINCT annee) FROM fact_activite_aep) as nb_annees,
                (SELECT COUNT(*) FROM fact_activite_aep) as nb_enregistrements_aep
        """)
        
        result = await self.db.execute(query)
        row = result.first()
        
        return {
            "territoire": {
                "regions": row.nb_regions,
                "provinces": row.nb_provinces,
                "communes": row.nb_communes
            },
            "infrastructure": {
                "centres_2024": row.nb_centres_2024,
                "centres_2014": row.nb_centres_2014,
                "centres_2004": row.nb_centres_2004,
                "centres_desservis": row.nb_centres_desservis,
                "installations_production": row.nb_installations
            },
            "donnees_aep": {
                "annees_disponibles": row.nb_annees,
                "enregistrements": row.nb_enregistrements_aep
            }
        }
    
    async def get_yearly_summary(self) -> List[Dict[str, Any]]:
        """Résumé annuel de la production AEP"""
        query = text("""
            SELECT 
                annee,
                SUM(production) as production_totale,
                SUM(distribution) as distribution_totale,
                AVG(taux_branchement) as taux_branchement_moyen,
                AVG(rend_distribution) as rendement_moyen,
                SUM(nbre_abonnes_particuliers) as total_abonnes,
                COUNT(DISTINCT id_centre_desservi) as nb_centres_actifs
            FROM fact_activite_aep
            GROUP BY annee
            ORDER BY annee
        """)
        
        result = await self.db.execute(query)
        return [
            {
                "annee": row.annee,
                "production_totale": row.production_totale,
                "distribution_totale": row.distribution_totale,
                "taux_branchement_moyen": round(row.taux_branchement_moyen, 2) if row.taux_branchement_moyen else None,
                "rendement_moyen": round(row.rendement_moyen, 2) if row.rendement_moyen else None,
                "total_abonnes": row.total_abonnes,
                "nb_centres_actifs": row.nb_centres_actifs
            }
            for row in result
        ]
    
    async def get_regional_summary(self) -> List[Dict[str, Any]]:
        """Résumé par région"""
        query = text("""
            SELECT 
                r.libellé_region as region,
                COUNT(DISTINCT c.id_centre_2024) as nb_centres,
                COUNT(DISTINCT cd.id_centre_desservi) as nb_centres_desservis,
                SUM(c.population_2024) as population_desservie,
                SUM(fa.production) as production_totale,
                AVG(fa.taux_branchement) as taux_branchement_moyen
            FROM regions r
            LEFT JOIN provinces p ON r.code_region_12 = p.code_region_12
            LEFT JOIN communes_2024 com ON p.id_province = com.code_province
            LEFT JOIN ref_centres_hcp_2024 c ON com.code_commune = c.code_commune
            LEFT JOIN centres_desservis cd ON c.id_centre_desservi = cd.id_centre_desservi
            LEFT JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
            GROUP BY r.libellé_region
            ORDER BY production_totale DESC
        """)
        
        result = await self.db.execute(query)
        return [
            {
                "region": row.region,
                "nb_centres": row.nb_centres,
                "nb_centres_desservis": row.nb_centres_desservis,
                "population_desservie": row.population_desservie,
                "production_totale": row.production_totale,
                "taux_branchement_moyen": round(row.taux_branchement_moyen, 2) if row.taux_branchement_moyen else None
            }
            for row in result
        ]
    
    async def get_performance_ranking(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Classement des meilleures performances par centre"""
        query = text("""
            SELECT 
                cd.lib_centre_desservi as centre,
                com.lib_commune as commune,
                p.lib_province as province,
                fa.annee,
                fa.production,
                fa.distribution,
                fa.taux_branchement,
                fa.rend_distribution,
                (fa.production / NULLIF(c.population_2024, 0)) * 100 as production_par_habitant
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            LEFT JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            LEFT JOIN communes_2024 com ON c.code_commune = com.code_commune
            LEFT JOIN provinces p ON com.code_province = p.id_province
            WHERE fa.annee = (SELECT MAX(annee) FROM fact_activite_aep)
            ORDER BY fa.production DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(query, {"limit": limit})
        return [
            {
                "centre": row.centre,
                "commune": row.commune,
                "province": row.province,
                "annee": row.annee,
                "production": row.production,
                "distribution": row.distribution,
                "taux_branchement": round(row.taux_branchement, 2) if row.taux_branchement else None,
                "rendement": round(row.rend_distribution, 2) if row.rend_distribution else None,
                "production_par_habitant": round(row.production_par_habitant, 2) if row.production_par_habitant else None
            }
            for row in result
        ]