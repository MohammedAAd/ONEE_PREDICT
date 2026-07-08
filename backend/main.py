from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
from sqlalchemy import text
import pandas as pd

# Imports cohérents - adaptez selon VOTRE structure réelle
from backend.app.config import settings
from backend.app.database import engine, Base

# Imports modules Access
from backend.database import (
    get_table_names, 
    get_table_data, 
    get_table_summary,
    execute_custom_query,
    test_connection,
    get_connection  # ← AJOUTER
)

# Import auth - vérifier le chemin exact
from backend.auth import auth_router

# ============================================================
# MODÈLES PYDANTIC (définis UNE seule fois)
# ============================================================
class QueryRequest(BaseModel):
    query: str

# ============================================================
# LIFESPAN
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Démarrage de l'API ONEE...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Tables PostgreSQL vérifiées/créées")
    
    try:
        access_ok = test_connection()
        print("✅ Connexion Access établie" if access_ok else "⚠️ Connexion Access non disponible")
    except Exception as e:
        print(f"⚠️ Erreur connexion Access: {e}")
    
    yield
    
    print("🛑 Arrêt de l'API ONEE...")
    await engine.dispose()
    print("✅ Ressources libérées")

# ============================================================
# APP FASTAPI
# ============================================================
app = FastAPI(
    title="ONEE API - Gestion de l'Eau au Maroc",
    description="API complète pour la gestion des données hydriques...",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)

@app.get("/")
async def root():
    return {"message": "ONEE API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health_check():
    postgresql_status = "ok"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        postgresql_status = f"error: {str(e)}"
    
    access_status = "ok" if test_connection() else "error"
    
    return {
        "status": "healthy" if postgresql_status == "ok" and access_status == "ok" else "degraded",
        "postgresql": postgresql_status,
        "access": access_status
    }

# Routes v1
api_prefix = "/api/v1"
from backend.api.v1 import (
    centres, aep, dashboard, dashboard_new, 
    consommation, production, dashboard_analytics, 
    prediction, scenario
)

for router in [centres, aep, dashboard, dashboard_new, consommation, 
               production, dashboard_analytics, prediction, scenario]:
    app.include_router(router.router, prefix=api_prefix)

# ============================================================
# ROUTES ACCESS (CORRIGÉ - DÉCOMMENTÉ ET COMPLÉTÉ)
# ============================================================
access_prefix = "/api/access"

@app.get(f"{access_prefix}/test")
async def test_access_connection():
    return {"connected": test_connection(), "message": "OK" if test_connection() else "Échec"}

@app.get(f"{access_prefix}/tables")
async def get_tables():
    """Liste toutes les tables Access"""
    tables = get_table_names()
    return {"tables": tables, "count": len(tables)}

@app.get(f"{access_prefix}/tables/{{table_name}}")
async def get_table_data_route(
    table_name: str,
    limit: Optional[int] = Query(500, description="Nombre maximum d'enregistrements", ge=1, le=10000),
    offset: Optional[int] = Query(0, description="Offset pour la pagination", ge=0)
):
    """
    Récupère les données d'une table spécifique
    
    Args:
        table_name: Nom de la table (ex: CENTRES_DESSERVIS, PRODUCTION, etc.)
        limit: Nombre maximum d'enregistrements
        offset: Décalage pour la pagination
    
    Returns:
        Dictionnaire contenant les données de la table, les colonnes et les métadonnées
    """
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Impossible de se connecter à la base de données")
    
    try:
        # Liste blanche de tables autorisées (sécurité)
        allowed_tables = get_table_names()
        
        if table_name not in allowed_tables:
            conn.close()
            raise HTTPException(status_code=403, detail=f"Table non autorisée: {table_name}")
        
        # Construction de la requête avec TOP pour Access
        if limit:
            query = f"SELECT TOP {limit} * FROM [{table_name}]"
        else:
            query = f"SELECT * FROM [{table_name}]"
        
        df = pd.read_sql(query, conn)
        conn.close()
        
        # Gérer les NaN pour la sérialisation JSON
        df_clean = df.fillna("")
        
        return {
            "table_name": table_name,
            "columns": df_clean.columns.tolist(),
            "data": df_clean.to_dict(orient='records'),
            "row_count": len(df_clean),
            "column_count": len(df_clean.columns),
            "limit": limit,
            "offset": offset,
            "status": "success"
        }
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la lecture de la table: {str(e)}")

@app.get(f"{access_prefix}/tables/{{table_name}}/summary")
async def get_table_summary_route(table_name: str):
    """Retourne un résumé d'une table (nombre de lignes, colonnes)"""
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Impossible de se connecter à la base de données")
    
    try:
        allowed_tables = get_table_names()
        
        if table_name not in allowed_tables:
            conn.close()
            raise HTTPException(status_code=403, detail=f"Table non autorisée: {table_name}")
        
        # Compter les lignes
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM [{table_name}]")
        row_count = cursor.fetchone()[0]
        
        # Récupérer les colonnes
        cursor.execute(f"SELECT * FROM [{table_name}] WHERE 1=0")
        columns = [desc[0] for desc in cursor.description]
        
        conn.close()
        
        return {
            "table_name": table_name,
            "row_count": row_count,
            "columns": columns,
            "column_count": len(columns)
        }
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Erreur résumé table: {str(e)}")

@app.get(f"{access_prefix}/schemas")
async def get_schemas():
    """Retourne les schémas de toutes les tables"""
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Impossible de se connecter à la base de données")
    
    try:
        tables = get_table_names()
        schemas = {}
        
        for table_name in tables:
            try:
                cursor = conn.cursor()
                cursor.execute(f"SELECT COUNT(*) FROM [{table_name}]")
                row_count = cursor.fetchone()[0]
                
                cursor.execute(f"SELECT * FROM [{table_name}] WHERE 1=0")
                columns = [desc[0] for desc in cursor.description]
                
                schemas[table_name] = {
                    "row_count": row_count,
                    "columns": columns
                }
            except:
                schemas[table_name] = {"row_count": 0, "columns": []}
        
        conn.close()
        return schemas
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Erreur schémas: {str(e)}")

@app.post(f"{access_prefix}/query")
async def execute_query(request: QueryRequest):
    """Exécute une requête SQL personnalisée (SELECT uniquement)"""
    dangerous = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE"]
    if any(kw in request.query.upper() for kw in dangerous):
        raise HTTPException(status_code=400, detail="Commande non autorisée - SELECT uniquement")
    
    result = execute_custom_query(request.query)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )