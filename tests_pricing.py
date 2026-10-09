"""Base prices and bid increments per category: saving prices updates every
player not yet sold, new players take their category's price, and a team's
purse reserve prices each required slot at its category's base price.
"""
import os, sys
sys.stdout.reconfigure(encoding='utf-8')
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''           # keep test uploads on local disk, never the real bucket
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
aid = admin.post('/api/auctions', json={'name': 'Pricing Test'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)

for name, cat in [('Plat A', 'Platinum'), ('Plat B', 'Platinum'), ('Gold A', 'Gold'), ('Gold B', 'Gold'), ('Silver A', 'Silver')]:
    admin.post('/api/players', json={'name': name, 'category': cat, 'base_price': 10})
admin.post('/api/config', json={'config': {'min_players_per_team': '4'}, 'category_rules': [
    {'category': 'Platinum', 'min_per_team': 1, 'max_per_team': 2},
    {'category': 'Gold', 'min_per_team': 1, 'max_per_team': 2},
    {'category': 'Silver', 'min_per_team': 1, 'max_per_team': 2}]})
tid = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 20}).get_json()['id']

def players():
    return {p['name']: p for p in admin.get('/api/players').get_json()}

# A player sold before prices change keeps their price.
silver_id = players()['Silver A']['id']
admin.post('/api/players/edit_sale', json={'player_id': silver_id, 'status': 'sold', 'team_id': tid, 'sold_price': 0.4})

pricing = {'mode': 'category',
           'same': {'base': 0.2, 'increment': 0.1, 'steps': []},
           'categories': {
               'Platinum': {'base': 1, 'increment': 0.5, 'steps': [{'from': 10, 'increment': 1}]},
               'Gold': {'base': 0.6, 'increment': 0.3, 'steps': [{'from': 6, 'increment': 0.6}]},
               'Silver': {'base': 0.3, 'increment': 0.1, 'steps': []}}}
r = admin.post('/api/pricing', json={'pricing': pricing})
check('pricing saved', r.status_code == 200, r.get_data(as_text=True)[:120])
ps = players()
check('Platinum players get ₹1L', ps['Plat A']['base_price'] == 1 and ps['Plat B']['base_price'] == 1)
check('Gold players get ₹60K', ps['Gold A']['base_price'] == 0.6)
check('sold player keeps their base price', ps['Silver A']['base_price'] == 10 and ps['Silver A']['sold_price'] == 0.4)
cfg = admin.get('/api/config').get_json()
rules = {r['category']: r['base_price'] for r in cfg['category_rules']}
check('category rules carry the base prices', rules == {'Platinum': 1, 'Gold': 0.6, 'Silver': 0.3}, str(rules))
check('pricing is in the config every screen reads', '"Platinum"' in cfg['config'].get('pricing', ''))

admin.post('/api/players', json={'name': 'Gold C', 'category': 'Gold'})
check('player added without a price takes their category price', players()['Gold C']['base_price'] == 0.6)
admin.post('/api/players', json={'name': 'Gold D', 'category': 'Gold', 'base_price': 2})
check('an explicit price is kept', players()['Gold D']['base_price'] == 2)

r = admin.post('/api/pricing', json={'pricing': 'nonsense'})
check('malformed pricing refused', r.status_code == 400)

# ── Reserve: Reds hold Silver; squad of 4 needs Platinum and Gold still. ──
# Bidding on a Gold player: one Platinum slot (₹1L) + one open slot at the
# lowest base (₹30K) stay reserved.
A_rules = [{'category': c, 'min_per_team': 1, 'max_per_team': 2} for c in ('Platinum', 'Gold', 'Silver')]
cfg_dict = {'pricing': A.json.dumps(pricing), 'min_players_per_team': '4'}
mb, _t, need, spots, reserved, bp = A.compute_max_bid(20, {'Silver': 1}, A_rules, cfg_dict, 'Gold')
check('reserve prices required slots by category', (need, spots, reserved, mb, bp) == (3, 2, 1.3, 18.7, 0.6), str((need, spots, reserved, mb, bp)))
mb, _t, _n, _s, reserved, _bp = A.compute_max_bid(20, {'Silver': 1}, A_rules, cfg_dict, None)
check('no player on the block: assumes the costliest slot is filled', reserved == 0.9, str(reserved))
same_cfg = {'common_base_price': '10', 'min_players_per_team': '4'}
mb, _t, _n, spots, reserved, _bp = A.compute_max_bid(100, {'Silver': 1}, A_rules, same_cfg, 'Gold')
check('one price for everyone: slots × base price, as before', reserved == 20 and mb == 80, str((spots, reserved, mb)))

