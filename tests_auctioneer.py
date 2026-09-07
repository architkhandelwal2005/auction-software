"""Per-auction login: an auctioneer signs in directly to the one auction they
were given credentials for, can run and end it, but cannot reach the registry
or any other auction. The super-admin's own door still works unchanged.
"""
import os, sys
os.environ['DATABASE_URL'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': 'admin@123'})

# ── Creation: validation and uniqueness ──────────────────────────────────────
r = admin.post('/api/auctions', json={'name': 'Half Creds', 'login_id': 'onlyid'})
check('login id without password refused', r.status_code == 400, r.get_data(as_text=True)[:80])
r = admin.post('/api/auctions', json={'name': 'Half Creds 2', 'password': 'onlypass'})
check('password without login id refused', r.status_code == 400, r.get_data(as_text=True)[:80])

r = admin.post('/api/auctions', json={'name': 'Ficci Flo', 'login_id': 'ficci2026', 'password': 'secret1'})
check('auction created with credentials', r.status_code == 200, r.get_data(as_text=True)[:120])
aid = r.get_json()['auction']['id']

r = admin.post('/api/auctions', json={'name': 'Copycat', 'login_id': 'FICCI2026', 'password': 'other'})
check('duplicate login id (any case) refused', r.status_code == 400, r.get_data(as_text=True)[:100])

# A second, distinct auction to prove isolation.
r2 = admin.post('/api/auctions', json={'name': 'Other Event', 'login_id': 'other2026', 'password': 'secret2'})
other_id = r2.get_json()['auction']['id']

admin.post('/api/auctions/%d/open' % aid)
admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 1000})
admin.post('/api/players', json={'name': 'X', 'category': 'A', 'base_price': 10})
admin.post('/api/auction/go_live')

# ── The auctioneer's own door ─────────────────────────────────────────────────
auc = A.app.test_client()
r = auc.post('/api/auth/login', json={'role': 'admin', 'login_id': 'wrongid', 'password': 'secret1'})
check('wrong login id refused', r.status_code == 401)
r = auc.post('/api/auth/login', json={'role': 'admin', 'login_id': 'ficci2026', 'password': 'wrongpass'})
check('wrong password refused', r.status_code == 401)
r = auc.post('/api/auth/login', json={'role': 'admin', 'login_id': 'ficci2026', 'password': 'secret1'})
check('correct login id + password accepted', r.status_code == 200, r.get_data(as_text=True)[:100])
# Case-insensitive login id, exact-case password.
auc2 = A.app.test_client()
r = auc2.post('/api/auth/login', json={'role': 'admin', 'login_id': 'FICCI2026', 'password': 'secret1'})
check('login id is case-insensitive', r.status_code == 200)

# ── What the auctioneer can and cannot do ────────────────────────────────────
check('auctioneer lands straight on their auction, no chooser',
      auc.get('/api/auction/status').get_json().get('id') == aid)
# The /admin page view has its own role check, separate from the API policy
# table (it renders a template, not JSON) — verify it explicitly rather than
# only exercising API endpoints, which would miss a check like this one.
check('auctioneer can actually open the /admin page', auc.get('/admin').status_code == 200)
check('auctioneer may read players', len(auc.get('/api/players').get_json()) == 1)
r = auc.post('/api/players', json={'name': 'Y', 'category': 'A', 'base_price': 10})
check('auctioneer may add a player', r.status_code == 200, r.get_data(as_text=True)[:100])
r = auc.post('/api/sell_player', json={'player_id': 1, 'team_id': 1, 'sold_price': 20})
check('auctioneer may sell a player', r.status_code == 200, r.get_data(as_text=True)[:100])

check('auctioneer refused the registry list', auc.get('/api/auctions').status_code == 401)
check('auctioneer refused creating an auction',
      auc.post('/api/auctions', json={'name': 'Sneaky'}).status_code == 401)
r = auc.post('/api/auctions/%d/open' % other_id)
check('auctioneer refused opening another auction', r.status_code == 401, str(r.status_code))

# resolve_auction() must key strictly off session['auction_id'], never off
# anything a request could supply — a real client cannot alter this signed
# session at all, but this confirms scoping actually follows that field
# rather than, say, whichever auction the process last touched.
with auc.session_transaction() as sess:
    sess['auction_id'] = other_id
r = auc.get('/api/players')
check('scoping follows session auction_id, sees the other auction\'s own empty pool',
      r.status_code == 200 and len(r.get_json()) == 0, str(r.get_json()))
with auc.session_transaction() as sess:
    sess['auction_id'] = aid   # restore

# ── The auctioneer can end and reopen their own event ────────────────────────
r = auc.post('/api/auction/end')
check('auctioneer may end their own auction', r.status_code == 200, r.get_data(as_text=True)[:100])
r = auc.get('/report')
check('report opens for the auctioneer once ended', r.status_code == 200)
r = auc.post('/api/auction/reopen')
check('auctioneer may reopen their own auction', r.status_code == 200)

# ── The super-admin's own login is unaffected ────────────────────────────────
fresh = A.app.test_client()
r = fresh.post('/api/auth/login', json={'role': 'admin', 'password': 'admin@123'})
check('super-admin login still works with no login_id', r.status_code == 200)
check('super-admin can list all auctions', fresh.get('/api/auctions').status_code == 200)

print('\n%s' % ('ALL CHECKS PASSED' if check.failed == 0 else '%d CHECK(S) FAILED' % check.failed))
sys.exit(1 if check.failed else 0)
