# Livraison ONEE-Predict — données & modèle
modele_onee.pkl ............ modèle (3 cibles annuelles + mensuel) → BACKEND
previsions_annuelles.json .. prévision par centre × année × cible (q10/q50/q90) → REACT
previsions_mensuelles.json . volume cible par installation × mois (m+12) → REACT
previsions_par_dr.json ..... agrégation mensuelle par zone (DR) → REACT
dim_centres.json ........... référentiel des centres → REACT
shap_global.json ........... facteurs d'influence par cible → REACT
shap_par_centre.json ....... facteurs par centre → REACT