# Server refuses a sale that eats the Platinum reserve.
gold_id = players()['Gold A']['id']
r = admin.post('/api/sell_player', json={'player_id': gold_id, 'team_id': tid, 'sold_price': 19})
check('sale above the category reserve refused', r.status_code == 400 and 'reserved' in r.get_json().get('error', ''), r.get_data(as_text=True)[:160])
r = admin.post('/api/sell_player', json={'player_id': gold_id, 'team_id': tid, 'sold_price': 0.9})
check('sale within the purse accepted', r.status_code == 200, r.get_data(as_text=True)[:160])

# Categories decide prices, so the importer must read the right name column:
# a "Player ID" column ahead of "Name" used to become every player's name,
# and the analysis then could not match players to their new categories.
det = {h: {'is_name_candidate': True} for h in ('Player ID', 'Name', 'Player')}
check('"Name" wins over "Player ID"', A.pick_name_column(['Player ID', 'Name'], det) == 'Name')
check('an ID column is never the name', A.pick_name_column(['Player ID', 'Player'], det) == 'Player')

# Money text on the server matches the screens.
check('₹K below a lakh, ₹L above', A.fmt_lakhs(0.5) == '₹50K' and A.fmt_lakhs(1.5) == '₹1.5L' and A.fmt_lakhs(10) == '₹10L',
      '%s %s %s' % (A.fmt_lakhs(0.5), A.fmt_lakhs(1.5), A.fmt_lakhs(10)))

# ── The screens' bid steps (static/bidding.js), run under Node. ──
import json, subprocess, tempfile
script = r'''
const vm = require('vm'), fs = require('fs');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('static/bidding.js', 'utf8'), ctx);
const B = ctx.window.BidRules, fmtL = ctx.window.fmtL;
const pricing = B.parse({ pricing: JSON.stringify(%s) });
const run = (cat, from, n) => { const r = B.ruleFor(pricing, cat); let b = from, out = []; for (let i = 0; i < n; i++) { b = B.up(r, b); out.push(b); } return out; };
const plat = B.ruleFor(pricing, 'Platinum');
console.log(JSON.stringify({
  plat: run('Platinum', 9, 4), gold: run('Gold', 5.4, 3),
  platDown: [B.down(plat, 11), B.down(plat, 10), B.down(plat, 9.5)],
  other: run('Unknown', 0.2, 2),
  legacy: (() => { const p = B.parse({ common_base_price: '10', bid_increment: '5' }); return [p.mode, B.up(B.ruleFor(p, 'X'), 10)]; })(),
  fmt: [fmtL(0.5), fmtL(1), fmtL(1.25), fmtL(0.3), fmtL(0)],
}));
''' % json.dumps(pricing)
f = os.path.join(tempfile.mkdtemp(), 'bid_test.js')
open(f, 'w', encoding='utf-8').write(script)
out = json.loads(subprocess.run(['node', f], capture_output=True, text=True, encoding='utf-8', cwd=os.getcwd()).stdout)
check('Platinum: +50K up to 10L, then +1L', out['plat'] == [9.5, 10, 11, 12], str(out['plat']))
check('Gold: +30K up to 6L, then +60K', out['gold'] == [5.7, 6, 6.6], str(out['gold']))
check('lowering steps back the way it came', out['platDown'] == [10, 9.5, 9], str(out['platDown']))
check('category without its own rule uses the shared rule', out['other'] == [0.3, 0.4], str(out['other']))
check('auction set up before pricing keeps its single increment', out['legacy'] == ['same', 15], str(out['legacy']))
check('screen money format', out['fmt'] == ['₹50K', '₹1L', '₹1.25L', '₹30K', '₹0L'], str(out['fmt']))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
