"""
Vérification des correspondances d'IDs
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from database import get_connection

def list_all_tables(conn):
    """Liste toutes les tables disponibles"""
    cursor = conn.cursor()
    cursor.tables(tableType='TABLE')
    tables = [row.table_name for row in cursor.fetchall()]
    print("📋 Tables disponibles:")
    for t in sorted(tables):
        print(f"   - {t}")
    return tables

def create_id_mapping():
    """Crée un mapping entre les IDs de Fact_Activite et les IDs HCP"""
    
    conn = get_connection()
    
    # Lister toutes les tables
    print("=" * 60)
    print("📋 VÉRIFICATION DES TABLES DISPONIBLES")
    print("=" * 60)
    tables = list_all_tables(conn)
    
    # Chercher les tables de correspondance
    print("\n" + "=" * 60)
    print("🔗 CHARGEMENT DES CORRESPONDANCES")
    print("=" * 60)
    
    # Link_Centres_Desservis_HCP
    df_link = pd.read_sql("SELECT * FROM [Link_Centres_Desservis_HCP]", conn)
    print(f"\n📌 Link_Centres_Desservis_HCP: {len(df_link)} lignes")
    print(f"   Colonnes: {df_link.columns.tolist()}")
    print("   Aperçu:")
    print(df_link.head(10))
    
    # Chercher Link_Centres_2024_2014 (peut-être nom différent)
    link_names = [t for t in tables if 'Link' in t and '2024' in t]
    print(f"\n📌 Tables de correspondance trouvées: {link_names}")
    
    df_link_2024_2014 = None
    for name in link_names:
        try:
            df_temp = pd.read_sql(f"SELECT * FROM [{name}]", conn)
            print(f"   Table {name}: {len(df_temp)} lignes, colonnes: {df_temp.columns.tolist()}")
            if '2024' in name and '2014' in name:
                df_link_2024_2014 = df_temp
        except Exception as e:
            print(f"   ❌ Erreur pour {name}: {e}")
    
    # LINK_CENTRES_2014_2004
    df_link_2014_2004 = pd.read_sql("SELECT * FROM [LINK_CENTRES_2014_2004]", conn)
    print(f"\n📌 LINK_CENTRES_2014_2004: {len(df_link_2014_2004)} lignes")
    print(f"   Colonnes: {df_link_2014_2004.columns.tolist()}")
    
    # Échantillon des IDs de Fact_Activite_AEP
    df_fact = pd.read_sql("SELECT DISTINCT ID_Centre_Desservi FROM [Fact_Activite_AEP] LIMIT 20", conn)
    print(f"\n📌 Exemples d'IDs dans Fact_Activite_AEP:")
    print(df_fact.head(20))
    
    conn.close()
    
    return df_link, df_link_2024_2014, df_link_2014_2004

if __name__ == "__main__":
    create_id_mapping()