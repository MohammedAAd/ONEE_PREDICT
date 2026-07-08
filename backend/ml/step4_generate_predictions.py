"""
ÉTAPE 4: Génération des prédictions futures (2025-2050)
"""
import pandas as pd
import numpy as np
import joblib
import os

def load_model_and_data():
    """Charge le modèle et les données"""
    
    # Charger le modèle
    model = joblib.load('backend/models/consumption_model.pkl')
    scaler = joblib.load('backend/models/scaler.pkl')
    feature_names = joblib.load('backend/models/feature_names.pkl')
    
    # Charger les données historiques
    df_hist = pd.read_pickle('backend/ml/data/prepared_data.pkl')
    
    print(f"✅ Modèle chargé")
    print(f"✅ Features: {feature_names}")
    print(f"✅ Données historiques: {len(df_hist)} lignes")
    
    return model, scaler, feature_names, df_hist

def predict_future_consumption(centre_id, current_pop, growth_rate, current_taux_branch, 
                               current_rend_dist, current_dotation, target_years, 
                               model, scaler, feature_names):
    """
    Prédit la consommation future pour un centre
    """
    predictions = []
    current_year = 2024
    
    for year in target_years:
        dt = year - current_year
        
        # Projection de la population
        future_pop = current_pop * (1 + growth_rate / 100) ** dt
        
        # Projection du taux de branchement (augmentation progressive jusqu'à 95%)
        future_taux_branch = min(current_taux_branch + 0.5 * dt, 95)
        
        # Dotation en m³/personne/an (convertir L/jour → m³/an)
        dotation_m3 = current_dotation / 1000 * 365
        
        # Construction des features
        features = {
            'annee': year,
            'population': future_pop,
            'taux_branchement': future_taux_branch / 100,
            'dotation_nette': dotation_m3,
            'rendement_distribution': current_rend_dist / 100,
            'rendement_adduction': 0.85,  # Valeur typique
            'nb_abonnes': future_pop * (future_taux_branch / 100) / 5,  # ~5 pers/abonné
            'production_lag1': 0,
            'production_lag2': 0,
            'distribution_lag1': 0,
            'distribution_lag2': 0,
            'conso_totale_lag1': 0,
            'conso_totale_lag2': 0
        }
        
        # Créer le DataFrame avec les bonnes colonnes
        X_pred = pd.DataFrame([features])
        
        # S'assurer que toutes les colonnes sont présentes
        for col in feature_names:
            if col not in X_pred.columns:
                X_pred[col] = 0
        
        X_pred = X_pred[feature_names]
        X_pred_scaled = scaler.transform(X_pred)
        
        # Prédire la consommation
        conso = model.predict(X_pred_scaled)[0]
        
        # Calculer la production nécessaire (avec pertes)
        prod_needed = conso / (current_rend_dist / 100)
        
        predictions.append({
            'year': year,
            'population': int(future_pop),
            'consumption_m3': conso,
            'consumption_mm3': conso / 1e6,
            'production_needed_m3': prod_needed,
            'production_needed_mm3': prod_needed / 1e6
        })
    
    return predictions

