"""Trades. Sold players move between two teams at their sale prices, each
purse paying for what it gains and refunded what it gives; refused past a
purse or a category maximum (unless the auctioneer overrides the category);
one undo reverses a whole trade.
"""
import os, sys
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_SERVICE_KEY'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Trades'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
admin.post('/api/config', json={'config': {'min_players_per_team': '1'}, 'category_rules': [
    {'category': 'Gold', 'base_price': 1, 'min_per_team': 0, 'max_per_team': 1},
    {'category': 'Silver', 'base_price': 1, 'min_per_team': 0, 'max_per_team': 5}]})
ids = {n: admin.post('/api/teams', json={'name': n, 'total_budget': b}).get_json()['id']
       for n, b in (('Reds', 100), ('Blues', 100), ('Greens', 10))}
pid = {n: admin.post('/api/players', json={'name': n, 'category': c, 'base_price': 1}).get_json()['id']
       for n, c in (('Asha', 'Gold'), ('Bina', 'Gold'), ('Chitra', 'Silver'), ('Dev', 'Silver'), ('Esha', 'Silver'))}
for n, team, price in (('Asha', 'Reds', 12), ('Bina', 'Blues', 9), ('Chitra', 'Reds', 3), ('Dev', 'Blues', 2), ('Esha', 'Greens', 4)):
    admin.post('/api/sell_player', json={'player_id': pid[n], 'team_id': ids[team], 'sold_price': price})

def teams():
    return {t['name']: t for t in admin.get('/api/teams').get_json()}
def team_of(n):
    return next(p for p in admin.get('/api/players').get_json() if p['id'] == pid[n])['team_id']
def trade(a, b, from_a=(), from_b=(), **kw):
    return admin.post('/api/trade', json=dict(team_a=ids[a], team_b=ids[b], from_a=[pid[n] for n in from_a],
                                              from_b=[pid[n] for n in from_b], **kw))
def books_balance(label):
    ps = admin.get('/api/players').get_json()
    bad = [t['name'] for t in admin.get('/api/teams').get_json()
           if abs(t['total_budget'] - sum(p['sold_price'] or 0 for p in ps if p['team_id'] == t['id'] and p['status'] == 'sold')
                  - t['remaining_budget']) > 1e-6]
    check(label + ': the books balance', not bad, str(bad))

r = trade('Reds', 'Blues', ['Chitra'], ['Dev'])
check('a swap goes through', r.status_code == 200, r.get_data(as_text=True)[:120])
check('each player moves', team_of('Chitra') == ids['Blues'] and team_of('Dev') == ids['Reds'])
t = teams()
check('each purse pays for what it gains', t['Reds']['remaining_budget'] == 100 - 12 - 2 and t['Blues']['remaining_budget'] == 100 - 9 - 3,
      '%s %s' % (t['Reds']['remaining_budget'], t['Blues']['remaining_budget']))
books_balance('after a swap')

r = trade('Blues', 'Greens', ['Chitra'])
check('a one-way transfer goes through', r.status_code == 200 and team_of('Chitra') == ids['Greens'])
books_balance('after a transfer')
r = trade('Reds', 'Greens', ['Asha'])
check('one the purse cannot pay is refused', r.status_code == 409 and r.get_json()['message'] == 'Greens would be ₹9L short.',
      r.get_data(as_text=True)[:120])
r = trade('Reds', 'Blues', ['Asha'])
check("one past a category maximum is refused", r.status_code == 409 and 'Gold' in r.get_json()['message'], r.get_data(as_text=True)[:120])
check('unless the auctioneer overrides it', trade('Reds', 'Blues', ['Asha'], override_category_max=True).status_code == 200
      and team_of('Asha') == ids['Blues'])
check("a player not in the giving team's squad is refused", trade('Reds', 'Blues', ['Bina']).status_code == 400)
check('so is a trade with nobody in it', trade('Reds', 'Blues').status_code == 400)
check('or a team with itself', trade('Reds', 'Reds', ['Dev']).status_code == 400)

r = admin.post('/api/undo')
check('undo reverses the last trade', r.get_json()['success'] and team_of('Asha') == ids['Reds'], r.get_data(as_text=True)[:100])
admin.post('/api/undo')
check('then the transfer', team_of('Chitra') == ids['Blues'])
admin.post('/api/undo')
check('then both players of the swap at once', team_of('Chitra') == ids['Reds'] and team_of('Dev') == ids['Blues'])
books_balance('after undoing the trades')
check('the next undo is the last sale again', admin.post('/api/undo').get_json()['player_name'] == 'Esha')
check('a team owner cannot record a trade', A.app.test_client().post('/api/trade', json={}).status_code in (401, 403))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
