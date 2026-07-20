from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from sqlalchemy import text

# Imports cohérents - adaptez selon VOTRE structure réelle
from backend.app.config import settings
from backend.app.database import engine, Base

# Import auth - vérifier le chemin exact
from backend.auth import auth_router

# ============================================================
# LIFESPAN
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Démarrage de l'API ONEE...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Tables PostgreSQL vérifiées/créées")
    
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
    
    return {
        "status": "healthy" if postgresql_status == "ok" else "degraded",
        "postgresql": postgresql_status
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
# MAIN
# ============================================================
if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
