"""
API ML pour les prédictions des besoins en eau potable
Port: 8001
"""
import pandas as pd
import numpy as np
import joblib
import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn

# ============================================================
# CHARGEMENT DES DONNÉES ET MODÈLES
# ============================================================
print("=" * 60)
print("📦 Chargement des données et modèles ML...")
print("=" * 60)

# Chemin des fichiers
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'ml', 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# Charger les prédictions
predictions_path = os.path.join(DATA_DIR, 'predictions.pkl')
if os.path.exists(predictions_path):
    predictions = joblib.load(predictions_path)
    df_par_centre = predictions['par_centre']
    df_national = predictions['national']
    print(f"✅ Prédictions chargées: {len(df_par_centre)} lignes")
else:
    # Créer des prédictions vides
    df_par_centre = pd.DataFrame()
    df_national = pd.DataFrame()
    print("⚠️ Aucune prédiction trouvée")

# Charger les données préparées
prepared_data_path = os.path.join(DATA_DIR, 'prepared_data.pkl')
if os.path.exists(prepared_data_path):
    df_prepared = pd.read_pickle(prepared_data_path)
    print(f"✅ Données préparées: {len(df_prepared)} lignes")
else:
    df_prepared = pd.DataFrame()
    print("⚠️ Données préparées non trouvées")

# Charger les noms des centres
centres_names_path = os.path.join(DATA_DIR, 'centre_names.csv')
if os.path.exists(centres_names_path):
    df_names = pd.read_csv(centres_names_path)
    print(f"✅ Noms des centres: {len(df_names)} centres")
else:
    # Créer un mapping vide
    df_names = pd.DataFrame(columns=['centre_id', 'centre_name'])

# Charger le mapping des populations
pop_mapping_path = os.path.join(DATA_DIR, 'centre_population_mapping_corrected.csv')
if os.path.exists(pop_mapping_path):
    df_pop_map = pd.read_csv(pop_mapping_path)
    print(f"✅ Mapping populations: {len(df_pop_map)} centres")
else:
    df_pop_map = pd.DataFrame()

print("=" * 60)

# ============================================================
# CRÉATION DE L'APPLICATION FASTAPI
# ============================================================
app = FastAPI(
    title="AEP Predict ML API",
    description="API pour les prédictions des besoins en eau potable",
    version="2.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# MODÈLES PYDANTIC
# ============================================================
class CentrePrediction(BaseModel):
    centre_id: str
    centre_name: str
    annee: int
    population: int
    taux_branchement: float
    pred_conso_totale: float
    pred_besoin_production: float
    taux_accroissement: float = 1.8
    dotation_nette: float = 140.0

class CentreWithName(BaseModel):
    centre_id: str
    centre_name: str

class PredictionRequest(BaseModel):
    centre_id: str
    centre_name: str
    current_population: float
    growth_rate: float
    current_taux_branchement: float
    current_rendement_dist: float
    target_years: List[int] = [2030, 2035, 2040, 2045, 2050]

class PredictionResponse(BaseModel):
    centre_id: str
    centre_name: str
    predictions: List[Dict]

# ============================================================
# ROUTES API
# ============================================================

@app.get("/")
async def root():
    return {
        "message": "AEP Predict ML API",
        "version": "2.0",
        "status": "online",
        "endpoints": [
            "/api/centres-with-names",
            "/api/predictions/centre/{centre_id}",
            "/api/predictions/national",
            "/api/historical/centre/{centre_id}",
            "/api/centre-info/{centre_id}",
            "/api/predict"
        ]
    }

@app.get("/api/centres-with-names", response_model=List[CentreWithName])
async def get_centres_with_names():
    """Retourne la liste des centres avec leurs noms"""
    if not df_names.empty:
        # Joindre avec les données disponibles
        centres = []
        for _, row in df_names.iterrows():
            centre_id = str(row['centre_id']).strip()
            centre_name = row['centre_name']
            # Vérifier si le centre a des données
            has_data = not df_prepared[df_prepared['centre_id'] == centre_id].empty
            if has_data:
                centres.append({"centre_id": centre_id, "centre_name": centre_name})
        
        # Ajouter les centres des prédictions
        if not df_par_centre.empty:
            for centre_id in df_par_centre['centre_id'].unique():
                if centre_id not in [c['centre_id'] for c in centres]:
                    centres.append({"centre_id": centre_id, "centre_name": centre_id})
        
        return centres[:500]  # Limiter à 500 pour performance
    
    # Fallback
    centres = df_prepared['centre_id'].unique() if not df_prepared.empty else []
    return [{"centre_id": c, "centre_name": c} for c in centres[:500]]

@app.get("/api/predictions/centre/{centre_id}", response_model=List[CentrePrediction])
async def get_centre_predictions(centre_id: str):
    """Retourne les prédictions pour un centre spécifique"""
    if df_par_centre.empty:
        raise HTTPException(status_code=404, detail="Aucune prédiction disponible")
    
    centre_data = df_par_centre[df_par_centre['centre_id'] == centre_id]
    if centre_data.empty:
        raise HTTPException(status_code=404, detail=f"Centre {centre_id} non trouvé")
    
    # Obtenir le nom du centre
    centre_name = centre_id
    if not df_names.empty:
        name_row = df_names[df_names['centre_id'].astype(str) == centre_id]
        if not name_row.empty:
            centre_name = name_row.iloc[0]['centre_name']
    
    results = []
    for _, row in centre_data.iterrows():
        results.append(CentrePrediction(
            centre_id=row['centre_id'],
            centre_name=centre_name,
            annee=int(row['annee']),
            population=int(row['population']),
            taux_branchement=85.0,
            pred_conso_totale=row['conso_mm3'] if 'conso_mm3' in row else 0,
            pred_besoin_production=row['production_mm3'] if 'production_mm3' in row else 0,
            taux_accroissement=1.8,
            dotation_nette=140.0
        ))
    
    return results

@app.get("/api/predictions/national")
async def get_national_predictions():
    """Retourne les prédictions nationales"""
    if df_national.empty:
        raise HTTPException(status_code=404, detail="Aucune prédiction nationale disponible")
    return df_national.to_dict(orient='records')

@app.get("/api/historical/centre/{centre_id}")
async def get_historical_centre(centre_id: str):
    """Retourne les données historiques pour un centre (uniquement les années avec données réelles)"""
    if df_prepared.empty:
        raise HTTPException(status_code=404, detail="Aucune donnée historique disponible")
    
    centre_hist = df_prepared[df_prepared['centre_id'].astype(str) == centre_id].sort_values('annee')
    
    if centre_hist.empty:
        raise HTTPException(status_code=404, detail=f"Centre {centre_id} non trouvé")
    
    results = []
    for _, row in centre_hist.iterrows():
        annee = int(row['annee'])
        
        # Ne garder que les années avec des données de production réelles (> 0)
        # ou les années de recensement pour la population
        production = float(row['production']) / 1e6 if pd.notna(row['production']) and row['production'] > 0 else None
        distribution = float(row['distribution']) / 1e6 if pd.notna(row['distribution']) and row['distribution'] > 0 else None
        conso = float(row['conso_totale']) / 1e6 if pd.notna(row['conso_totale']) and row['conso_totale'] > 0 else None
        # Population: uniquement les années de recensement (1994, 2004, 2014, 2024)
        population = int(row['population']) if pd.notna(row['population']) and row['population'] > 0 and annee in [1994, 2004, 2014, 2024] else None
        
        results.append({
            "annee": annee,
            "production": round(production, 2) if production else None,
            "distribution": round(distribution, 2) if distribution else None,
            "conso_totale": round(conso, 2) if conso else None,
            "population": population
        })
    
    # Filtrer pour n'afficher que les années avec au moins une donnée
    results = [r for r in results if r['production'] is not None or r['population'] is not None]
    
    return results

@app.get("/api/centre-info/{centre_id}")
async def get_centre_info(centre_id: str):
    """Retourne les informations d'un centre"""
    if df_prepared.empty:
        return {"centre_id": centre_id, "has_data": False}
    
    centre_data = df_prepared[df_prepared['centre_id'].astype(str) == centre_id]
    if centre_data.empty:
        return {"centre_id": centre_id, "has_data": False}
    
    last_data = centre_data.sort_values('annee').iloc[-1]
    
    return {
        "centre_id": centre_id,
        "has_data": True,
        "last_year": int(last_data['annee']),
        "last_population": int(last_data['population']) if pd.notna(last_data['population']) else 0,
        "last_consumption": float(last_data['conso_totale']) / 1e6 if pd.notna(last_data['conso_totale']) else 0,
        "last_production": float(last_data['production']) / 1e6 if pd.notna(last_data['production']) else 0
    }

@app.post("/api/predict", response_model=PredictionResponse)
async def predict_future(request: PredictionRequest):
    """Prédit la consommation, distribution et production futures pour toutes les années"""
    
    predictions = []
    current_year = 2024
    
    # Générer toutes les années de 2025 à 2050
    all_years = list(range(2025, 2051))  # 2025, 2026, ..., 2050
    
    for year in all_years:
        dt = year - current_year
        
        # Projection population avec taux de croissance
        future_pop = request.current_population * (1 + request.growth_rate / 100) ** dt
        
        # Taux de branchement (augmentation progressive jusqu'à 98%)
        future_taux_branch = min(request.current_taux_branchement + 0.3 * dt, 98)
        
        # Dotation (L/personne/jour)
        dotation_m3 = 51.1  # 140 L/j * 365 / 1000
        
        # 1. CONSOMMATION estimée
        conso_m3 = future_pop * dotation_m3
        conso_mm3 = conso_m3 / 1e6
        
        # 2. DISTRIBUTION nécessaire
        rend_dist = request.current_rendement_dist / 100
        distribution_m3 = conso_m3 / rend_dist
        distribution_mm3 = distribution_m3 / 1e6
        
        # 3. PRODUCTION nécessaire
        rend_adduct = 0.85
        production_m3 = distribution_m3 / rend_adduct
        production_mm3 = production_m3 / 1e6
        
        predictions.append({
            "year": year,
            "population": int(future_pop),
            "taux_branchement": round(future_taux_branch, 1),
            "consumption_m3": conso_m3,
            "consumption_mm3": round(conso_mm3, 2),
            "distribution_mm3": round(distribution_mm3, 2),
            "production_mm3": round(production_mm3, 2)
        })
    
    return PredictionResponse(
        centre_id=request.centre_id,
        centre_name=request.centre_name,
        predictions=predictions
    )
@app.get("/api/prediction_re/{centre_id}")
async def get_prediction_re_fallback(centre_id: str):
    """Fallback pour l'ancien endpoint"""
    return await get_centre_predictions(centre_id)

@app.get("/api/dashboard/summary")
async def get_dashboard_summary():
    """Résumé pour le dashboard"""
    if df_prepared.empty:
        return {
            "annee_courante": 2024,
            "annee_prevision": 2050,
            "population_actuelle": 0,
            "population_prevue": 0,
            "croissance_population": 0,
            "production_actuelle": 0,
            "production_prevue": 0,
            "croissance_production": 0,
            "nb_centres": 0,
            "centres_deficit": 0,
            "centres_tension": 0,
            "centres_ok": 0
        }
    
    last_year_data = df_prepared[df_prepared['annee'] == 2024]
    nb_centres = df_prepared['centre_id'].nunique()
    
    return {
        "annee_courante": 2024,
        "annee_prevision": 2050,
        "population_actuelle": int(last_year_data['population'].sum() / 1e6) if not last_year_data.empty else 0,
        "population_prevue": 0,
        "croissance_population": 1.8,
        "production_actuelle": float(last_year_data['production'].sum() / 1e6) if not last_year_data.empty else 0,
        "production_prevue": 0,
        "croissance_production": 2.5,
        "nb_centres": nb_centres,
        "centres_deficit": 0,
        "centres_tension": 0,
        "centres_ok": nb_centres
    }
def interpolate_population(centre_id, df_prepared):
    """Interpole la population entre les années de recensement"""
    # Récupérer les années de recensement avec population
    census_years = [1994, 2004, 2014, 2024]
    census_data = {}
    
    for year in census_years:
        pop = df_prepared[(df_prepared['centre_id'].astype(str) == centre_id) & (df_prepared['annee'] == year)]['population'].values
        if len(pop) > 0 and not np.isnan(pop[0]) and pop[0] > 0:
            census_data[year] = pop[0]
    
    if len(census_data) < 2:
        return {}
    
    # Interpolation linéaire
    interpolated = {}
    years_sorted = sorted(census_data.keys())
    
    for i in range(len(years_sorted) - 1):
        year_start = years_sorted[i]
        year_end = years_sorted[i + 1]
        pop_start = census_data[year_start]
        pop_end = census_data[year_end]
        
        for year in range(year_start, year_end + 1):
            if year not in census_data:
                t = (year - year_start) / (year_end - year_start)
                interpolated[year] = pop_start + t * (pop_end - pop_start)
            else:
                interpolated[year] = census_data[year]
    
    return interpolated

# ============================================================
# LANCEMENT
# ============================================================
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🚀 Lancement de l'API ML AEP Predict")
    print("=" * 60)
    print("\n📌 Endpoints disponibles:")
    print("   - http://localhost:8001/api/centres-with-names")
    print("   - http://localhost:8001/api/predictions/centre/{centre_id}")
    print("   - http://localhost:8001/api/predictions/national")
    print("   - http://localhost:8001/api/historical/centre/{centre_id}")
    print("   - http://localhost:8001/api/centre-info/{centre_id}")
    print("   - http://localhost:8001/api/predict")
    print("   - http://localhost:8001/api/dashboard/summary")
    print("\n📚 Documentation: http://localhost:8001/docs")
    print("=" * 60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)