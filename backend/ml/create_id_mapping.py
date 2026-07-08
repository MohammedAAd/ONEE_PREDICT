"""
Création du mapping complet des IDs pour la population
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from database import get_connection

def create_complete_mapping():
    """Crée le mapping entre ID_Centre_Desservi et toutes les populations"""
    
    print("=" * 60)
    print("🔗 CRÉATION DU MAPPING COMPLET DES POPULATIONS")
    print("=" * 60)
    
    conn = get_connection()
    
    # 1. Charger les correspondances
    print("\n1️⃣ Chargement des correspondances...")
    
    # Link_Centres_Desservis_HCP
    df_link1 = pd.read_sql("SELECT * FROM [Link_Centres_Desservis_HCP]", conn)
    df_link1.columns = ['id_oper', 'id_2024']
    print(f"   Link_Centres_Desservis_HCP: {len(df_link1)} liens")
    
    # Link_Centres 2024-2014 (attention: nom avec espace)
    df_link2 = pd.read_sql("SELECT * FROM [Link_Centres 2024-2014]", conn)
    df_link2.columns = ['id_2024', 'id_2014']
    print(f"   Link_Centres 2024-2014: {len(df_link2)} liens")
    
    # LINK_CENTRES_2014_2004
    df_link3 = pd.read_sql("SELECT * FROM [LINK_CENTRES_2014_2004]", conn)
    df_link3.columns = ['id_2004', 'id_2014']
    print(f"   LINK_CENTRES_2014_2004: {len(df_link3)} liens")
    
    # 2. Charger les populations
    print("\n2️⃣ Chargement des populations...")
    
    # Population 2004
    df_pop_2004 = pd.read_sql("""
        SELECT 
            ID_CENTRE_HCP_2004 as id_2004,
            Population_2004 as pop_2004
        FROM [CENTRES_HCP_2004]
    """, conn)
    print(f"   Population 2004: {len(df_pop_2004)} centres")
    
    # Population 2014
    df_pop_2014 = pd.read_sql("""
        SELECT 
            Code_Centre_2014 as id_2014,
            Population_2014 as pop_2014
        FROM [CENTRES_HCP_2014]
    """, conn)
    print(f"   Population 2014: {len(df_pop_2014)} centres")
    
    # Population 2024
    df_pop_2024 = pd.read_sql("""
        SELECT 
            ID_CENTRE_2024 as id_2024,
            [Population 2024] as pop_2024
        FROM [Ref_CENTRES_HCP_2024]
    """, conn)
    print(f"   Population 2024: {len(df_pop_2024)} centres")
    
    # 3. Joindre toutes les tables
    print("\n3️⃣ Jointure des tables...")
    
    # Étape 1: lier id_oper -> id_2024
    mapping = df_link1.copy()
    
    # Étape 2: ajouter id_2014 via Link_Centres 2024-2014
    mapping = mapping.merge(df_link2, on='id_2024', how='left')
    
    # Étape 3: ajouter id_2004 via LINK_CENTRES_2014_2004
    mapping = mapping.merge(df_link3, on='id_2014', how='left')
    
    # 4. Ajouter les populations
    print("\n4️⃣ Ajout des populations...")
    
    # Population 2024
    mapping = mapping.merge(df_pop_2024, on='id_2024', how='left')
    
    # Population 2014
    mapping = mapping.merge(df_pop_2014, on='id_2014', how='left')
    
    # Population 2004
    mapping = mapping.merge(df_pop_2004, on='id_2004', how='left')
    
    # 5. Nettoyer et sauvegarder
    print("\n5️⃣ Nettoyage et sauvegarde...")
    
    # Garder les colonnes utiles
    mapping = mapping[['id_oper', 'id_2024', 'id_2014', 'id_2004', 'pop_2024', 'pop_2014', 'pop_2004']]
    
    # Remplacer les NaN par None
    mapping = mapping.where(pd.notna(mapping), None)
    
    print(f"\n   ✅ Mapping créé: {len(mapping)} entrées")
    print(f"   ✅ Centres avec population 2024: {mapping['pop_2024'].notna().sum()}")
    print(f"   ✅ Centres avec population 2014: {mapping['pop_2014'].notna().sum()}")
    print(f"   ✅ Centres avec population 2004: {mapping['pop_2004'].notna().sum()}")
    
    # Sauvegarder
    mapping.to_csv('backend/ml/data/centre_population_mapping.csv', index=False)
    print("\n   💾 Sauvegardé: backend/ml/data/centre_population_mapping.csv")
    
    # Afficher un aperçu
    print("\n📊 Aperçu du mapping:")
    print(mapping.head(10).to_string())
    
    conn.close()
    return mapping

def verify_mapping():
    """Vérifie que le mapping fonctionne avec Fact_Activite_AEP"""
    
    print("\n" + "=" * 60)
    print("🔍 VÉRIFICATION DU MAPPING")
    print("=" * 60)
    
    conn = get_connection()
    
    # Prendre quelques exemples de Fact_Activite_AEP
    df_fact = pd.read_sql("SELECT DISTINCT TOP 10 ID_Centre_Desservi FROM [Fact_Activite_AEP]", conn)
    print("\nExemples d'IDs dans Fact_Activite_AEP:")
    print(df_fact)
    
    # Charger le mapping
    mapping = pd.read_csv('backend/ml/data/centre_population_mapping.csv')
    
    print("\nCorrespondances trouvées:")
    for idx, row in df_fact.iterrows():
        centre_id = str(row['ID_Centre_Desservi']).strip()
        match = mapping[mapping['id_oper'] == centre_id]
        if not match.empty:
            pop_2024 = match.iloc[0]['pop_2024']
            print(f"   {centre_id} → Population 2024: {pop_2024}")
        else:
            print(f"   {centre_id} → ❌ Aucune correspondance")
    
    conn.close()

if __name__ == "__main__":
    mapping = create_complete_mapping()
    verify_mapping()