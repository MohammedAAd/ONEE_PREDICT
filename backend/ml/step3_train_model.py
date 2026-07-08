"""
ÉTAPE 3: Entraînement du modèle de régression linéaire
"""
import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt

# Configuration
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['font.family'] = 'Arial'

def load_data():
    """Charge les données préparées"""
    df = pd.read_pickle('backend/ml/data/prepared_data.pkl')
    print(f"✅ Données chargées: {len(df)} lignes")
    print(f"   Période: {df['annee'].min()} - {df['annee'].max()}")
    print(f"   Centres: {df['centre_id'].nunique()}")
    return df

def prepare_features(df):
    """Prépare les features pour l'entraînement"""
    
    print("\n" + "=" * 60)
    print("🔧 PRÉPARATION DES FEATURES")
    print("=" * 60)
    
    # Features disponibles
    feature_cols = [
        'annee',
        'population',
        'taux_branchement',
        'dotation_nette',
        'rendement_distribution',
        'rendement_adduction',
        'nb_abonnes'
    ]
    
    # Vérifier les colonnes existantes
    existing_features = [f for f in feature_cols if f in df.columns]
    
    # Créer des features de lag (année précédente)
    df = df.sort_values(['centre_id', 'annee'])
    
    for col in ['production', 'distribution', 'conso_totale']:
        if col in df.columns:
            df[f'{col}_lag1'] = df.groupby('centre_id')[col].shift(1)
            df[f'{col}_lag2'] = df.groupby('centre_id')[col].shift(2)
            existing_features.extend([f'{col}_lag1', f'{col}_lag2'])
    
    # Nettoyer les valeurs manquantes
    df_clean = df.dropna(subset=existing_features + ['conso_totale'])
    
    print(f"   Features: {existing_features}")
    print(f"   Lignes après nettoyage: {len(df_clean)}")
    
    X = df_clean[existing_features]
    y = df_clean['conso_totale']  # Target: consommation totale
    
    return X, y, existing_features, df_clean

def train_models(X, y, feature_names):
    """Entraîne plusieurs modèles et compare leurs performances"""
    
    print("\n" + "=" * 60)
    print("🤖 ENTRAÎNEMENT DES MODÈLES")
    print("=" * 60)
    
    # Split train/test (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"   Train: {len(X_train)} lignes")
    print(f"   Test: {len(X_test)} lignes")
    
    # Normalisation
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Modèles à tester
    models = {
        'LinearRegression': LinearRegression(),
        'Ridge': Ridge(alpha=1.0),
        'Lasso': Lasso(alpha=0.001),
        'RandomForest': RandomForestRegressor(n_estimators=100, random_state=42),
        'GradientBoosting': GradientBoostingRegressor(n_estimators=100, random_state=42)
    }
    
    results = {}
    best_model = None
    best_score = -np.inf
    
    for name, model in models.items():
        print(f"\n   🚀 Entraînement de {name}...")
        model.fit(X_train_scaled, y_train)
        
        # Prédictions
        y_pred_train = model.predict(X_train_scaled)
        y_pred_test = model.predict(X_test_scaled)
        
        # Métriques
        r2_train = r2_score(y_train, y_pred_train)
        r2_test = r2_score(y_test, y_pred_test)
        mae = mean_absolute_error(y_test, y_pred_test)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
        
        # MAPE (éviter division par zéro)
        mask = y_test > 0
        mape = np.mean(np.abs((y_test[mask] - y_pred_test[mask]) / y_test[mask])) * 100 if mask.any() else np.inf
        
        results[name] = {
            'r2_train': r2_train,
            'r2_test': r2_test,
            'mae': mae,
            'rmse': rmse,
            'mape': mape,
            'model': model
        }
        
        print(f"      R² train: {r2_train:.4f}")
        print(f"      R² test: {r2_test:.4f}")
        print(f"      MAE: {mae:.2f} m³")
        print(f"      MAPE: {mape:.1f}%")
        
        if r2_test > best_score:
            best_score = r2_test
            best_model = model
            best_name = name
    
    print(f"\n   🏆 Meilleur modèle: {best_name} (R²={best_score:.4f})")
    
    return best_model, scaler, results, feature_names

