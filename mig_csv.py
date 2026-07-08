import pandas as pd

# Conversion des 3 fichiers
df1 = pd.read_parquet('master_panel.parquet')
df1.to_csv('master_panel.csv', index=False)

df2 = pd.read_parquet('fact_long.parquet')
df2.to_csv('fact_long.csv', index=False)

