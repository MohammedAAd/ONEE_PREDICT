"""
ÉTAPE 2: Préparation des données avec les populations réelles
"""
import pandas as pd
import numpy as np
import os

def load_all_data():
    """Charge toutes les données"""
    print("=" * 60)
    print("📊 CHARGEMENT DES DONNÉES")
    print("=" * 60)
    
    # Fact_Activite_AEP
    df_fact = pd.read_csv('backend/ml/data/fact_activite.csv')
    print(f"   ✓ Fact_Activite_AEP: {len(df_fact)} lignes")
    
    # Mapping des populations
    df_pop_map = pd.read_csv('backend/ml/data/centre_population_mapping.csv')
    print(f"   ✓ Mapping populations: {len(df_pop_map)} centres")
    
    # Noms des centres
    df_names = pd.read_csv('backend/ml/data/centre_names.csv')
    print(f"   ✓ Noms des centres: {len(df_names)} centres")
    
    return df_fact, df_pop_map, df_names

def add_population_to_fact(df_fact, df_pop_map):
    """Ajoute la population à chaque ligne de Fact_Activite_AEP"""
    
    print("\n" + "=" * 60)
    print("👥 AJOUT DE LA POPULATION")
    print("=" * 60)
    
    # Créer un dictionnaire des populations par année
    pop_dict = {}
    for _, row in df_pop_map.iterrows():
        centre_id = str(row['id_oper']).strip()
        pop_2024 = row['pop_2024']
        pop_2014 = row['pop_2014']
        pop_2004 = row['pop_2004']
        
        if pd.notna(pop_2024) and pop_2024 > 0:
            pop_dict[(centre_id, 2024)] = pop_2024
        if pd.notna(pop_2014) and pop_2014 > 0:
            pop_dict[(centre_id, 2014)] = pop_2014
        if pd.notna(pop_2004) and pop_2004 > 0:
            pop_dict[(centre_id, 2004)] = pop_2004
    
    print(f"   ✓ {len(pop_dict)} entrées de population disponibles")
    
    # Calculer les taux de croissance par centre
    growth_rates = {}
    for centre_id in df_fact['centre_id'].unique():
        centre_id_str = str(centre_id).strip()
        
        # Récupérer les populations connues
        pop_2004 = pop_dict.get((centre_id_str, 2004))
        pop_2014 = pop_dict.get((centre_id_str, 2014))
        pop_2024 = pop_dict.get((centre_id_str, 2024))
        
        # Calculer le taux 2004-2014
        if pop_2004 and pop_2014 and pop_2004 > 0:
            growth_2004_2014 = (pop_2014 / pop_2004) ** (1/10) - 1
            growth_rates[centre_id_str] = growth_2004_2014
        # Sinon taux 2014-2024
        elif pop_2014 and pop_2024 and pop_2014 > 0:
            growth_2014_2024 = (pop_2024 / pop_2014) ** (1/10) - 1
            growth_rates[centre_id_str] = growth_2014_2024
        else:
            growth_rates[centre_id_str] = 0.018  # Taux par défaut 1.8%
    
    print(f"   ✓ Taux calculés pour {len(growth_rates)} centres")
    
    # Interpoler la population pour chaque année
    def get_population(centre_id, annee):
        centre_id_str = str(centre_id).strip()
        
        # Si la population est directement disponible
        if (centre_id_str, annee) in pop_dict:
            return pop_dict[(centre_id_str, annee)]
        
        # Trouver l'année de référence la plus proche
        growth_rate = growth_rates.get(centre_id_str, 0.018)
        
        # Utiliser 2014 comme référence par défaut
        ref_pop = pop_dict.get((centre_id_str, 2014))
        ref_year = 2014
        
        if ref_pop is None:
            ref_pop = pop_dict.get((centre_id_str, 2024))
            ref_year = 2024
        
        if ref_pop is None or ref_pop <= 0:
            return np.nan
        
        # Projection exponentielle
        dt = annee - ref_year
        return ref_pop * (1 + growth_rate) ** dt
    
    df_fact['population'] = df_fact.apply(
        lambda row: get_population(row['centre_id'], row['annee']),
        axis=1
    )
    
    # Ajouter le taux de croissance au dataframe
    df_fact['taux_croissance'] = df_fact['centre_id'].astype(str).map(growth_rates).fillna(0.018)
    
    # Statistiques
    centres_avec_pop = df_fact[df_fact['population'].notna()]['centre_id'].nunique()
    print(f"   ✓ Centres avec population: {centres_avec_pop}")
    print(f"   ✓ Lignes avec population: {df_fact['population'].notna().sum()} / {len(df_fact)}")
    
    return df_fact