def plot_results(y_test, y_pred, feature_names, model):
    """Visualise les résultats"""
    
    print("\n" + "=" * 60)
    print("📊 VISUALISATION DES RÉSULTATS")
    print("=" * 60)
    
    os.makedirs('backend/ml/data/plots', exist_ok=True)
    
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    # 1. Prédictions vs Réel
    ax1 = axes[0]
    ax1.scatter(y_test / 1e6, y_pred / 1e6, alpha=0.5, edgecolors='k', linewidth=0.5)
    ax1.plot([y_test.min() / 1e6, y_test.max() / 1e6], 
             [y_test.min() / 1e6, y_test.max() / 1e6], 
             'r--', linewidth=2, label='Prédiction parfaite')
    ax1.set_xlabel('Valeurs Réelles (Mm³)')
    ax1.set_ylabel('Prédictions (Mm³)')
    ax1.set_title('Prédictions vs Valeurs Réelles')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # 2. Résidus
    ax2 = axes[1]
    residuals = y_test - y_pred
    ax2.scatter(y_pred / 1e6, residuals / 1e6, alpha=0.5, edgecolors='k', linewidth=0.5)
    ax2.axhline(y=0, color='r', linestyle='--', linewidth=2)
    ax2.set_xlabel('Prédictions (Mm³)')
    ax2.set_ylabel('Résidus (Mm³)')
    ax2.set_title('Analyse des Résidus')
    ax2.grid(True, alpha=0.3)
    
    # 3. Importance des features (pour RandomForest/GradientBoosting)
    ax3 = axes[2]
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        indices = np.argsort(importances)[-8:]
        ax3.barh(range(len(indices)), importances[indices])
        ax3.set_yticks(range(len(indices)))
        ax3.set_yticklabels([feature_names[i] for i in indices])
        ax3.set_xlabel('Importance')
        ax3.set_title('Top 8 Features importantes')
    else:
        # Pour les modèles linéaires, utiliser les coefficients
        coefs = np.abs(model.coef_)
        indices = np.argsort(coefs)[-8:]
        ax3.barh(range(len(indices)), coefs[indices])
        ax3.set_yticks(range(len(indices)))
        ax3.set_yticklabels([feature_names[i] for i in indices])
        ax3.set_xlabel('|Coefficient|')
        ax3.set_title('Top 8 Features importantes')
    
    ax3.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('backend/ml/data/plots/model_results.png', dpi=150)
    plt.close()
    
    print("   💾 Graphiques sauvegardés: backend/ml/data/plots/model_results.png")

def save_model(model, scaler, feature_names, results):
    """Sauvegarde le modèle et ses métadonnées"""
    
    os.makedirs('backend/models', exist_ok=True)
    
    # Sauvegarder le modèle
    joblib.dump(model, 'backend/models/consumption_model.pkl')
    joblib.dump(scaler, 'backend/models/scaler.pkl')
    joblib.dump(feature_names, 'backend/models/feature_names.pkl')
    
    # Sauvegarder les résultats
    results_df = pd.DataFrame(results).T
    results_df.to_csv('backend/models/model_results.csv')
    
    print("\n💾 Modèles sauvegardés:")
    print("   - backend/models/consumption_model.pkl")
    print("   - backend/models/scaler.pkl")
    print("   - backend/models/feature_names.pkl")
    print("   - backend/models/model_results.csv")

def generate_report(results):
    """Génère un rapport textuel des performances"""
    
    print("\n" + "=" * 60)
    print("📋 RAPPORT DES PERFORMANCES")
    print("=" * 60)
    
    for name, metrics in results.items():
        status = "✅" if metrics['r2_test'] >= 0.85 else "⚠️" if metrics['r2_test'] >= 0.70 else "❌"
        print(f"\n   {status} {name}:")
        print(f"      R² (test): {metrics['r2_test']:.4f}")
        print(f"      MAE: {metrics['mae']:.2f} m³ ({metrics['mae']/1e6:.2f} Mm³)")
        print(f"      MAPE: {metrics['mape']:.1f}%")

def main():
    print("=" * 60)
    print("🤖 ÉTAPE 3: ENTRAÎNEMENT DU MODÈLE")
    print("=" * 60)
    
    # Charger les données
    df = load_data()
    
    # Préparer les features
    X, y, feature_names, df_clean = prepare_features(df)
    
    # Entraîner les modèles
    best_model, scaler, results, feature_names = train_models(X, y, feature_names)
    
    # Prédictions finales sur le test set
    X_test = scaler.transform(X)
    y_pred = best_model.predict(X_test)
    
    # Visualiser
    plot_results(y, y_pred, feature_names, best_model)
    
    # Générer le rapport
    generate_report(results)
    
    # Sauvegarder
    save_model(best_model, scaler, feature_names, results)
    
    print("\n" + "=" * 60)
    print("✅ ENTRAÎNEMENT TERMINÉ!")
    print("=" * 60)

if __name__ == "__main__":
    main()