import joblib, json, os

LIV = 'ml_models'                                    # adapter au chemin

b = joblib.load(os.path.join(LIV,'modele_onee.pkl'))
print('Type racine :', type(b).__name__,
      '| clés :', list(b.keys()) if hasattr(b,'keys') else 'N/A')
for k,v in (b.items() if hasattr(b,'keys') else []):
    print(f'  {k:<22} -> {type(v).__name__}',
          list(v.keys()) if isinstance(v,dict) else '')

# 1) Les 3 modèles annuels présents ?
for t in ['distribution','production','consommation_totale']:
    found = (
        isinstance(b, dict)
        and 'annuel' in b
        and isinstance(b['annuel'], dict)
        and t in b['annuel']
    )
    print(f'  annuel {t:<20}: {"OK" if found else "MANQUANT"}')

# 2) Verification — le modèle mensuel version
txt = json.dumps(str(b))
mensuel_ok = ('direct_multi_horizon' in txt) or ('bias_mois' in txt) or ('GCLIP' in txt)
print('  modèle mensuel CORRIGÉ (direct) :', 'OK' if mensuel_ok else '⚠️  ANCIENNE VERSION')

# 3) Les prévisions mensuelles correspondent-elles au modèle direct ?
pm = json.load(open(os.path.join(LIV,'previsions_mensuelles.json')))
print('  previsions_mensuelles.json :', len(pm),'lignes · champs :', list(pm[0].keys()))