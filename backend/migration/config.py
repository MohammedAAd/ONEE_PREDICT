# Configuration - Adapter vos paramètres
POSTGRES_CONFIG = {
    "host": "localhost",      # ou IP de votre serveur PostgreSQL
    "port": 5432,
    "database": "onee_db",
    "user": "postgres",
    "password": "2012"
}

ACCESS_FILE ="C:/Users/aadil/Downloads/2_Dataset1.accdb"  # ← Modifier ici

TABLES_TO_MIGRATE = [
    "CENTRES_DESSERVIS",
    "CENTRES_HCP_2004",
    "CENTRES_HCP_2014",
    "COMMUNES_2024",
    "Fact_Activite_AEP",
    "INSTALLATIONS_PRODUCTION",
    "Link_Centres 2024-2014",
    "Link_CENTRES_2014_2004",
    "Link_Centres_Desservis_HCP"
]

POSTGRES_SCHEMA = "public"