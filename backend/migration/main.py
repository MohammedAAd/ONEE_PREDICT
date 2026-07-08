"""Migration finale ONEE avec TOUTES les relations"""
from config import ACCESS_FILE, POSTGRES_CONFIG
from extract_access import extract_table, get_table_list
from load_postgres import test_postgres_connection, create_postgres_engine
import pandas as pd
from sqlalchemy import text
from datetime import datetime

def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Nettoie les noms de colonnes pour PostgreSQL"""
    df.columns = [col.strip().replace(" ", "_").replace("-", "_").replace("/", "_").lower() for col in df.columns]
    return df

# Liste complète des tables avec leurs noms PostgreSQL
TABLES_MAPPING = {
    # Tables de référence principales
    "CENTRES_HCP_2004": "centres_hcp_2004",
    "CENTRES_HCP_2014": "centres_hcp_2014",
    "Ref_CENTRES_HCP_2024": "ref_centres_hcp_2024",
    "COMMUNES_2024": "communes_2024",
    "PROVINCES": "provinces",
    "REGIONS": "regions",
    "CENTRES_DESSERVIS": "centres_desservis",
    
    # Tables de faits
    "Fact_Activite_AEP": "fact_activite_aep",
    "INSTALLATIONS_PRODUCTION": "installations_production",
    "Production_Mensuelle_Par_Installation": "production_mensuelle",
    
    # Tables de liaison
    "Link_Centres 2024-2014": "link_centres_2024_2014",
    "Link_CENTRES_2014_2004": "link_centres_2014_2004",
    "Link_Centres_Desservis_HCP": "link_centres_desservis_hcp",
}

# Relations exactes (d'après votre tableau)
RELATIONS = [
    # Hiérarchie territoriale
    {
        "name": "fk_commune_province",
        "parent_table": "communes_2024",
        "parent_column": "code_province",
        "referenced_table": "provinces",
        "referenced_column": "id_province"
    },
    {
        "name": "fk_province_region",
        "parent_table": "provinces",
        "parent_column": "code_region_12",
        "referenced_table": "regions",
        "referenced_column": "code_region_12"
    },
    
    # Liaison centres 2004 → 2014
    {
        "name": "fk_link_centres_2014_2004_2004",
        "parent_table": "link_centres_2014_2004",
        "parent_column": "id_centre_hcp_2004",
        "referenced_table": "centres_hcp_2004",
        "referenced_column": "id_centre_hcp_2004"
    },
    {
        "name": "fk_link_centres_2014_2004_2014",
        "parent_table": "link_centres_2014_2004",
        "parent_column": "code_centre_2014",
        "referenced_table": "centres_hcp_2014",
        "referenced_column": "code_centre_2014"
    },
    
    # Liaison centres 2014 → 2024
    {
        "name": "fk_link_centres_2024_2014_2024",
        "parent_table": "link_centres_2024_2014",
        "parent_column": "id_centre_2024",
        "referenced_table": "ref_centres_hcp_2024",
        "referenced_column": "id_centre_2024"
    },
    {
        "name": "fk_link_centres_2024_2014_2014",
        "parent_table": "link_centres_2024_2014",
        "parent_column": "code_centre_2014",
        "referenced_table": "centres_hcp_2014",
        "referenced_column": "code_centre_2014"
    },
    
    # Liaison centres desservis
    {
        "name": "fk_link_desservis_desservi",
        "parent_table": "link_centres_desservis_hcp",
        "parent_column": "id_centre_desservi",
        "referenced_table": "centres_desservis",
        "referenced_column": "id_centre_desservi"
    },
    {
        "name": "fk_link_desservis_centre2024",
        "parent_table": "link_centres_desservis_hcp",
        "parent_column": "id_centre_2024",
        "referenced_table": "ref_centres_hcp_2024",
        "referenced_column": "id_centre_2024"
    },
    
    # Relation centres desservis → centre 2024 (directe)
    {
        "name": "fk_centre_desservis_centre2024",
        "parent_table": "ref_centres_hcp_2024",
        "parent_column": "id_centre_desservi",
        "referenced_table": "centres_desservis",
        "referenced_column": "id_centre_desservi"
    },
    
    # Centre 2024 → commune
    {
        "name": "fk_centre_commune",
        "parent_table": "ref_centres_hcp_2024",
        "parent_column": "code_commune",
        "referenced_table": "communes_2024",
        "referenced_column": "code_commune"
    },
    
    # Tables de faits
    {
        "name": "fk_fact_aep_centre_desservi",
        "parent_table": "fact_activite_aep",
        "parent_column": "id_centre_desservi",
        "referenced_table": "centres_desservis",
        "referenced_column": "id_centre_desservi"
    },
    {
        "name": "fk_production_installation",
        "parent_table": "production_mensuelle",
        "parent_column": "installation",
        "referenced_table": "installations_production",
        "referenced_column": "installation"
    },
]

def extract_all_tables():
    """Extrait toutes les tables avec gestion d'erreurs"""
    extracted_data = {}
    
    print("\n" + "=" * 70)
    print("📥 EXTRACTION DES TABLES")
    print("=" * 70)
    
    for access_name, pg_name in TABLES_MAPPING.items():
        print(f"\n📋 Lecture: {access_name} → {pg_name}")
        try:
            df = extract_table(ACCESS_FILE, access_name)
            if len(df) > 0:
                df = clean_column_names(df)
                extracted_data[pg_name] = df
                print(f"   ✅ {len(df):,} lignes, {len(df.columns)} colonnes")
                
                # Afficher les colonnes importantes
                id_cols = [c for c in df.columns if 'id_' in c or 'code_' in c]
                if id_cols:
                    print(f"   🔑 Colonnes clés: {id_cols[:5]}")
            else:
                print(f"   ⚠️ Table vide")
                extracted_data[pg_name] = pd.DataFrame()
        except Exception as e:
            print(f"   ❌ Erreur: {e}")
            extracted_data[pg_name] = pd.DataFrame()
    
    return extracted_data

