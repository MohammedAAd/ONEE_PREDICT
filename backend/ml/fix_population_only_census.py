# backend/ml/fix_population_only_census.py
import pandas as pd
import numpy as np
import joblib

# Charger les données
df = pd.read_pickle('backend/ml/data/prepared_data.pkl')

# Ne garder la population que pour les années de recensement
census_years = [1994, 2004, 2014, 2024]

def clean_population(row):
    annee = row['annee']
    pop = row['population']
    if annee in census_years and pd.notna(pop) and pop > 0:
        return pop
    return np.nan

df['population'] = df.apply(clean_population, axis=1)

# Sauvegarder
df.to_pickle('backend/ml/data/prepared_data.pkl')
df.to_csv('backend/ml/data/prepared_data.csv', index=False)

print("✅ Population nettoyée : uniquement les années de recensement")
print(f"   Années conservées: {census_years}")