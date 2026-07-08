import asyncio
import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, inspect
from sqlalchemy.exc import SQLAlchemyError
import logging
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = "postgresql+asyncpg://postgres:2012@localhost:5432/onee_db"

# Configuration base de données
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:root@localhost:5432/onee_db')

async def check_table_structure(conn):
    """Vérifie la structure des tables existantes"""
    
    # Vérifier la structure de installations_production
    result = await conn.execute(text("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'installations_production'
        ORDER BY ordinal_position
    """))
    columns = result.fetchall()
    logger.info("Structure de installations_production:")
    for col in columns:
        logger.info(f"  - {col[0]}: {col[1]} (nullable: {col[2]})")
    
    # Vérifier les contraintes
    result = await conn.execute(text("""
        SELECT conname, contype, conkey
        FROM pg_constraint
        WHERE conrelid = 'installations_production'::regclass
    """))
    constraints = result.fetchall()
    logger.info("Contraintes sur installations_production:")
    for const in constraints:
        logger.info(f"  - {const[0]}: type={const[1]}, keys={const[2]}")
    
    return columns, constraints

async def import_link_installations():
    """Importe les relations installations - centres sans clés étrangères"""
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with engine.connect() as conn:
            # Vérifier la structure
            await check_table_structure(conn)
            
            # 1. Vérifier/créer la table ref_centres_uniques
            logger.info("📝 Création de la table de référence des centres uniques...")
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ref_centres_uniques (
                    id_centre_desservi VARCHAR(50) PRIMARY KEY,
                    lib_centre_uniformise VARCHAR(255)
                )
            """))
            
            # Remplir ref_centres_uniques
            await conn.execute(text("""
                INSERT INTO ref_centres_uniques (id_centre_desservi, lib_centre_uniformise)
                SELECT DISTINCT id_centre_desservi, MAX(lib_centre_uniformise)
                FROM master_panel
                WHERE id_centre_desservi IS NOT NULL
                GROUP BY id_centre_desservi
                ON CONFLICT (id_centre_desservi) DO NOTHING
            """))
            await conn.commit()
            logger.info("✅ Table ref_centres_uniques prête")
            
            # 2. Lire le fichier Excel
            df = pd.read_excel('Link_Installations_Centres_desservis.xlsx')
            logger.info(f"📊 Fichier chargé: {len(df)} lignes")
            logger.info(f"📋 Colonnes: {list(df.columns)}")
            
            # Nettoyer les données
            df = df.drop_duplicates()
            df = df.dropna(subset=['Installation', 'ID_Centre_Desservi'])
            logger.info(f"🗑️ Après nettoyage: {len(df)} lignes")
            
            # Récupérer les installations existantes
            result = await conn.execute(text("SELECT installation FROM installations_production"))
            existing_installations = {row[0] for row in result.fetchall()}
            logger.info(f"📋 Installations existantes dans BDD: {len(existing_installations)}")
            
            # Récupérer les centres existants
            result = await conn.execute(text("SELECT id_centre_desservi FROM ref_centres_uniques"))
            existing_centres = {row[0] for row in result.fetchall()}
            logger.info(f"📋 Centres existants: {len(existing_centres)}")
            
            # Filtrer les lignes valides
            valid_rows = []
            missing_installations = set()
            missing_centres = set()
            
            for _, row in df.iterrows():
                installation = row['Installation']
                centre_id = str(row['ID_Centre_Desservi']) if pd.notna(row['ID_Centre_Desservi']) else None
                
                if installation not in existing_installations:
                    missing_installations.add(installation)
                    continue
                
                if centre_id not in existing_centres:
                    missing_centres.add(centre_id)
                    continue
                
                valid_rows.append({
                    'installation': installation,
                    'id_centre_desservi': centre_id,
                    'lib_centre_desservi': row.get('LIB_CENTRE_Desservi', '')
                })
            
            logger.info(f"✅ Lignes valides: {len(valid_rows)}")
            logger.info(f"⚠️ Installations manquantes: {len(missing_installations)}")
            logger.info(f"⚠️ Centres manquants: {len(missing_centres)}")
            
            if missing_installations:
                logger.info("\n📋 Installations manquantes:")
                for inst in list(missing_installations)[:10]:
                    logger.info(f"   - {inst}")
            
            # 3. Supprimer l'ancienne table si elle existe
            await conn.execute(text("DROP TABLE IF EXISTS link_installations_master_panel"))
            await conn.commit()
            logger.info("✅ Ancienne table supprimée")
            
            # 4. Créer la nouvelle table SANS clés étrangères
            logger.info("📝 Création de la table link_installations_master_panel...")
            await conn.execute(text("""
                CREATE TABLE link_installations_master_panel (
                    installation VARCHAR(255),
                    id_centre_desservi VARCHAR(50),
                    lib_centre_desservi VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (installation, id_centre_desservi)
                )
            """))
            await conn.commit()
            logger.info("✅ Table créée")
            
            # 5. Insérer les données
            if valid_rows:
                logger.info("📝 Insertion des données...")
                for row in valid_rows:
                    await conn.execute(text("""
                        INSERT INTO link_installations_master_panel 
                        (installation, id_centre_desservi, lib_centre_desservi)
                        VALUES (:installation, :id_centre_desservi, :lib_centre_desservi)
                        ON CONFLICT (installation, id_centre_desservi) DO NOTHING
                    """), row)
                
                await conn.commit()
                logger.info(f"✅ {len(valid_rows)} relations insérées")
            
            # 6. Vérifier le résultat
            result = await conn.execute(text("SELECT COUNT(*) FROM link_installations_master_panel"))
            count = result.scalar()
            logger.info(f"📊 Total dans link_installations_master_panel: {count} lignes")
            
            # 7. Afficher un aperçu
            result = await conn.execute(text("""
                SELECT l.installation, l.id_centre_desservi, l.lib_centre_desservi
                FROM link_installations_master_panel l
                LIMIT 10
            """))
            logger.info("\n📋 Aperçu des données insérées:")
            for row in result.fetchall():
                logger.info(f"   - {row[0]} -> {row[1]} ({row[2]})")
            
    except Exception as e:
        logger.error(f"❌ Erreur: {e}")
        raise
    finally:
        await engine.dispose()

async def main():
    logger.info("=" * 60)
    logger.info("📥 Import des relations installations - centres (sans clés étrangères)")
    logger.info("=" * 60)
    await import_link_installations()
    logger.info("\n✅ Import terminé!")

if __name__ == "__main__":
    asyncio.run(main())