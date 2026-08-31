const { useState, useEffect } = React;

const TeamApp = () => {
    const teamId = window.CURRENT_TEAM_ID;
    const [team, setTeam] = useState(null);
    const [allTeams, setAllTeams] = useState([]);
    const [liveData, setLiveData] = useState(null);
    const [config, setConfig] = useState(null);
    const [categories, setCategories] = useState([]);
    
    // Fetch initial data
    const fetchTeamData = async () => {
        try {
            const res = await fetch('/api/teams');
            const data = await res.json();
            setAllTeams(data);
            const myTeam = data.find(t => t.id === teamId);
            if (myTeam) setTeam(myTeam);
            
            const cfgRes = await fetch('/api/config');
            const cfgData = await cfgRes.json();
            setConfig(cfgData.config);
            setCategories(cfgData.category_rules);
        } catch (err) {
            console.error("Error fetching team data", err);
        }
    };

    const fetchLive = async () => {
        try {
            const res = await fetch('/api/live_data');
            const data = await res.json();
            // /api/live_data returns the player on the block inside `auction_state`
            // as flat strings (current_player is a NAME, not an object). The views
            // below want a player object, so build one here.
            const st = data.auction_state || {};
            const name = (st.current_player || '').trim();
            data.current_bid = parseFloat(st.current_bid) || 0;
            if (name) {
                const pool = data.unsold_players || [];
                const match = pool.find(p => p.name === name);
                data.current_player = {
                    id: match ? match.id : null,
                    name: name,
                    category: st.category || (match ? match.category : '') || '',
                    base_price: parseFloat(st.base_price) || (match ? match.base_price : 0) || 0,
                    photo_url: st.photo_url || (match ? match.photo_url : '') || '',
                    attributes: match ? match.attributes : {},
                    status: match ? match.status : 'unsold',
                };
            } else {
                data.current_player = null;
            }
            setLiveData(data);
        } catch (err) {
            console.error("Error fetching live data", err);
        }
    };

    useEffect(() => {
        fetchTeamData();
        fetchLive();
        const t1 = setInterval(fetchTeamData, 3000);
        const t2 = setInterval(fetchLive, 1000);
        return () => { clearInterval(t1); clearInterval(t2); };
    }, []);

    if (!team || !config) {
        return <div className="min-h-screen flex items-center justify-center text-white bg-zinc-950">
            <i className="fa-solid fa-spinner animate-spin text-4xl text-emerald-500"></i>
        </div>;
    }

    // ─── MAX BID & STRATEGY ───
    // Use the server's authoritative values so the team page can never disagree
    // with what the admin/auctioneer actually enforces on a sale.
    const basePrice = team.common_base_price != null ? team.common_base_price : parseFloat(config.common_base_price || 50);
    const currentSquadSize = team.players ? team.players.length : 0;
    const remainingSlots = team.needed_players != null ? team.needed_players : 0;
    const reservedFunds = team.reserved_purse != null ? team.reserved_purse : 0;
    const maxBid = team.max_allowed_bid != null ? team.max_allowed_bid : team.remaining_budget;

    // Strategy breakdown
    const strategy = categories.map(cat => {
        const owned = team.players.filter(p => p.category === cat.category).length;
        const required = parseInt(cat.min_per_team) || 0;
        return {
            category: cat.category,
            owned,
            required,
            needs: Math.max(0, required - owned),
            fulfilled: owned >= required
        };
    });

    // A player is on the block whenever the auctioneer has staged one; the pool
    // lookup may miss (e.g. a revived player), so don't require a status match.
    const isBiddingActive = !!(liveData && liveData.current_player && liveData.current_player.name);

    return (
        <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-nunito pb-10">
            {/* Header */}
            <header className="bg-zinc-900/90 border-b border-zinc-800 p-4 sticky top-0 z-30 shadow-lg">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg" style={{backgroundColor: team.color || '#10b981'}}>
                            {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover rounded-2xl" /> : team.name[0]}
                        </div>
                        <div>
                            <h1 className="fredoka text-2xl md:text-3xl font-bold">{team.name}</h1>
                            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                {config.org_logo && <img src={config.org_logo} alt="" className="w-4 h-4 object-contain rounded" />}
                                <span className="truncate">{config.event_name || 'Team Dashboard'}{config.organisation_name ? ' · ' + config.organisation_name : ''}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 items-center bg-zinc-950 p-2 rounded-2xl border border-zinc-800">
                        <div className="px-4 py-2 text-center">
                            <div className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider mb-1">Purse</div>
                            <div className="text-2xl fredoka font-bold text-emerald-400">₹{team.remaining_budget}L</div>
                        </div>
                        <div className="w-px h-10 bg-zinc-800"></div>
                        <div className="px-4 py-2 text-center">
                            <div className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider mb-1">Squad</div>
                            <div className="text-2xl fredoka font-bold text-white">{currentSquadSize} <span className="text-sm text-zinc-600">/ {team.target_squad_size != null ? team.target_squad_size : currentSquadSize}</span></div>
                        </div>
                        <button onClick={()=>window.location.href='/'} className="px-3 hover:text-red-400 transition" title="Logout">
                            <i className="fa-solid fa-power-off"></i>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-6xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mt-4">
                
                {/* LEFT COL: Live Stage & My Squad */}
                <div className="space-y-6">
                    
                    {/* Live Stage Banner */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative">
                        {isBiddingActive ? (
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 px-3 py-1 rounded-full">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-extrabold text-red-400 uppercase tracking-widest">On The Hammer</span>
                                    </div>
                                    <div className="text-xs font-bold text-zinc-500">Current Bid: <span className="text-amber-400 text-base">₹{liveData.current_bid}L</span></div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                                    <div className="w-32 h-32 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                                        {liveData.current_player.photo_url ? (
                                            <img src={liveData.current_player.photo_url} className="w-full h-full object-cover" />
                                        ) : <i className="fa-solid fa-user text-4xl text-zinc-700"></i>}
                                    </div>
                                    <div className="text-center sm:text-left flex-1 min-w-0">
                                        <h2 className="fredoka text-3xl font-bold text-white truncate">{liveData.current_player.name}</h2>
                                        <div className="inline-block px-3 py-1 bg-zinc-800 rounded-lg text-xs font-bold text-zinc-300 mt-2">
                                            {liveData.current_player.category || 'General'}
                                        </div>
                                        <div className="text-sm font-bold text-zinc-500 mt-2">Base: ₹{liveData.current_player.base_price}L</div>
                                        
                                        {/* Strategy Warning for this player */}
                                        {(() => {
                                            const pCat = liveData.current_player.category;
                                            const strat = strategy.find(s => s.category === pCat);
                                            if (strat && strat.needs > 0) {
                                                return <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg">
                                                    <i className="fa-solid fa-crosshairs"></i> TARGET: You need {strat.needs} more {pCat}
                                                </div>;
                                            } else if (strat && strat.fulfilled) {
                                                return <div className="mt-4 inline-flex items-center gap-2 bg-zinc-800/50 text-zinc-400 text-xs font-bold px-3 py-1.5 rounded-lg">
                                                    <i className="fa-solid fa-check"></i> Quota met for {pCat}
                                                </div>;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>
                                
                                <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-extrabold text-zinc-500 uppercase tracking-widest mb-1">Your Max Allowed Bid</div>
                                        {maxBid >= (liveData.current_bid || liveData.current_player.base_price) ? (
                                            <div className="text-2xl fredoka font-bold text-emerald-400">₹{maxBid}L</div>
                                        ) : (
                                            <div className="text-xl fredoka font-bold text-red-500 flex items-center gap-2">
                                                <i className="fa-solid fa-ban"></i> Out of Funds
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[0.65rem] text-zinc-500 max-w-[200px] leading-tight">
                                            Calculated by reserving ₹{reservedFunds}L for your {remainingSlots} remaining required slots.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-10 flex flex-col items-center justify-center text-center opacity-50">
                                <i className="fa-solid fa-gavel text-5xl mb-4"></i>
                                <h2 className="fredoka text-xl font-bold">Auction Paused</h2>
                                <p className="text-sm">Waiting for the auctioneer to draw the next player.</p>
                            </div>
                        )}
                    </div>

                    {/* My Squad */}
                    <div>
                        <h3 className="fredoka text-xl font-bold mb-4 flex items-center gap-2"><i className="fa-solid fa-users text-emerald-500"></i> My Squad</h3>
                        {team.players && team.players.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {team.players.map(p => (
                                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden shrink-0">
                                            {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user text-zinc-600 m-2.5"></i>}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-sm truncate">{p.name}</div>
                                            <div className="text-xs text-zinc-500">{p.category} • <span className="text-amber-400 font-bold">₹{p.sold_price}L</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-8 text-center text-zinc-500 font-bold text-sm">
                                You haven't bought any players yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COL: Strategy & Rivals */}
                <div className="space-y-6">
                    
                    {/* Checklist / Strategy */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                        <h3 className="fredoka text-lg font-bold mb-4 flex items-center gap-2"><i className="fa-solid fa-list-check text-amber-500"></i> Minimum Quotas</h3>
                        <div className="space-y-3">
                            {strategy.map((s, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-zinc-300">{s.category}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${s.fulfilled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {s.owned} / {s.required}
                                        </span>
                                        {s.fulfilled && <i className="fa-solid fa-check text-emerald-500 text-sm"></i>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rival Watch */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                        <h3 className="fredoka text-lg font-bold mb-4 flex items-center gap-2"><i className="fa-solid fa-eye text-blue-500"></i> Rival Watch</h3>
                        <div className="space-y-3">
                            {allTeams.filter(t => t.id !== teamId).map(t => (
                                <div key={t.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex justify-between items-center">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-3 h-3 rounded-sm shrink-0" style={{background: t.color || '#64748b'}}></div>
                                        <span className="font-bold text-sm truncate">{t.name}</span>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                        <div className="text-amber-400 font-bold text-sm">₹{t.remaining_budget}L</div>
                                        <div className="text-[0.65rem] text-zinc-500 font-bold">{t.players?.length || 0} players</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </main>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(<TeamApp />);
