import pandas as pd
from sqlalchemy import create_engine
import logging

# =====================================================
# CONFIG
# =====================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'onee_db',
    'user': 'postgres',
    'password': '2012'
}

FILE_PATHS = {
    'fact_long': 'fact_long.csv',
    'master_panel': 'master_panel.csv'
}

# =====================================================
# ETL SIMPLE
# =====================================================

class SimpleETL:

    def __init__(self, db_config, file_paths):
        self.db_config = db_config
        self.file_paths = file_paths
        self.engine = None

    def connect(self):

        conn_string = (
            f"postgresql://"
            f"{self.db_config['user']}:"
            f"{self.db_config['password']}@"
            f"{self.db_config['host']}:"
            f"{self.db_config['port']}/"
            f"{self.db_config['database']}"
        )

        self.engine = create_engine(conn_string)

        logger.info("Connexion PostgreSQL etablie")

    def read_csv_robust(self, file_path):

        encodings = ['utf-8', 'utf-16', 'latin1', 'cp1252']
        separators = [',', ';', '\t']

        for enc in encodings:
            for sep in separators:

                try:

                    logger.info(
                        f"Test fichier={file_path} "
                        f"enc={enc} sep='{sep}'"
                    )

                    df = pd.read_csv(
                        file_path,
                        sep=sep,
                        encoding=enc,
                        engine='python',
                        on_bad_lines='skip'
                    )

                    if len(df.columns) > 1:

                        logger.info(
                            f"Lecture OK -> "
                            f"colonnes={len(df.columns)} "
                            f"lignes={len(df)}"
                        )

                        return df

                except Exception as e:
                    logger.warning(
                        f"Echec enc={enc} sep='{sep}' : {e}"
                    )

        raise Exception(f"Impossible de lire {file_path}")

    def extract(self):

        logger.info("Extraction des fichiers...")

        df_fact_long = self.read_csv_robust(
            self.file_paths['fact_long']
        )

        df_master_panel = self.read_csv_robust(
            self.file_paths['master_panel']
        )

        return df_fact_long, df_master_panel

    def transform(self, df_fact_long, df_master_panel):

        logger.info("Transformation simple...")

        # Nettoyage colonnes
        df_fact_long.columns = [
            col.strip().lower()
            for col in df_fact_long.columns
        ]

        df_master_panel.columns = [
            col.strip().lower()
            for col in df_master_panel.columns
        ]

        # Remplacer NaN par None
        df_fact_long = df_fact_long.where(
            pd.notnull(df_fact_long),
            None
        )

        df_master_panel = df_master_panel.where(
            pd.notnull(df_master_panel),
            None
        )

        return df_fact_long, df_master_panel

    def load(self, df_fact_long, df_master_panel):

        logger.info("Chargement PostgreSQL...")

        # FACT LONG
        df_fact_long.to_sql(
            'fact_long',
            self.engine,
            if_exists='replace',
            index=False,
            chunksize=1000
        )

        logger.info(
            f"fact_long charge: {len(df_fact_long)} lignes"
        )

        # MASTER PANEL
        df_master_panel.to_sql(
            'master_panel',
            self.engine,
            if_exists='replace',
            index=False,
            chunksize=1000
        )

        logger.info(
            f"master_panel charge: "
            f"{len(df_master_panel)} lignes"
        )

    def run(self):

        logger.info("=== DEBUT ETL ===")

        try:

            self.connect()

            df_fact_long, df_master_panel = self.extract()

            df_fact_long, df_master_panel = self.transform(
                df_fact_long,
                df_master_panel
            )

            self.load(
                df_fact_long,
                df_master_panel
            )

            logger.info("=== SUCCES ETL ===")

        except Exception as e:

            logger.error(f"Erreur: {e}")

# =====================================================
# MAIN
# =====================================================

if __name__ == "__main__":

    etl = SimpleETL(
        DB_CONFIG,
        FILE_PATHS
    )

    etl.run()