"""Chargement robuste vers PostgreSQL - VERSION CORRIGÉE"""
from sqlalchemy import create_engine, text
import pandas as pd
from typing import Optional

def create_postgres_engine(config: dict):
    """Crée l'engine SQLAlchemy"""
    url = (
        f"postgresql+psycopg2://{config['user']}:{config['password']}"
        f"@{config['host']}:{config['port']}/{config['database']}"
    )
    return create_engine(url, echo=False)

def test_postgres_connection(config: dict) -> bool:
    """Test la connexion PostgreSQL"""
    try:
        engine = create_postgres_engine(config)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 as test"))
            print(f"✅ PostgreSQL connecté: {result.fetchone().test}")
        return True
    except Exception as e:
        print(f"❌ Erreur PostgreSQL: {e}")
        return False

def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Nettoie les noms de colonnes pour PostgreSQL"""
    original_cols = df.columns.tolist()
    df.columns = [
        col.strip()
           .replace(" ", "_")
           .replace("-", "_")
           .replace("/", "_")
           .lower()
        for col in df.columns
    ]
    print(f"   🧹 Colonnes nettoyées: {original_cols[:3]} → {df.columns[:3]}")
    return df

def load_to_postgres(
    df: pd.DataFrame,
    table_name: str,
    config: dict,
    if_exists: str = 'append',
    schema: Optional[str] = 'public'
) -> int:
    """
    Charge un DataFrame vers PostgreSQL
    """
    engine = create_postgres_engine(config)
    
    try:
        print(f"📤 Chargement vers PostgreSQL.{schema}.{table_name}...")
        
        # 🔧 CORRECTION 1: Nettoyer les noms de colonnes
        df = clean_column_names(df)
        
        # 🔧 CORRECTION 2: Convertir explicitement les types pour éviter StringDtype
        for col in df.columns:
            if df[col].dtype.name == 'string':
                df[col] = df[col].astype(object)
        
        # Remplacer NaN par None pour PostgreSQL
        df = df.where(pd.notnull(df), None)
        
        print(f"   📋 Colonnes finales: {list(df.columns)}")
        print(f"   📊 {len(df)} lignes à charger")
        
        # Chargement
        rows_affected = df.to_sql(
            table_name,
            engine,
            schema=schema,
            if_exists=if_exists,
            index=False,
            method='multi',  # Insertion par lots
            chunksize=1000   # 1000 lignes par lot
        )
        
        print(f"✅ Chargé {rows_affected:,} lignes dans {table_name}")
        engine.dispose()
        return rows_affected
    
    except Exception as e:
        import traceback
        print(f"❌ Erreur détaillée:")
        traceback.print_exc()
        engine.dispose()
        raise