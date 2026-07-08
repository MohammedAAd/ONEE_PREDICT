import pyodbc

ACCESS_FILE = r"C:\Users\Louis\onee\onee\onee\2_Dataset1.accdb"

conn_str = (
    r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    rf"DBQ={ACCESS_FILE};"
)

conn = pyodbc.connect(conn_str)

cursor = conn.cursor()

print("=" * 60)
print("TABLES ET COLONNES ACCESS")
print("=" * 60)

for table in cursor.tables(tableType='TABLE'):

    table_name = table.table_name

    # ignorer tables système
    if table_name.startswith("MSys"):
        continue

    print(f"\n📋 TABLE: {table_name}")

    columns = cursor.columns(table=table_name)

    for col in columns:

        print(
            f"   - {col.column_name:<30} "
            f"{col.type_name}"
        )

conn.close()