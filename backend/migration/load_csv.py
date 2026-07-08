"""
ETL COMPLET - Migration des données eau potable vers PostgreSQL
Auteur: Data Engineer
Date: 2026
"""

import pandas as pd
import numpy as np
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values
from sqlalchemy import create_engine, text
import logging
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# =====================================================
# 1. CONFIGURATION ET LOGGING
# =====================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'etl_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration PostgreSQL
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'onee_db',
    'user': 'postgres',
    'password': '2012'
}

# Chemins des fichiers
FILE_PATHS = {
    'centres': 'table_dimension_centres.parquet',
    'dr_year': 'table_de_dr_year.csv',
    'fait': 'table_de_fait_Totale.csv'
}

# =====================================================
# 2. CLASSE ETL PRINCIPALE
# =====================================================

class WaterDataETL:
    """ETL complet pour les données eau potable"""
    
    def __init__(self, db_config, file_paths):
        self.db_config = db_config
        self.file_paths = file_paths
        self.engine = None
        self.conn = None
        self.cursor = None
        
    def connect(self):
        """Établir la connexion PostgreSQL"""
        try:
            conn_string = f"postgresql://{self.db_config['user']}:{self.db_config['password']}@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
            self.engine = create_engine(conn_string)
            self.conn = psycopg2.connect(**self.db_config)
            self.cursor = self.conn.cursor()
            logger.info("✅ Connexion PostgreSQL établie")
        except Exception as e:
            logger.error(f"❌ Erreur de connexion: {e}")
            raise
    
    def close(self):
        """Fermer les connexions"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        if self.engine:
            self.engine.dispose()
        logger.info("🔒 Connexions fermées")
    
    # =====================================================
    # 3. CHARGEMENT DES DONNÉES
    # =====================================================
    
    def load_data(self):
        """Charger les données depuis les fichiers"""
        logger.info("📂 Chargement des fichiers...")
        
        try:
            # Chargement dimension centres
            df_centres = pd.read_parquet(self.file_paths['centres'])
            logger.info(f"✓ Centres: {len(df_centres)} lignes chargées")
            
            # Chargement DR year (essayer différents séparateurs)
            try:
                df_dr = pd.read_csv(self.file_paths['dr_year'], sep='\t')
            except:
                df_dr = pd.read_csv(self.file_paths['dr_year'], sep=',')
            logger.info(f"✓ DR Year: {len(df_dr)} lignes chargées")
            
            # Chargement fait totale
            try:
                df_fait = pd.read_csv(self.file_paths['fait'], sep='\t', low_memory=False)
            except:
                df_fait = pd.read_csv(self.file_paths['fait'], sep=',', low_memory=False)
            logger.info(f"✓ Fait Totale: {len(df_fait)} lignes chargées")
            
            return df_centres, df_dr, df_fait
            
        except Exception as e:
            logger.error(f"❌ Erreur chargement: {e}")
            raise
    
    # =====================================================
    # 4. NETTOYAGE ET TRANSFORMATION
    # =====================================================
    
    def clean_data(self, df_centres, df_dr, df_fait):
        """Nettoyer et transformer les données"""
        logger.info("🧹 Nettoyage des données...")
        
        # Nettoyage centres
        df_centres = df_centres.drop_duplicates(subset=['id_centre_desservi'])
        df_centres['mappable_on_map'] = df_centres['mappable_on_map'].fillna(False)
        
        # Nettoyage DR
        df_dr = df_dr.drop_duplicates(subset=['id_dr', 'annee'])
        numeric_cols = ['dr_volume_produit_traite_total', 'dr_debit_exploitable_total', 
                       'dr_taux_utilisation_mean', 'dr_n_installations_actives']
        for col in numeric_cols:
            if col in df_dr.columns:
                df_dr[col] = pd.to_numeric(df_dr[col], errors='coerce')
        
        # Nettoyage fait
        # Remplacer les chaînes vides par NaN
        df_fait = df_fait.replace(r'^\s*$', np.nan, regex=True)
        
        # Convertir les colonnes numériques
        numeric_cols_fait = ['production', 'distribution', 'cons_pop_branchee', 'cons_bf',
                            'cons_administrative', 'cons_industrielle', 'cons_autres',
                            'nbre_abonnes_particuliers', 'nbre_bf', 'abon_administratifs',
                            'abon_industrielle', 'autres_abonnes', 'taux_branchement',
                            'rend_distribution', 'rend_adduction', 'dot_pop_branchee',
                            'dot_bf', 'dot_administrative', 'dot_industrielle',
                            'dot_globale_nette', 'dot_globale_brute', 'kp',
                            'cons_totale_calc', 'production_implied',
                            'population_2024', 'menages_2024']
        
        for col in numeric_cols_fait:
            if col in df_fait.columns:
                df_fait[col] = pd.to_numeric(df_fait[col], errors='coerce')
        
        # Supprimer les doublons sur la clé composite
        df_fait = df_fait.drop_duplicates(subset=['id_centre_desservi', 'annee'])
        
        logger.info(f"✓ Centres après nettoyage: {len(df_centres)}")
        logger.info(f"✓ DR après nettoyage: {len(df_dr)}")
        logger.info(f"✓ Fait après nettoyage: {len(df_fait)}")
        
        return df_centres, df_dr, df_fait
    
    # =====================================================
    # 5. CRÉATION DES TABLES SQL
    # =====================================================
    
    def create_tables(self):
        """Créer les tables avec leurs relations"""
        logger.info("🏗️ Création des tables...")
        
        # SQL pour table dimension centres
        sql_centres = """
        DROP TABLE IF EXISTS table_dimension_centres CASCADE;
        CREATE TABLE table_dimension_centres (
            id_centre_desservi VARCHAR(50) PRIMARY KEY,
            lib_centre_desservi VARCHAR(200),
            milieu VARCHAR(20),
            id_centre_2024 VARCHAR(50),
            lib_centre_uniformise VARCHAR(200),
            code_commune VARCHAR(50),
            type_centre VARCHAR(10),
            sa_centre VARCHAR(10),
            population_2024 INTEGER,
            menages_2024 INTEGER,
            prov_key VARCHAR(50),
            id_province VARCHAR(50),
            lib_province VARCHAR(100),
            code_region_12 VARCHAR(10),
            id_dr_admin VARCHAR(20),
            libelle_region VARCHAR(100),
            srm VARCHAR(50),
            lib_commune VARCHAR(100),
            mappable_on_map BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        # SQL pour table DR year
        sql_dr = """
        DROP TABLE IF EXISTS table_dr_year CASCADE;
        CREATE TABLE table_dr_year (
            id_dr VARCHAR(20) NOT NULL,
            annee INTEGER NOT NULL,
            dr_volume_produit_traite_total NUMERIC(20,2),
            dr_debit_exploitable_total NUMERIC(20,2),
            dr_taux_utilisation_mean NUMERIC(10,4),
            dr_n_installations_actives INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id_dr, annee)
        );
        """
        
        # SQL pour table fait totale
        sql_fait = """
        DROP TABLE IF EXISTS table_fait_totale CASCADE;
        CREATE TABLE table_fait_totale (
            id_fait SERIAL PRIMARY KEY,
            id_centre_desservi VARCHAR(50),
            annee INTEGER,
            production NUMERIC(20,2),
            distribution NUMERIC(20,2),
            cons_pop_branchee NUMERIC(20,2),
            cons_bf NUMERIC(20,2),
            cons_administrative NUMERIC(20,2),
            cons_industrielle NUMERIC(20,2),
            cons_autres NUMERIC(20,2),
            nbre_abonnes_particuliers INTEGER,
            nbre_bf INTEGER,
            abon_administratifs INTEGER,
            abon_industrielle INTEGER,
            autres_abonnes INTEGER,
            taux_branchement NUMERIC(10,4),
            rend_distribution NUMERIC(10,4),
            rend_adduction NUMERIC(10,4),
            organisme_distributeur VARCHAR(50),
            dot_pop_branchee NUMERIC(20,2),
            dot_bf NUMERIC(20,2),
            dot_administrative NUMERIC(20,2),
            dot_industrielle NUMERIC(20,2),
            dot_globale_nette NUMERIC(20,2),
            dot_globale_brute NUMERIC(20,2),
            dr VARCHAR(20),
            kp NUMERIC(10,2),
            regie VARCHAR(50),
            cons_totale_calc NUMERIC(20,2),
            production_implied NUMERIC(20,2),
            lib_centre_uniformise VARCHAR(200),
            milieu VARCHAR(20),
            code_commune VARCHAR(50),
            lib_commune VARCHAR(100),
            lib_province VARCHAR(100),
            id_province VARCHAR(50),
            code_region_12 VARCHAR(10),
            libelle_region VARCHAR(100),
            srm VARCHAR(50),
            id_dr_admin VARCHAR(20),
            type_centre VARCHAR(10),
            sa_centre VARCHAR(10),
            population_2024 INTEGER,
            menages_2024 INTEGER,
            mappable_on_map BOOLEAN,
            id_dr VARCHAR(20),
            dr_volume_produit_traite_total NUMERIC(20,2),
            dr_debit_exploitable_total NUMERIC(20,2),
            dr_taux_utilisation_mean NUMERIC(10,4),
            dr_n_installations_actives INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        # SQL pour les clés étrangères
        sql_foreign_keys = """
        ALTER TABLE table_fait_totale 
        ADD CONSTRAINT fk_fait_centre 
        FOREIGN KEY (id_centre_desservi) 
        REFERENCES table_dimension_centres(id_centre_desservi)
        ON DELETE RESTRICT;
        
        ALTER TABLE table_fait_totale 
        ADD CONSTRAINT fk_fait_dr 
        FOREIGN KEY (id_dr, annee) 
        REFERENCES table_dr_year(id_dr, annee)
        ON DELETE RESTRICT;
        """
        
        # SQL pour les index
        sql_indexes = """
        CREATE INDEX IF NOT EXISTS idx_fait_centre ON table_fait_totale(id_centre_desservi);
        CREATE INDEX IF NOT EXISTS idx_fait_dr ON table_fait_totale(id_dr);
        CREATE INDEX IF NOT EXISTS idx_fait_annee ON table_fait_totale(annee);
        CREATE INDEX IF NOT EXISTS idx_fait_dr_admin ON table_fait_totale(id_dr_admin);
        CREATE INDEX IF NOT EXISTS idx_centre_province ON table_dimension_centres(id_province);
        CREATE INDEX IF NOT EXISTS idx_centre_region ON table_dimension_centres(code_region_12);
        CREATE INDEX IF NOT EXISTS idx_dr_annee ON table_dr_year(annee);
        CREATE INDEX IF NOT EXISTS idx_fait_composite ON table_fait_totale(id_centre_desservi, annee);
        """
        
        try:
            self.cursor.execute(sql_centres)
            self.cursor.execute(sql_dr)
            self.cursor.execute(sql_fait)
            self.cursor.execute(sql_foreign_keys)
            self.cursor.execute(sql_indexes)
            self.conn.commit()
            logger.info("✅ Tables créées avec succès")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Erreur création tables: {e}")
            raise
    
    # =====================================================
    # 6. IMPORT DES DONNÉES
    # =====================================================
    
    def insert_data(self, df_centres, df_dr, df_fait):
        """Insérer les données dans les tables"""
        logger.info("💾 Insertion des données...")
        
        # Insertion centres
        try:
            df_centres.to_sql('table_dimension_centres', self.engine, 
                            if_exists='append', index=False, method='multi')
            logger.info(f"✓ {len(df_centres)} centres insérés")
        except Exception as e:
            logger.error(f"❌ Erreur insertion centres: {e}")
            raise
        
        # Insertion DR
        try:
            df_dr.to_sql('table_dr_year', self.engine, 
                        if_exists='append', index=False, method='multi')
            logger.info(f"✓ {len(df_dr)} lignes DR insérées")
        except Exception as e:
            logger.error(f"❌ Erreur insertion DR: {e}")
            raise
        
        # Insertion fait (par lots pour éviter les problèmes de mémoire)
        try:
            batch_size = 5000
            for i in range(0, len(df_fait), batch_size):
                batch = df_fait.iloc[i:i+batch_size]
                batch.to_sql('table_fait_totale', self.engine, 
                           if_exists='append', index=False, method='multi')
                logger.info(f"  Lot {i//batch_size + 1}: {len(batch)} lignes insérées")
            logger.info(f"✓ {len(df_fait)} lignes fait insérées")
        except Exception as e:
            logger.error(f"❌ Erreur insertion fait: {e}")
            raise
    
    # =====================================================
    # 7. CONTRÔLE DE QUALITÉ
    # =====================================================
    
    def quality_checks(self):
        """Effectuer des contrôles de qualité"""
        logger.info("🔍 Contrôles de qualité...")
        
        checks = {}
        
        # 1. Vérifier les clés étrangères orphelines
        self.cursor.execute("""
            SELECT 'Centres orphelins' as check_name, COUNT(*) as count
            FROM table_fait_totale f
            LEFT JOIN table_dimension_centres c ON f.id_centre_desservi = c.id_centre_desservi
            WHERE c.id_centre_desservi IS NULL
            UNION ALL
            SELECT 'DR orphelines', COUNT(*)
            FROM table_fait_totale f
            LEFT JOIN table_dr_year dr ON f.id_dr = dr.id_dr AND f.annee = dr.annee
            WHERE dr.id_dr IS NULL
        """)
        
        for check_name, count in self.cursor.fetchall():
            checks[check_name] = count
            if count > 0:
                logger.warning(f"⚠️ {check_name}: {count} enregistrements")
            else:
                logger.info(f"✅ {check_name}: OK")
        
        # 2. Vérifier les doublons
        self.cursor.execute("""
            SELECT 'Doublons fait' as check_name, COUNT(*) as count
            FROM (
                SELECT id_centre_desservi, annee, COUNT(*)
                FROM table_fait_totale
                GROUP BY id_centre_desservi, annee
                HAVING COUNT(*) > 1
            ) dup
        """)
        
        for check_name, count in self.cursor.fetchall():
            checks[check_name] = count
            if count > 0:
                logger.warning(f"⚠️ {check_name}: {count} groupes dupliqués")
        
        # 3. Vérifier les valeurs nulles critiques
        self.cursor.execute("""
            SELECT 
                SUM(CASE WHEN id_centre_desservi IS NULL THEN 1 ELSE 0 END) as null_id_centre,
                SUM(CASE WHEN annee IS NULL THEN 1 ELSE 0 END) as null_annee
            FROM table_fait_totale
        """)
        
        null_id_centre, null_annee = self.cursor.fetchone()
        if null_id_centre > 0 or null_annee > 0:
            logger.warning(f"⚠️ Valeurs nulles: id_centre={null_id_centre}, annee={null_annee}")
        
        # 4. Statistiques globales
        self.cursor.execute("""
            SELECT 
                (SELECT COUNT(*) FROM table_dimension_centres) as nb_centres,
                (SELECT COUNT(*) FROM table_dr_year) as nb_dr,
                (SELECT COUNT(*) FROM table_fait_totale) as nb_faits,
                (SELECT MIN(annee) FROM table_fait_totale) as annee_min,
                (SELECT MAX(annee) FROM table_fait_totale) as annee_max
        """)
        
        stats = self.cursor.fetchone()
        logger.info(f"📊 Statistiques: {stats[0]} centres, {stats[1]} DR, {stats[2]} faits, années {stats[3]}-{stats[4]}")
        
        return checks
    
    # =====================================================
    # 8. CRÉATION DES VUES ANALYTIQUES
    # =====================================================
    
    def create_analytics_views(self):
        """Créer des vues pour l'analyse"""
        logger.info("📊 Création des vues analytiques...")
        
        # Vue consolidée
        view_consolidee = """
        CREATE OR REPLACE VIEW vue_consolidee_eau AS
        SELECT 
            f.id_fait,
            f.annee,
            c.lib_centre_uniformise as centre,
            c.lib_province as province,
            c.libelle_region as region,
            c.population_2024,
            dr.id_dr,
            f.production,
            f.distribution,
            f.cons_pop_branchee,
            f.taux_branchement,
            f.rend_distribution,
            f.dot_globale_nette
        FROM table_fait_totale f
        JOIN table_dimension_centres c ON f.id_centre_desservi = c.id_centre_desservi
        JOIN table_dr_year dr ON f.id_dr = dr.id_dr AND f.annee = dr.annee;
        """
        
        # Vue KPIs régionaux
        view_kpi_region = """
        CREATE OR REPLACE VIEW vue_kpi_region_annee AS
        SELECT 
            region,
            annee,
            COUNT(DISTINCT centre) as nb_centres,
            SUM(production) as production_totale,
            SUM(distribution) as distribution_totale,
            AVG(taux_branchement) as taux_branchement_moyen,
            AVG(rend_distribution) as rendement_moyen,
            SUM(dot_globale_nette) as dotations_totales
        FROM vue_consolidee_eau
        GROUP BY region, annee
        ORDER BY region, annee;
        """
        
        try:
            self.cursor.execute(view_consolidee)
            self.cursor.execute(view_kpi_region)
            self.conn.commit()
            logger.info("✅ Vues analytiques créées")
        except Exception as e:
            logger.error(f"❌ Erreur création vues: {e}")
    
    # =====================================================
    # 9. EXÉCUTION PRINCIPALE
    # =====================================================
    
    def run(self):
        """Exécuter l'ETL complet"""
        logger.info("🚀 Démarrage de l'ETL...")
        start_time = datetime.now()
        
        try:
            # 1. Connexion
            self.connect()
            
            # 2. Chargement
            df_centres, df_dr, df_fait = self.load_data()
            
            # 3. Nettoyage
            df_centres, df_dr, df_fait = self.clean_data(df_centres, df_dr, df_fait)
            
            # 4. Création tables
            self.create_tables()
            
            # 5. Insertion données
            self.insert_data(df_centres, df_dr, df_fait)
            
            # 6. Contrôles qualité
            checks = self.quality_checks()
            
            # 7. Vues analytiques
            self.create_analytics_views()
            
            # 8. Rapport final
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info("="*50)
            logger.info(f"✅ ETL terminé avec succès!")
            logger.info(f"⏱️ Durée: {duration:.2f} secondes")
            logger.info(f"📁 Logs: etl_{start_time.strftime('%Y%m%d_%H%M%S')}.log")
            logger.info("="*50)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ ETL échoué: {e}")
            self.conn.rollback()
            return False
        finally:
            self.close()


# =====================================================
# 10. EXÉCUTION
# =====================================================

if __name__ == "__main__":
    # Créer et exécuter l'ETL
    etl = WaterDataETL(DB_CONFIG, FILE_PATHS)
    success = etl.run()
    
    if success:
        print("\n🎉 Migration réussie! Vérifiez les logs pour plus de détails.")
    else:
        print("\n💥 Migration échouée! Consultez les logs.")