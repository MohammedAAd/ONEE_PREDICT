# backend/ml/build_correct_population_mapping.py
"""
Construit le mapping correct des populations en agrégeant tous les sous-centres HCP
"""
import pandas as pd
import numpy as np
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection

def build_correct_mapping():
    """Construit le mapping population pour tous les centres opérationnels"""
    
    print("=" * 60)
    print("CONSTRUCTION DU MAPPING CORRECT DES POPULATIONS")
    print("=" * 60)
    
    conn = get_connection()
    
    # 1. Charger la correspondance centre_oper -> hcp
    print("\n1. Chargement de Link_Centres_Desservis_HCP...")
    df_link = pd.read_sql("""
        SELECT 
            ID_Centre_Desservi as id_oper,
            ID_CENTRE_2024 as id_hcp
        FROM [Link_Centres_Desservis_HCP]
    """, conn)
    print(f"   {len(df_link)} liens trouvés")
    
    # 2. Charger la correspondance hcp_2024 -> hcp_2014
    print("\n2. Chargement de Link_Centres 2024-2014...")
    df_link_2024_2014 = pd.read_sql("""
        SELECT 
            ID_CENTRE_2024 as id_2024,
            Code_Centre_2014 as id_2014
        FROM [Link_Centres 2024-2014]
    """, conn)
    print(f"   {len(df_link_2024_2014)} liens trouvés")
    
    # 3. Charger la correspondance hcp_2014 -> hcp_2004
    print("\n3. Chargement de LINK_CENTRES_2014_2004...")
    df_link_2014_2004 = pd.read_sql("""
        SELECT 
            ID_CENTRE_HCP_2004 as id_2004,
            Code_Centre_2014 as id_2014
        FROM [LINK_CENTRES_2014_2004]
    """, conn)
    print(f"   {len(df_link_2014_2004)} liens trouvés")
    
    # 4. Charger les populations
    print("\n4. Chargement des populations...")
    
    # Population 2024
    df_pop_2024 = pd.read_sql("""
        SELECT 
            ID_CENTRE_2024 as id_2024,
            [Population 2024] as pop_2024
        FROM [Ref_CENTRES_HCP_2024]
    """, conn)
    print(f"   Population 2024: {len(df_pop_2024)} lignes")
    
    # Population 2014
    df_pop_2014 = pd.read_sql("""
        SELECT 
            Code_Centre_2014 as id_2014,
            Population_2014 as pop_2014
        FROM [CENTRES_HCP_2014]
    """, conn)
    print(f"   Population 2014: {len(df_pop_2014)} lignes")
    
    # Population 2004
    df_pop_2004 = pd.read_sql("""
        SELECT 
            ID_CENTRE_HCP_2004 as id_2004,
            Population_2004 as pop_2004
        FROM [CENTRES_HCP_2004]
    """, conn)
    print(f"   Population 2004: {len(df_pop_2004)} lignes")
    
    # Population 1994
    df_pop_1994 = pd.read_sql("""
        SELECT 
            ID_CENTRE_HCP_2004 as id_2004,
            Population_1994 as pop_1994
        FROM [CENTRES_HCP_2004]
    """, conn)
    print(f"   Population 1994: {len(df_pop_1994)} lignes")
    
    conn.close()
    
    # 5. Construire le mapping des populations HCP
    print("\n5. Construction du mapping des populations HCP...")
    
    # Dictionnaire pour stocker les populations par ID HCP
    hcp_populations = {}
    
    # Pour chaque ID HCP 2024, trouver les ID correspondants
    for _, row in df_link_2024_2014.iterrows():
        id_2024 = row['id_2024']
        id_2014 = row['id_2014']
        
        # Trouver l'ID 2004 correspondant
        link_2004 = df_link_2014_2004[df_link_2014_2004['id_2014'] == id_2014]
        id_2004 = link_2004['id_2004'].values[0] if len(link_2004) > 0 else None
        
        hcp_populations[id_2024] = {
            'id_2024': id_2024,
            'id_2014': id_2014,
            'id_2004': id_2004
        }
    
    # 6. Ajouter les populations pour chaque ID HCP
    print("\n6. Agrégation des populations par centre opérationnel...")
    
    # Dictionnaire pour stocker les populations agrégées par centre_oper
    aggregated = {}
    
    for _, link in df_link.iterrows():
        id_oper = link['id_oper']
        id_hcp_2024 = link['id_hcp']
        
        if id_oper not in aggregated:
            aggregated[id_oper] = {
                'pop_1994': 0,
                'pop_2004': 0,
                'pop_2014': 0,
                'pop_2024': 0
            }
        
        # Trouver la population 2024
        pop_2024_row = df_pop_2024[df_pop_2024['id_2024'] == id_hcp_2024]
        if len(pop_2024_row) > 0 and pd.notna(pop_2024_row['pop_2024'].values[0]):
            aggregated[id_oper]['pop_2024'] += pop_2024_row['pop_2024'].values[0]
        
        # Trouver l'ID 2014 correspondant
        link_2014 = df_link_2024_2014[df_link_2024_2014['id_2024'] == id_hcp_2024]
        if len(link_2014) > 0:
            id_2014 = link_2014['id_2014'].values[0]
            
            # Population 2014
            pop_2014_row = df_pop_2014[df_pop_2014['id_2014'] == id_2014]
            if len(pop_2014_row) > 0 and pd.notna(pop_2014_row['pop_2014'].values[0]):
                aggregated[id_oper]['pop_2014'] += pop_2014_row['pop_2014'].values[0]
            
            # Trouver l'ID 2004 correspondant
            link_2004 = df_link_2014_2004[df_link_2014_2004['id_2014'] == id_2014]
            if len(link_2004) > 0:
                id_2004 = link_2004['id_2004'].values[0]
                
                # Population 2004
                pop_2004_row = df_pop_2004[df_pop_2004['id_2004'] == id_2004]
                if len(pop_2004_row) > 0 and pd.notna(pop_2004_row['pop_2004'].values[0]):
                    aggregated[id_oper]['pop_2004'] += pop_2004_row['pop_2004'].values[0]
                
                # Population 1994
                pop_1994_row = df_pop_1994[df_pop_1994['id_2004'] == id_2004]
                if len(pop_1994_row) > 0 and pd.notna(pop_1994_row['pop_1994'].values[0]):
                    aggregated[id_oper]['pop_1994'] += pop_1994_row['pop_1994'].values[0]
    
    # 7. Créer le DataFrame final
    print("\n7. Création du fichier de mapping final...")
    
    results = []
    for id_oper, pops in aggregated.items():
        results.append({
            'id_oper': id_oper,
            'pop_1994': int(pops['pop_1994']) if pops['pop_1994'] > 0 else None,
            'pop_2004': int(pops['pop_2004']) if pops['pop_2004'] > 0 else None,
            'pop_2014': int(pops['pop_2014']) if pops['pop_2014'] > 0 else None,
            'pop_2024': int(pops['pop_2024']) if pops['pop_2024'] > 0 else None
        })
    
    df_result = pd.DataFrame(results)
    
    # 8. Sauvegarder
    output_path = 'backend/ml/data/centre_population_mapping_corrected.csv'
    df_result.to_csv(output_path, index=False)
    
    print(f"\n   Fichier sauvegardé: {output_path}")
    print(f"   {len(df_result)} centres traités")
    
    # 9. Afficher un aperçu
    print("\n8. Aperçu des résultats:")
    print(df_result.head(20).to_string())
    
    # 10. Vérifier Tanger
    tanger = df_result[df_result['id_oper'] == 'GA16001']
    if not tanger.empty:
        print("\n   TANGER (GA16001):")
        print(f"      Population 1994: {tanger['pop_1994'].values[0]:,}")
        print(f"      Population 2004: {tanger['pop_2004'].values[0]:,}")
    
    return df_result

if __name__ == "__main__":
    build_correct_mapping()