def calculate_indicators(df):
    """Calcule tous les indicateurs"""
    print("\n" + "=" * 60)
    print("📐 CALCUL DES INDICATEURS")
    print("=" * 60)
    
    # Nettoyer les colonnes numériques
    numeric_cols = ['production', 'distribution', 'conso_pop_branchee', 'conso_bf', 
                    'conso_admin', 'conso_industrielle', 'conso_autres', 'nb_abonnes',
                    'taux_branchement', 'rendement_distribution', 'rendement_adduction']
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # Consommation totale
    df['conso_totale'] = (
        df['conso_pop_branchee'] + 
        df['conso_bf'] + 
        df['conso_admin'] + 
        df['conso_industrielle'] + 
        df['conso_autres']
    )
    
    # Taux de branchement (normalisé entre 0 et 1)
    df['taux_branchement'] = df['taux_branchement'].clip(0, 100) / 100
    
    # Dotation nette (m³/personne/an)
    df['dotation_nette'] = df['conso_totale'] / df['population'].replace(0, np.nan)
    
    # Dotation brute
    df['dotation_brute'] = df['production'] / df['population'].replace(0, np.nan)
    
    # Rendements calculés
    df['rend_dist_calc'] = df['conso_totale'] / df['distribution'].replace(0, np.nan)
    df['rend_duct_calc'] = df['distribution'] / df['production'].replace(0, np.nan)
    
    # Pertes
    df['pertes_distribution'] = df['distribution'] - df['conso_totale']
    df['pertes_adduction'] = df['production'] - df['distribution']
    df['pertes_totales'] = df['production'] - df['conso_totale']
    df['taux_pertes'] = df['pertes_totales'] / df['production'].replace(0, np.nan)
    
    # Limiter les valeurs aberrantes
    for col in ['dotation_nette', 'dotation_brute', 'rend_dist_calc', 'rend_duct_calc', 'taux_pertes']:
        if col in df.columns:
            q99 = df[col].quantile(0.99)
            df[col] = df[col].clip(lower=0, upper=q99)
    
    print(f"   ✓ Consommation totale: {df['conso_totale'].sum()/1e6:.2f} Mm³")
    print(f"   ✓ Population totale (2024): {df[df['annee']==2024]['population'].sum()/1e6:.2f} M habitants")
    print(f"   ✓ Dotation moyenne: {df['dotation_nette'].mean()*1000/365:.0f} L/jour/personne")
    
    return df

def add_centre_names(df, df_names):
    """Ajoute les noms des centres"""
    name_dict = dict(zip(df_names['centre_id'].astype(str), df_names['centre_name']))
    df['centre_name'] = df['centre_id'].astype(str).map(name_dict)
    df['centre_name'] = df['centre_name'].fillna(df['centre_id'])
    return df

def generate_report(df):
    """Génère un rapport final"""
    print("\n" + "=" * 60)
    print("📋 RAPPORT FINAL")
    print("=" * 60)
    
    print(f"\n📊 Statistiques générales:")
    print(f"   Période: {df['annee'].min()} - {df['annee'].max()}")
    print(f"   Centres: {df['centre_id'].nunique()}")
    print(f"   Lignes: {len(df)}")
    
    print(f"\n💧 Consommation:")
    print(f"   Totale historique: {df['conso_totale'].sum()/1e6:.2f} Mm³")
    print(f"   Moyenne annuelle: {df.groupby('annee')['conso_totale'].sum().mean()/1e6:.2f} Mm³")
    
    print(f"\n👥 Population:")
    pop_2024 = df[df['annee'] == 2024]['population'].sum()
    print(f"   Totale (2024): {pop_2024/1e6:.2f} M habitants")
    print(f"   Moyenne par centre: {df.groupby('centre_id')['population'].mean().mean():.0f}")
    
    # Taux de croissance moyen (ignorer les NaN)
    if 'taux_croissance' in df.columns:
        avg_growth = df['taux_croissance'].mean() * 100
        print(f"\n📈 Taux de croissance moyen: {avg_growth:.2f}%/an")
    
    # Vérification des données manquantes
    print(f"\n🔍 Complétude des données (%):")
    for col in ['production', 'distribution', 'conso_totale', 'population']:
        if col in df.columns:
            pct = (1 - df[col].isna().mean()) * 100
            status = "✅" if pct > 95 else "⚠️" if pct > 80 else "❌"
            print(f"   {status} {col}: {pct:.1f}%")
    
    return df

def main():
    print("=" * 60)
    print("📊 PRÉPARATION FINALE DES DONNÉES")
    print("=" * 60)
    
    # Charger
    df_fact, df_pop_map, df_names = load_all_data()
    
    # Ajouter population
    df = add_population_to_fact(df_fact, df_pop_map)
    
    # Calculer indicateurs
    df = calculate_indicators(df)
    
    # Ajouter noms
    df = add_centre_names(df, df_names)
    
    # Rapport
    df = generate_report(df)
    
    # Sauvegarder
    os.makedirs('backend/ml/data', exist_ok=True)
    df.to_csv('backend/ml/data/prepared_data.csv', index=False)
    df.to_pickle('backend/ml/data/prepared_data.pkl')
    
    print("\n" + "=" * 60)
    print("✅ PRÉPARATION TERMINÉE!")
    print("   📁 prepared_data.csv")
    print("   📁 prepared_data.pkl")
    print("=" * 60)

if __name__ == "__main__":
    main()