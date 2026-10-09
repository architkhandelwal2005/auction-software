"""The live site runs on PostgreSQL through a small cursor wrapper (_PGCur);
every other test runs on SQLite. These checks stand in a fake psycopg2
cursor behind the wrapper, so the differences that only show on the live
site are caught here:

- SELL reads cursor.rowcount; the wrapper once lacked it, and every sale on
  the live site failed with a 500.
- psycopg2 treats every % as a placeholder when given parameters, even an
  empty tuple; a LIKE '%drive%' query once stopped the Drive photo download.
"""
import os, sys
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_SERVICE_KEY'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0


class FakePsycopgCursor:
    """Behaves like psycopg2: with parameters (even an empty tuple) every %
    in the SQL must be a placeholder or %%, otherwise it raises."""
    def __init__(self):
        self.rowcount = -1
        self.calls = []
    def execute(self, sql, params=None):
        if params is not None:
            sql % tuple(params)          # raises on a stray % like psycopg2
        self.calls.append((sql, params))
        self.rowcount = 1
    def fetchone(self): return None
    def fetchall(self): return []


raw = FakePsycopgCursor()
cur = A._PGCur(raw)
cur.execute("UPDATE players SET status='sold' WHERE id=? AND status != 'sold'", (5,))
check('cursor reports rows changed (SELL needs it)', cur.rowcount == 1)
try:
    cur.execute("SELECT id FROM players WHERE photo_url LIKE '%drive.google.com%'")
    ok = True
except Exception as exc:
    ok = False
check('a literal % without parameters is not read as a placeholder', ok)
check('placeholders converted for PostgreSQL', raw.calls[0][0].count('%s') == 1 and raw.calls[0][1] == (5,))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
