import sqlite3

conn = sqlite3.connect('auction.db')
c = conn.cursor()
try:
    c.execute('ALTER TABLE players ADD COLUMN sold_at TIMESTAMP')
    conn.commit()
    print("Column added")
except Exception as e:
    print(e)
conn.close()