def create_tables_with_relations(engine, data: dict):
    """Crée les tables avec toutes les relations"""
    
    print("\n" + "=" * 70)
    print("🏗️  CRÉATION DES TABLES ET RELATIONS")
    print("=" * 70)
    
    # Ordre de création (dépendances d'abord)
    creation_order = [
        "regions",           # Niveau 1
        "provinces",         # Niveau 2 (dépend de regions)
        "communes_2024",     # Niveau 3 (dépend de provinces)
        "centres_hcp_2004",  # Tables indépendantes
        "centres_hcp_2014",
        "centres_desservis",
        "ref_centres_hcp_2024",  # Dépend de communes et centres_desservis
        "installations_production",
        "link_centres_2014_2004",    # Tables de liaison
        "link_centres_2024_2014",
        "link_centres_desservis_hcp",
        "fact_activite_aep",          # Tables de faits
        "production_mensuelle"
    ]
    
    dtype_mapping = {
        'object': 'TEXT',
        'string': 'TEXT',
        'int64': 'INTEGER',
        'float64': 'DOUBLE PRECISION',
        'datetime64[ns]': 'TIMESTAMP'
    }
    
    for table_name in creation_order:
        if table_name not in data or data[table_name].empty:
            print(f"   ⚠️ Table {table_name} vide ou inexistante, ignorée")
            continue
            
        df = data[table_name]
        
        # Générer les colonnes
        columns = []
        for col, dtype in df.dtypes.items():
            sql_type = dtype_mapping.get(str(dtype), 'TEXT')
            # Échapper les noms de colonnes
            columns.append(f'"{col}" {sql_type}')
        
        create_sql = f"""
        DROP TABLE IF EXISTS {table_name} CASCADE;
        CREATE TABLE {table_name} (
            {', '.join(columns)}
        );
        """
        
        try:
            with engine.connect() as conn:
                conn.execute(text(create_sql))
                conn.commit()
            print(f"   ✅ Table créée: {table_name} ({len(columns)} colonnes)")
        except Exception as e:
            print(f"   ❌ Erreur création {table_name}: {e}")
    
    # Ajouter toutes les clés étrangères
    print("\n🔗 Ajout des clés étrangères...")
    for rel in RELATIONS:
        fk_name = rel["name"]
        parent_table = rel["parent_table"]
        parent_col = rel["parent_column"]
        ref_table = rel["referenced_table"]
        ref_col = rel["referenced_column"]
        
        # Vérifier que les tables existent
        if parent_table not in creation_order or ref_table not in creation_order:
            print(f"   ⚠️ Relation {fk_name}: table manquante")
            continue
            
        fk_sql = f"""
        ALTER TABLE {parent_table} 
        ADD CONSTRAINT {fk_name} 
        FOREIGN KEY ("{parent_col}") 
        REFERENCES {ref_table}("{ref_col}")
        ON DELETE SET NULL
        """
        
        try:
            with engine.connect() as conn:
                conn.execute(text(fk_sql))
                conn.commit()
            print(f"   ✅ {fk_name}: {parent_table}.{parent_col} → {ref_table}.{ref_col}")
        except Exception as e:
            print(f"   ⚠️ {fk_name}: {str(e)[:80]}")

