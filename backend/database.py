import pyodbc
import pandas as pd
from typing import List, Dict, Any
import os
from pathlib import Path
from dotenv import load_dotenv

# 🎯 Charger .env depuis plusieurs emplacements possibles
def load_env_smart():
    candidates = [
        Path(__file__).parent.parent / ".env",  # racine projet
        Path(__file__).parent / ".env",          # backend/
        Path.cwd() / ".env",                     # cwd
    ]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(dotenv_path=env_path)
            print(f"✅ .env chargé depuis : {env_path}")
            return
    print("⚠️ Aucun .env trouvé, utilisation des variables système")

load_env_smart()

# 🎯 Résolution ROBUSTE du chemin
def get_db_path():
    # 1. Variable d'environnement
    db_path = os.getenv("ACCESS_DB_PATH")
    
    if db_path:
        p = Path(db_path).expanduser().resolve()
        if p.exists():
            print(f"✅ ACCESS_DB_PATH valide : {p}")
            return str(p)
        else:
            print(f"❌ ACCESS_DB_PATH défini mais fichier introuvable : {db_path}")
            print(f"   Chemin résolu : {p}")
            print(f"   Existe ? {p.exists()}")
    
    # 2. Fallback : chemin par défaut absolu
    fallback = Path(r"C:\Users\Louis\onee\onee\onee\2_Dataset1.accdb").resolve()
    if fallback.exists():
        print(f"✅ Fallback utilisé : {fallback}")
        return str(fallback)
    
    # 3. Dernier fallback : chercher dans le dossier parent
    alt_fallback = Path(__file__).resolve().parent.parent / "2_Dataset1.accdb"
    if alt_fallback.exists():
        print(f"✅ Alt fallback utilisé : {alt_fallback}")
        return str(alt_fallback)
    
    raise FileNotFoundError(
        "❌ Fichier Access introuvable.\n"
        f"   ACCESS_DB_PATH={os.getenv('ACCESS_DB_PATH')}\n"
        f"   CWD={Path.cwd()}\n"
        "Solutions :\n"
        "1. Créer .env à la racine avec : ACCESS_DB_PATH=C:\\chemin\\vers\\2_Dataset1.accdb\n"
        "2. Ou placer le fichier .accdb à la racine du projet"
    )

# ✅ Initialisation avec validation immédiate
DB_PATH = get_db_path()

# Chaîne de connexion (échappement correct)
CONNECTION_STRING = f"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={DB_PATH};"

print(f"🔗 CONNECTION_STRING (masqué) : {CONNECTION_STRING[:60]}...")

def test_connection():
    """Teste la connexion à la base"""
    try:
        conn = pyodbc.connect(CONNECTION_STRING)
        print("✅ Connexion réussie à la base Access!")
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return False

def get_connection():
    """Établit la connexion à la base Access"""
    try:
        return pyodbc.connect(CONNECTION_STRING)
    except Exception as e:
        print(f"❌ get_connection échoué: {e}")
        return None


def get_table_names() -> List[str]:
    """Récupère la liste de toutes les tables"""
    conn = get_connection()
    if not conn:
        return []
    
    cursor = conn.cursor()
    cursor.tables(tableType='TABLE')
    tables = [row.table_name for row in cursor.fetchall()]
    conn.close()
    return tables

def get_table_data(table_name: str, limit: int = None) -> Dict[str, Any]:
    """Récupère les données d'une table"""
    conn = get_connection()
    if not conn:
        return {"error": "Impossible de se connecter à la base"}
    
    try:
        query = f"SELECT * FROM [{table_name}]"
        if limit:
            query = f"SELECT TOP {limit} * FROM [{table_name}]"
        
        df = pd.read_sql(query, conn)
        conn.close()
        
        return {
            "table_name": table_name,
            "columns": df.columns.tolist(),
            "data": df.fillna("").to_dict(orient='records'),
            "row_count": len(df),
            "column_count": len(df.columns)
        }
    except Exception as e:
        conn.close()
        return {"error": str(e)}

def get_table_summary(table_name: str) -> Dict[str, Any]:
    """Récupère un résumé statistique d'une table"""
    conn = get_connection()
    if not conn:
        return {"error": "Impossible de se connecter à la base"}
    
    try:
        df = pd.read_sql(f"SELECT * FROM [{table_name}]", conn)
        conn.close()
        
        summary = {
            "table_name": table_name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": []
        }
        
        for col in df.columns:
            col_info = {
                "name": col,
                "type": str(df[col].dtype),
                "null_count": int(df[col].isna().sum()),
                "unique_count": int(df[col].nunique())
            }
            
            # Ajouter des stats pour les colonnes numériques
            if pd.api.types.is_numeric_dtype(df[col]):
                col_info["min"] = float(df[col].min()) if not pd.isna(df[col].min()) else None
                col_info["max"] = float(df[col].max()) if not pd.isna(df[col].max()) else None
                col_info["mean"] = float(df[col].mean()) if not pd.isna(df[col].mean()) else None
            
            summary["columns"].append(col_info)
        
        return summary
    except Exception as e:
        conn.close()
        return {"error": str(e)}

def execute_custom_query(query: str) -> Dict[str, Any]:
    """Exécute une requête SQL personnalisée"""
    conn = get_connection()
    if not conn:
        return {"error": "Impossible de se connecter à la base"}
    
    try:
        df = pd.read_sql(query, conn)
        conn.close()
        
        return {
            "query": query,
            "columns": df.columns.tolist(),
            "data": df.fillna("").to_dict(orient='records'),
            "row_count": len(df)
        }
    except Exception as e:
        conn.close()
        return {"error": str(e)}

if __name__ == "__main__":
    # Test de connexion
    print("🔍 Test de connexion à la base Access...")
    if test_connection():
        tables = get_table_names()
        print(f"\n📊 Tables trouvées ({len(tables)}):")
        for table in tables[:10]:  # Affiche les 10 premières tables
            print(f"   - {table}")