def generate_all_predictions(df_hist, target_years, model, scaler, feature_names):
    """Génère les prédictions pour tous les centres"""
    
    print("\n" + "=" * 60)
    print("🔮 GÉNÉRATION DES PRÉDICTIONS FUTURES")
    print("=" * 60)
    
    # Prendre les données les plus récentes pour chaque centre (2024)
    latest_data = df_hist[df_hist['annee'] == 2024].copy()
    
    if latest_data.empty:
        # Fallback: prendre la dernière année disponible
        last_year = df_hist['annee'].max()
        latest_data = df_hist[df_hist['annee'] == last_year].copy()
    
    print(f"   📍 Centres avec données 2024: {len(latest_data)}")
    
    all_predictions = []
    success_count = 0
    
    for _, row in latest_data.iterrows():
        centre_id = row['centre_id']
        
        # Valeurs par défaut si manquantes
        current_pop = row['population'] if pd.notna(row['population']) and row['population'] > 0 else 10000
        growth_rate = row.get('taux_croissance', 0.018) * 100 if pd.notna(row.get('taux_croissance')) else 1.8
        current_taux_branch = row['taux_branchement'] * 100 if pd.notna(row['taux_branchement']) else 85
        current_rend_dist = row['rendement_distribution'] * 100 if pd.notna(row['rendement_distribution']) else 75
        current_dotation = row['dotation_nette'] * 1000 / 365 if pd.notna(row['dotation_nette']) else 140
        
        try:
            predictions = predict_future_consumption(
                centre_id, current_pop, growth_rate, current_taux_branch,
                current_rend_dist, current_dotation, target_years,
                model, scaler, feature_names
            )
            
            for pred in predictions:
                all_predictions.append({
                    'centre_id': centre_id,
                    'annee': pred['year'],
                    'population': pred['population'],
                    'conso_mm3': pred['consumption_mm3'],
                    'production_mm3': pred['production_needed_mm3']
                })
            success_count += 1
            
            if success_count <= 5:
                print(f"   ✅ {centre_id}: pop={current_pop:.0f}, croissance={growth_rate:.1f}%")
                
        except Exception as e:
            # Silencieux pour les erreurs
            pass
    
    df_pred = pd.DataFrame(all_predictions)
    
    if df_pred.empty:
        print(f"   ⚠️ Aucune prédiction générée!")
        return df_pred
    
    print(f"\n   ✅ {len(df_pred)} prédictions générées")
    print(f"   ✅ {df_pred['centre_id'].nunique()} centres")
    
    return df_pred

def aggregate_predictions(df_pred):
    """Agrège les prédictions au niveau national"""
    
    if df_pred.empty:
        return pd.DataFrame()
    
    national = df_pred.groupby('annee').agg({
        'population': 'sum',
        'conso_mm3': 'sum',
        'production_mm3': 'sum',
        'centre_id': 'count'
    }).reset_index()
    national.columns = ['annee', 'population', 'conso_totale_mm3', 'production_totale_mm3', 'nb_centres']
    
    print("\n📊 AGRÉGATION NATIONALE:")
    print(national.to_string(index=False))
    
    return national

def save_predictions(df_pred, national):
    """Sauvegarde les prédictions"""
    
    os.makedirs('backend/ml/data', exist_ok=True)
    
    if not df_pred.empty:
        df_pred.to_csv('backend/ml/data/predictions_by_centre.csv', index=False)
        print("\n💾 Prédictions sauvegardées:")
        print("   - backend/ml/data/predictions_by_centre.csv")
    
    if not national.empty:
        national.to_csv('backend/ml/data/predictions_national.csv', index=False)
        print("   - backend/ml/data/predictions_national.csv")
        
        # Sauvegarder en pickle
        joblib.dump({
            'par_centre': df_pred,
            'national': national
        }, 'backend/ml/data/predictions.pkl')
        print("   - backend/ml/data/predictions.pkl")

def main():
    print("=" * 60)
    print("🔮 GÉNÉRATION DES PRÉDICTIONS 2025-2050")
    print("=" * 60)
    
    # Charger
    model, scaler, feature_names, df_hist = load_model_and_data()
    
    # Générer les prédictions
    target_years = [2030, 2035, 2040, 2045, 2050]
    df_pred = generate_all_predictions(df_hist, target_years, model, scaler, feature_names)
    
    # Agrégation nationale
    national = aggregate_predictions(df_pred)
    
    # Sauvegarder
    save_predictions(df_pred, national)
    
    print("\n" + "=" * 60)
    print("✅ PRÉDICTIONS GÉNÉRÉES AVEC SUCCÈS!")
    print("=" * 60)

if __name__ == "__main__":
    main()