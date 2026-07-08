# find_accdb.py
import os
from pathlib import Path

def search_accdb(root_path, filename="2_Dataset1.accdb"):
    """Recherche récursive un fichier .accdb"""
    print(f"🔍 Recherche de '{filename}' depuis {root_path}...")
    results = []
    
    for dirpath, dirnames, filenames in os.walk(root_path):
        # Ignorer les dossiers système
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d not in ['__pycache__', 'node_modules']]
        
        if filename in filenames:
            full_path = Path(dirpath) / filename
            results.append(str(full_path))
            print(f"✅ TROUVÉ : {full_path}")
    
    # Chercher aussi tous les .accdb si le nom exact n'est pas trouvé
    if not results:
        print(f"⚠️ '{filename}' non trouvé. Recherche de tous les .accdb...")
        for dirpath, dirnames, filenames in os.walk(root_path):
            dirnames[:] = [d for d in dirnames if not d.startswith('.') and d not in ['__pycache__', 'node_modules']]
            for f in filenames:
                if f.endswith('.accdb'):
                    full_path = Path(dirpath) / f
                    print(f"💡 Trouvé : {full_path}")
                    results.append(str(full_path))
    
    return results

if __name__ == "__main__":
    # Cherche depuis ton dossier utilisateur
    root = Path(r"C:\Users\Louis\onee")
    found = search_accdb(root)
    
    if found:
        print(f"\n🎉 Copie ce chemin dans ton .env :")
        print(f"ACCESS_DB_PATH={found[0]}")
    else:
        print("\n❌ Fichier .accdb introuvable. Vérifie :")
        print("   1. Le fichier a-t-il été déplacé/renommé ?")
        print("   2. As-tu les permissions pour lire ce dossier ?")