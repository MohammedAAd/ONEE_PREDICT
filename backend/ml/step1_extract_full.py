"""
ÉTAPE 1: Extraction complète des données (1994-2024)
Version avec noms de colonnes corrects
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from database import get_connection

def extract_full_data():
    """Extrait toutes les données nécessaires"""
    
    print("=" * 60)
    print("📡 EXTRACTION COMPLÈTE DES DONNÉES (1994-2024)")
    print("=" * 60)
    
    conn = get_connection()
    if not conn:
        print("❌ Erreur de connexion")
        return None
    
    # 1. Fact_Activite_AEP
    print("\n1️⃣ Extraction de Fact_Activite_AEP...")
    df_fact = pd.read_sql("SELECT * FROM [Fact_Activite_AEP]", conn)
    
    # Renommer les colonnes
    rename_cols = {
        'ID_Centre_Desservi': 'centre_id',
        'Annee': 'annee',
        'PRODUCTION': 'production',
        'DISTRIBUTION': 'distribution',
        'Cons_Pop_branchee': 'conso_pop_branchee',
        'Cons_ BF': 'conso_bf',
        'Cons_Administrative': 'conso_admin',
        'Cons_Industrielle': 'conso_industrielle',
        'Cons_Autres': 'conso_autres',
        'Nbre_Abonnes_particuliers': 'nb_abonnes',
        'Taux_branchement': 'taux_branchement',
        'Rend_Distribution': 'rendement_distribution',
        'Rend_Adduction': 'rendement_adduction',
        'Dot_Pop_branchee': 'dotation_pb',
        'Dot_BF': 'dotation_bf',
        'Dot_administrative': 'dotation_admin',
        'Dot_industrielle': 'dotation_industrielle',
        'Dot_globale_nette': 'dotation_nette',
        'Dot_globale_brute': 'dotation_brute',
        'DR': 'dr'
    }
    
    existing_rename = {k: v for k, v in rename_cols.items() if k in df_fact.columns}
    df_fact = df_fact.rename(columns=existing_rename)
    
    print(f"   ✓ {len(df_fact)} lignes extraites")
    print(f"   ✓ Période: {df_fact['annee'].min()} - {df_fact['annee'].max()}")
    print(f"   ✓ Centres: {df_fact['centre_id'].nunique()}")
    
    # 2. Population 2004 - avec les bons noms de colonnes
    print("\n2️⃣ Extraction de CENTRES_HCP_2004...")
    df_pop_2004 = pd.read_sql("""
        SELECT 
            ID_CENTRE_HCP_2004 as centre_id,
            Population_1994 as pop_1994,
            Population_2004 as pop_2004
        FROM [CENTRES_HCP_2004]
    """, conn)
    print(f"   ✓ {len(df_pop_2004)} centres")
    
    # 3. Population 2014
    print("\n3️⃣ Extraction de CENTRES_HCP_2014...")
    df_pop_2014 = pd.read_sql("""
        SELECT 
            Code_Centre_2014 as centre_id,
            Population_2014 as pop_2014
        FROM [CENTRES_HCP_2014]
    """, conn)
    print(f"   ✓ {len(df_pop_2014)} centres")
    
    # 4. Population 2024 - avec les bons noms de colonnes
    print("\n4️⃣ Extraction de Ref_CENTRES_HCP_2024...")
    df_pop_2024 = pd.read_sql("""
        SELECT 
            ID_CENTRE_2024 as centre_id,
            [Population 2024] as pop_2024
        FROM [Ref_CENTRES_HCP_2024]
    """, conn)
    print(f"   ✓ {len(df_pop_2024)} centres")
    
    # 5. Mapping des noms
    print("\n5️⃣ Extraction des noms des centres...")
    df_names = pd.read_sql("""
        SELECT 
            ID_Centre_Desservi as centre_id,
            LIB_CENTRE_Desservi as centre_name
        FROM [CENTRES_DESSERVIS]
        WHERE LIB_CENTRE_Desservi IS NOT NULL
    """, conn)
    print(f"   ✓ {len(df_names)} noms de centres")
    
    conn.close()
    
    return {
        'fact_activite': df_fact,
        'pop_2004': df_pop_2004,
        'pop_2014': df_pop_2014,
        'pop_2024': df_pop_2024,
        'centre_names': df_names
    }

def save_extracted_data(data):
    """Sauvegarde les données extraites"""
    os.makedirs('backend/ml/data', exist_ok=True)
    for name, df in data.items():
        if df is not None and not df.empty:
            df.to_csv(f'backend/ml/data/{name}.csv', index=False)
            print(f"   ✓ Sauvegardé: {name}.csv ({len(df)} lignes)")

if __name__ == "__main__":
    data = extract_full_data()
    if data:
        save_extracted_data(data)
        print("\n✅ EXTRACTION COMPLÈTE TERMINÉE!")