def load_all_data(engine, data: dict):
    """Charge toutes les données"""
    
    print("\n" + "=" * 70)
    print("💾 CHARGEMENT DES DONNÉES")
    print("=" * 70)
    
    # Ordre de chargement (respecte les dépendances)
    load_order = [
        "regions", "provinces", "communes_2024",
        "centres_hcp_2004", "centres_hcp_2014", "centres_desservis",
        "ref_centres_hcp_2024", "installations_production",
        "link_centres_2014_2004", "link_centres_2024_2014", "link_centres_desservis_hcp",
        "fact_activite_aep", "production_mensuelle"
    ]
    
    for table_name in load_order:
        if table_name not in data or data[table_name].empty:
            continue
            
        df = data[table_name]
        print(f"\n📤 Chargement: {table_name}")
        
        try:
            df.to_sql(
                table_name,
                engine,
                if_exists='append',
                index=False,
                method='multi',
                chunksize=500
            )
            print(f"   ✅ {len(df):,} lignes chargées")
        except Exception as e:
            print(f"   ❌ Erreur: {e}")

def create_analytics_views(engine):
    """Crée des vues pour l'analyse"""
    
    views = {
        "vue_hierarchie_complete": """
        CREATE OR REPLACE VIEW vue_hierarchie_complete AS
        SELECT 
            -- Niveaux géographiques
            r.code_region_12,
            r.libelle_region as region,
            p.id_province,
            p.lib_province as province,
            com.code_commune,
            com.lib_commune as commune,
            
            -- Centres 2004
            c2004.id_centre_hcp_2004,
            c2004.lib_centre as centre_2004_nom,
            c2004.type_centre as type_centre_2004,
            
            -- Centres 2014
            c2014.code_centre_2014,
            c2014.lib_centre_2014 as centre_2014_nom,
            
            -- Centres 2024
            c2024.id_centre_2024,
            c2024.lib_centre_uniforme as centre_2024_nom,
            c2024.type_centre,
            c2024.sa_centre,
            c2024.population_2024,
            
            -- Centres desservis
            cd.id_centre_desservi,
            cd.lib_centre_desservi as centre_desservi_nom
            
        FROM regions r
        LEFT JOIN provinces p ON r.code_region_12 = p.code_region_12
        LEFT JOIN communes_2024 com ON p.id_province = com.code_province
        LEFT JOIN ref_centres_hcp_2024 c2024 ON com.code_commune = c2024.code_commune
        LEFT JOIN link_centres_2024_2014 link24 ON c2024.id_centre_2024 = link24.id_centre_2024
        LEFT JOIN centres_hcp_2014 c2014 ON link24.code_centre_2014 = c2014.code_centre_2014
        LEFT JOIN link_centres_2014_2004 link14 ON c2014.code_centre_2014 = link14.code_centre_2014
        LEFT JOIN centres_hcp_2004 c2004 ON link14.id_centre_hcp_2004 = c2004.id_centre_hcp_2004
        LEFT JOIN link_centres_desservis_hcp link_d ON c2024.id_centre_2024 = link_d.id_centre_2024
        LEFT JOIN centres_desservis cd ON link_d.id_centre_desservi = cd.id_centre_desservi
        ORDER BY r.code_region_12, com.code_commune
        """,
        
        "vue_activite_aep_geo": """
        CREATE OR REPLACE VIEW vue_activite_aep_geo AS
        SELECT 
            fa.annee,
            fa.production,
            fa.distribution,
            fa.date_ban_hr,
            cd.id_centre_desservi,
            cd.lib_centre_desservi as centre_desservi,
            c2024.id_centre_2024,
            c2024.lib_centre_uniforme as centre_2024,
            com.code_commune,
            com.lib_commune as commune,
            p.lib_province as province,
            r.libelle_region as region
        FROM fact_activite_aep fa
        LEFT JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
        LEFT JOIN ref_centres_hcp_2024 c2024 ON cd.id_centre_desservi = c2024.id_centre_desservi
        LEFT JOIN communes_2024 com ON c2024.code_commune = com.code_commune
        LEFT JOIN provinces p ON com.code_province = p.id_province
        LEFT JOIN regions r ON p.code_region_12 = r.code_region_12
        ORDER BY fa.annee DESC
        """,
        
        "stats_production_region": """
        CREATE OR REPLACE VIEW stats_production_region AS
        SELECT 
            r.libelle_region as region,
            COUNT(DISTINCT c2024.id_centre_2024) as nb_centres,
            COUNT(DISTINCT cd.id_centre_desservi) as nb_centres_desservis,
            SUM(c2024.population_2024) as population_desservie,
            AVG(fa.production) as production_moyenne,
            SUM(fa.production) as production_totale
        FROM regions r
        LEFT JOIN provinces p ON r.code_region_12 = p.code_region_12
        LEFT JOIN communes_2024 com ON p.id_province = com.code_province
        LEFT JOIN ref_centres_hcp_2024 c2024 ON com.code_commune = c2024.code_commune
        LEFT JOIN link_centres_desservis_hcp link ON c2024.id_centre_2024 = link.id_centre_2024
        LEFT JOIN centres_desservis cd ON link.id_centre_desservi = cd.id_centre_desservi
        LEFT JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
        GROUP BY r.libelle_region
        ORDER BY production_totale DESC
        """
    }
    
    print("\n📊 Création des vues analytiques...")
    for view_name, view_sql in views.items():
        try:
            with engine.connect() as conn:
                conn.execute(text(view_sql))
                conn.commit()
            print(f"   ✅ Vue créée: {view_name}")
            
            # Compter les lignes
            result = conn.execute(text(f"SELECT COUNT(*) FROM {view_name}"))
            count = result.fetchone()[0]
            print(f"      📊 {count:,} lignes")
            
        except Exception as e:
            print(f"   ❌ Erreur {view_name}: {e}")

