# backend/create_users_table.py
import psycopg2
import bcrypt

# Configuration PostgreSQL
POSTGRES_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "onee_db",
    "user": "postgres",
    "password": "2012"
}

# Hash du mot de passe "admin123"
ADMIN_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPjJkVzQoSQku'

def create_users_table():
    """Crée la table users et l'admin par défaut"""
    
    try:
        conn = psycopg2.connect(**POSTGRES_CONFIG)
        cursor = conn.cursor()
        
        # Créer la table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                immatriculation VARCHAR(50) UNIQUE NOT NULL,
                nom VARCHAR(100),
                prenom VARCHAR(100),
                is_admin BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ Table 'users' créée avec succès")
        
        # Créer l'admin par défaut
        cursor.execute("""
            INSERT INTO users (email, password_hash, immatriculation, nom, prenom, is_admin)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
        """, ('admin@aep-predict.com', ADMIN_PASSWORD_HASH, 'ADMIN-001', 'Administrateur', 'Système', True))
        
        conn.commit()
        
        # Vérifier
        cursor.execute("SELECT id, email, is_admin FROM users")
        users = cursor.fetchall()
        print(f"\n📋 Utilisateurs dans la base:")
        for user in users:
            print(f"   ID: {user[0]}, Email: {user[1]}, Admin: {user[2]}")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Configuration terminée!")
        print("   👤 Admin: admin@aep-predict.com")
        print("   🔑 Mot de passe: admin123")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    create_users_table()