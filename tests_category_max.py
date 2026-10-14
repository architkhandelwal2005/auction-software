"""A category's maximum per team. A sale past it is refused unless the
auctioneer confirms it on purpose; every screen knows which teams are full
for the player on the block.
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

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Caps'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
admin.post('/api/config', json={'config': {'min_players_per_team': '3'}, 'category_rules': [
    {'category': 'Gold', 'base_price': 1, 'min_per_team': 0, 'max_per_team': 1},
    {'category': 'Silver', 'base_price': 1, 'min_per_team': 0, 'max_per_team': 5}]})
reds = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']
blues = admin.post('/api/teams', json={'name': 'Blues', 'total_budget': 100}).get_json()['id']
g1 = admin.post('/api/players', json={'name': 'Gold One', 'category': 'Gold', 'base_price': 1}).get_json()['id']
g2 = admin.post('/api/players', json={'name': 'Gold Two', 'category': 'Gold', 'base_price': 1}).get_json()['id']
g3 = admin.post('/api/players', json={'name': 'Gold Three', 'category': 'Gold', 'base_price': 1}).get_json()['id']
s1 = admin.post('/api/players', json={'name': 'Silver One', 'category': 'Silver', 'base_price': 1}).get_json()['id']

sell = lambda pid, tid, **kw: admin.post('/api/sell_player', json=dict(player_id=pid, team_id=tid, sold_price=2, **kw))
check('the first Gold player sells', sell(g1, reds).status_code == 200)
admin.post('/api/auction/state', json={'current_player': 'Gold Two', 'current_player_id': str(g2), 'category': 'Gold', 'current_bid': 1})
teams = {t['id']: t for t in admin.get('/api/teams').get_json()}
check('screens see Reds are full for this Gold player', teams[reds]['category_full'] is True
      and teams[blues]['category_full'] is False)
r = sell(g2, reds)
check('a second Gold player to Reds is refused', r.status_code == 409 and r.get_json()['error'] == 'category_full', str(r.status_code))
check('and says why', r.get_json()['message'] == 'Reds already has 1 of 1 Gold players.', r.get_json()['message'])
check('nothing was charged', {t['id']: t for t in admin.get('/api/teams').get_json()}[reds]['remaining_budget'] == 98)
check('another team can buy them', sell(g2, blues).status_code == 200)
check('the auctioneer can still record it on purpose', sell(g3, reds, override_category_max=True).status_code == 200)
check('other categories are not affected', sell(s1, reds).status_code == 200)
admin.post('/api/auction/state', json={'current_player': '', 'current_bid': 0})
check('with nobody on the block, no team is marked full',
      not any(t['category_full'] for t in admin.get('/api/teams').get_json()))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