def verify_relations(engine):
    """Vérifie que toutes les relations sont actives"""
    
    print("\n🔍 VÉRIFICATION DES RELATIONS")
    
    # Liste des contraintes FK
    check_sql = """
    SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as referenced_table
    FROM pg_constraint 
    WHERE contype = 'f'
    ORDER BY conname
    """
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(check_sql))
            constraints = result.fetchall()
            print(f"   ✅ {len(constraints)} contraintes de clé étrangère actives")
            for c in constraints:
                print(f"      - {c[0]}: {c[1]} → {c[2]}")
    except Exception as e:
        print(f"   ⚠️ Erreur vérification: {e}")

def main():
    """Pipeline principal"""
    print("=" * 70)
    print("🏗️  MIGRATION ONEE - VERSION COMPLÈTE")
    print(f"Début: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # 1. Tester PostgreSQL
    if not test_postgres_connection(POSTGRES_CONFIG):
        return False
    
    # 2. Extraire les données
    data = extract_all_tables()
    
    if not data:
        print("❌ Aucune donnée extraite")
        return False
    
    # 3. Créer engine
    engine = create_postgres_engine(POSTGRES_CONFIG)
    
    # 4. Créer tables et relations
    create_tables_with_relations(engine, data)
    
    # 5. Charger les données
    load_all_data(engine, data)
    
    # 6. Créer les vues
    create_analytics_views(engine)
    
    # 7. Vérifier les relations
    verify_relations(engine)
    
    # 8. Résumé final
    print("\n" + "=" * 70)
    print("✅ MIGRATION TERMINÉE AVEC SUCCÈS !")
    print("=" * 70)
    print("\n📊 Vues disponibles pour votre dashboard:")
    print("   1. vue_hierarchie_complete - Toute la hiérarchie territoriale")
    print("   2. vue_activite_aep_geo - Activité AEP par zone géographique")
    print("   3. stats_production_region - Statistiques par région")
    
    print("\n🎯 Exemples de requêtes:")
    print("   -- Tous les centres d'une région:")
    print("   SELECT * FROM vue_hierarchie_complete WHERE region = 'Casablanca-Settat';")
    print("\n   -- Production AEP par province:")
    print("   SELECT province, SUM(production) FROM vue_activite_aep_geo GROUP BY province;")
    
    engine.dispose()
    return True

if __name__ == "__main__":
    main()