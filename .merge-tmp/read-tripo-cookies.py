import sqlite3

path = r"C:\Users\alper\AppData\Roaming\ai-game-dev-hub\Partitions\tripo-web\Network\Cookies"
conn = sqlite3.connect(path)
cur = conn.cursor()
cur.execute(
    "SELECT host_key, name, length(encrypted_value) FROM cookies WHERE host_key LIKE '%tripo%' ORDER BY host_key, name"
)
rows = cur.fetchall()
print("cookie count", len(rows))
for row in rows:
    print(row)
