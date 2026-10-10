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

# The connection pool fails at once when empty, so it must hold two
# connections (registry + auction) for every gunicorn thread. At 10 it ran
# out during the live auction and putting a player on the block failed.
import re
threads = int(re.search(r'--threads\s+(\d+)', open('Procfile').read()).group(1))
check('connection pool covers every request thread', A.PG_POOL_MAX >= 2 * threads,
      'pool %d, threads %d' % (A.PG_POOL_MAX, threads))

# PostgreSQL returns TIMESTAMP columns as datetime objects where SQLite returns
# text. End Auction stores the report as JSON; a sold player's sale time once
# made it fail with a 500, so the auction could not be ended nor its report
# opened. The report is built here with sale times as datetimes.
import datetime
admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'PG dates'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
admin.post('/api/auction/go_live', json={})
tid = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']
pid = admin.post('/api/players', json={'name': 'Asha', 'category': 'A', 'base_price': 1}).get_json()['id']
admin.post('/api/sell_player', json={'player_id': pid, 'team_id': tid, 'sold_price': 5})
_live = A.build_live_report
def pg_dates(conn):
    report = _live(conn)
    for p in report['sold_players'] + [q for t in report['teams'] for q in t['players']]:
        if p.get('sold_at'):
            p['sold_at'] = datetime.datetime(2026, 10, 10, 20, 15, 0)
    return report
A.build_live_report = pg_dates
r = admin.post('/api/auction/end', json={})
check('End Auction works when sale times are datetimes', r.status_code == 200 and r.get_json().get('success'), r.get_data(as_text=True)[:120])
A.build_live_report = _live
r = admin.get('/api/report/final')
check('and the report opens', r.status_code == 200 and r.get_json()['report']['sold_players'][0]['name'] == 'Asha', r.get_data(as_text=True)[:120])

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
