import os
from dotenv import load_dotenv

load_dotenv()

# Configuration de la base Access
ACCESS_DB_PATH = os.getenv("ACCESS_DB_PATH", r"C:\votre_chemin\base_donnees.accdb")

# Configuration CORS
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]