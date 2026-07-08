"""Test rapide - exécutez ceci en premier !"""
import pyodbc
import sys

def test_access_connection(access_file):
    """Test si Access est accessible"""
    try:
        conn_str = (
            r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
            rf"DBQ={access_file};"
        )
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute("SELECT 1 as test")
        result = cursor.fetchone()
        conn.close()
        print(f"✅ Connexion Access réussie ! Test: {result.test}")
        return True
    except Exception as e:
        print(f"❌ Échec connexion Access: {e}")
        print("\nSolutions:")
        print("1. Vérifiez le chemin du fichier .accdb")
        print("2. Installez 'Microsoft Access Database Engine'")
        print("3. Lancez PowerShell en Administrateur")
        return False

if __name__ == "__main__":
    from config import ACCESS_FILE
    if test_access_connection(ACCESS_FILE):
        print("\n✅ Prêt à migrer ! Lancez main.py")
    else:
        sys.exit(1)