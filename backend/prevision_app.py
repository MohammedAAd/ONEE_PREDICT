"""
backend/prevision_app.py
=========================
Mini-API AUTONOME : previsions + moteur de scenarios uniquement.
N'a besoin d'aucune base de données — seulement des artefacts JSON.

Idéal pour que l'equipe React developpe tout de suite, sans configurer la base.

Lancer (depuis la racine du depot) :
    uvicorn backend.prevision_app:app --reload --port 8000

Les endpoints sont STRICTEMENT les memes que dans backend/main.py
(/api/v1/prediction/... et /api/v1/scenario/...) : le code React ne changera pas
quand vous basculerez sur main.py.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1 import prediction, scenario

app = FastAPI(title="ONEE — Previsions & Scenarios", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000",
                   "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prediction.router, prefix="/api/v1")
app.include_router(scenario.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "service": "ONEE — Previsions & Scenarios",
        "docs": "/docs",
        "endpoints": ["/api/v1/prediction/...", "/api/v1/scenario/"],
    }
