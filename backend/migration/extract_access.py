"""Extraction robuste depuis Access"""
import pyodbc
import pandas as pd
from typing import Optional

def extract_table(
    access_file: str, 
    table_name: str, 
    chunk_size: Optional[int] = None
) -> pd.DataFrame:
    """
    Extrait une table Access avec gestion d'erreurs
    
    Args:
        access_file: Chemin du fichier .accdb
        table_name: Nom de la table
        chunk_size: Si spécifié, lit par morceaux (pour grandes tables)
    
    Returns:
        DataFrame pandas
    """
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"DBQ={access_file};"
    )
    
    try:
        print(f"🔌 Connexion à Access: {access_file}")
        conn = pyodbc.connect(conn_str, timeout=30)
        
        # Compter les lignes
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM [{table_name}]")
        row_count = cursor.fetchone()[0]
        print(f"📊 Table '{table_name}' a {row_count:,} lignes")
        
        # Extraction optimisée
        if chunk_size and row_count > chunk_size:
            # Lecture par morceaux pour les grandes tables
            chunks = []
            offset = 0
            while offset < row_count:
                query = f"SELECT * FROM [{table_name}] LIMIT {chunk_size} OFFSET {offset}"
                chunk = pd.read_sql(query, conn)
                chunks.append(chunk)
                offset += chunk_size
                print(f"   ↳ Lu {len(chunk):,} lignes...")
            df = pd.concat(chunks, ignore_index=True)
        else:
            # Lecture complète
            df = pd.read_sql(f"SELECT * FROM [{table_name}]", conn)
        
        conn.close()
        print(f"✅ Extraction réussie: {len(df):,} lignes, {len(df.columns)} colonnes")
        
        return df
    
    except pyodbc.Error as e:
        print(f"❌ Erreur ODBC: {e}")
        raise
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")
        raise

def get_table_list(access_file: str) -> list:
    """Liste les tables Access"""

    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"DBQ={access_file};"
    )

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        tables = []

        for row in cursor.tables(tableType='TABLE'):

            table_name = row.table_name

            # Ignorer tables système
            if not table_name.startswith("MSys"):
                tables.append(table_name)

        conn.close()

        return tables

    except Exception as e:
        print(f"❌ Erreur lecture tables: {e}")
        return []