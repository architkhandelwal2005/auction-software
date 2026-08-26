const { useState, useEffect, useRef, useCallback } = React;

// ═══════════════════════════════════════════════
// SOUND & VOICE ENGINE
// ═══════════════════════════════════════════════
const SFX = {
    bid: () => { try { const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(600,c.currentTime);o.frequency.exponentialRampToValueAtTime(1000,c.currentTime+0.08);g.gain.setValueAtTime(0.2,c.currentTime);g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+0.12);o.start();o.stop(c.currentTime+0.12); } catch(e){} },
    sold: () => { try { const c=new AudioContext();[523,659,784,1047].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=i<3?'sine':'triangle';o.frequency.setValueAtTime(f,c.currentTime+i*0.1);g.gain.setValueAtTime(0.2,c.currentTime+i*0.1);g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+i*0.1+0.4);o.start(c.currentTime+i*0.1);o.stop(c.currentTime+i*0.1+0.4);}); } catch(e){} },
    draw: () => { try { const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(300,c.currentTime);o.frequency.exponentialRampToValueAtTime(800,c.currentTime+0.25);g.gain.setValueAtTime(0.25,c.currentTime);g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+0.35);o.start();o.stop(c.currentTime+0.35); } catch(e){} },
    reveal: () => { try { const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(200,c.currentTime);o.frequency.exponentialRampToValueAtTime(400,c.currentTime+1.5);g.gain.setValueAtTime(0.15,c.currentTime);g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+2.5);o.start();o.stop(c.currentTime+2.5); } catch(e){} },
    click: () => { try { const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(1200,c.currentTime);g.gain.setValueAtTime(0.1,c.currentTime);g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+0.05);o.start();o.stop(c.currentTime+0.05); } catch(e){} },
    undo: () => { try { const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sawtooth';o.frequency.setValueAtTime(500,c.currentTime);o.frequency.exponentialRampToValueAtTime(200,c.currentTime+0.2);g.gain.setValueAtTime(0.1,c.currentTime);g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+0.2);o.start();o.stop(c.currentTime+0.2); } catch(e){} }
};

const speakCommentary = (text, enabled = true) => {
    if (!enabled || !window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.pitch = 1.0;
        window.speechSynthesis.speak(u);
    } catch(e) {}
};

// ═══════════════════════════════════════════════
// SHARED COMPONENTS (Dark Themed)
// ═══════════════════════════════════════════════
const TEAM_COLORS = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];
const PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6', '#ef4444', '#84cc16', '#a855f7', '#6366f1'];

// ═══════════════════════════════════════════════
// MORE MENU (Overflow Dropdown for Secondary Actions)
// ═══════════════════════════════════════════════
const MoreMenu = ({ items, className = "" }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    return (
        <div className={`relative ${className}`} ref={ref}>
            <button onClick={() => setOpen(!open)} className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 border ${open ? 'bg-zinc-800 text-white border-zinc-600' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800'}`}>
                <i className="fa-solid fa-ellipsis-vertical"></i>
                <span className="text-xs">More</span>
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60 py-2 z-50 anim-scaleIn origin-top-right">
                    {items.map((item, i) => item.divider ? (
                        <div key={i} className="border-t border-zinc-800 my-1.5"></div>
                    ) : (
                        <button key={i} onClick={() => { setOpen(false); item.onClick?.(); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-3 transition-colors ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}>
                            {item.icon && <i className={`fa-solid ${item.icon} w-4 text-center ${item.danger ? 'text-red-400' : 'text-zinc-500'}`}></i>}
                            <span>{item.label}</span>
                            {item.badge && <span className="ml-auto text-[0.6rem] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{item.badge}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const getCatColor = (category) => {
    if (!category) return '#64748b';
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
};

const SPORT_PRESETS = [
    { id: 'multi_age', name: '⭐ Multi-Sport with Age & Gender', desc: '38 All-Stars with Age (20-74), Gender, Role, Base Price, Experience', event_name: 'Superstars All-Star Auction 2026' },
    { id: 'football', name: '⚽ Football (Soccer)', desc: '24 Players: Forward, Midfielder, Defender, Goalkeeper, Winger', event_name: 'Super Football League 2026' },
    { id: 'basketball', name: '🏀 Basketball', desc: '16 Players: Point Guard, Shooting Guard, Small/Power Forward, Center', event_name: 'Pro Basketball Draft 2026' },
    { id: 'esports', name: '🎮 Esports / Gaming', desc: '16 Pros: Duelist, Initiator, Controller, Sentinel, IGL', event_name: 'Champions Esports Auction 2026' },
    { id: 'art', name: '🎨 Fine Art & Antiques', desc: '13 Rare Lots: Oil Painting, Sculpture, Vintage Watch, Rare Coin, Furniture', event_name: 'Grand Heritage Art & Antiques' },
    { id: 'cricket', name: '🏏 Cricket (100 Players)', desc: '100 Players: Batsman, Bowler, All-Rounder, Wicket-Keeper, 50+, Female', event_name: 'Premier Cricket League 2026' }
];

const SPORT_THEMES = {
    cricket: { id: 'cricket', name: 'Cricket', emoji: '🏏', accent: '#f59e0b', accentName: 'amber',
        bg: 'radial-gradient(ellipse at 50% 120%, #1a3a1a 0%, #0a1f0a 40%, #050d05 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(245,158,11,0.06) 0%, transparent 60%)',
        cardStyle: 'trading_card' },
    football: { id: 'football', name: 'Football', emoji: '⚽', accent: '#22c55e', accentName: 'green',
        bg: 'radial-gradient(ellipse at 50% 120%, #0a2e0a 0%, #061a06 40%, #030d03 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(34,197,94,0.06) 0%, transparent 60%)',
        cardStyle: 'broadcast_banner' },
    badminton: { id: 'badminton', name: 'Badminton', emoji: '🏸', accent: '#3b82f6', accentName: 'blue',
        bg: 'radial-gradient(ellipse at 50% 120%, #0a1a3a 0%, #060f2a 40%, #030818 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.06) 0%, transparent 60%)',
        cardStyle: 'spotlight' },
    pickleball: { id: 'pickleball', name: 'Pickleball', emoji: '🏓', accent: '#14b8a6', accentName: 'teal',
        bg: 'radial-gradient(ellipse at 50% 120%, #0a2a2a 0%, #061a1a 40%, #030d0d 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(20,184,166,0.06) 0%, transparent 60%)',
        cardStyle: 'spotlight' },
    basketball: { id: 'basketball', name: 'Basketball', emoji: '🏀', accent: '#f97316', accentName: 'orange',
        bg: 'radial-gradient(ellipse at 50% 120%, #2a1a0a 0%, #1a0f06 40%, #0d0803 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(249,115,22,0.06) 0%, transparent 60%)',
        cardStyle: 'trading_card' },
    esports: { id: 'esports', name: 'Esports', emoji: '🎮', accent: '#a855f7', accentName: 'purple',
        bg: 'radial-gradient(ellipse at 50% 120%, #1a0a2e 0%, #0f061a 40%, #08030d 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(168,85,247,0.06) 0%, transparent 60%)',
        cardStyle: 'broadcast_banner' },
    art: { id: 'art', name: 'Art & Antiques', emoji: '🎨', accent: '#ef4444', accentName: 'red',
        bg: 'radial-gradient(ellipse at 50% 120%, #2a0a0a 0%, #1a0606 40%, #0d0303 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(239,68,68,0.06) 0%, transparent 60%)',
        cardStyle: 'spotlight' },
    multi_sport: { id: 'multi_sport', name: 'Multi-Sport / General', emoji: '⭐', accent: '#f59e0b', accentName: 'amber',
        bg: 'linear-gradient(135deg, #070b14 0%, #0f172a 50%, #070b14 100%)',
        overlay: 'radial-gradient(circle at 50% 0%, rgba(245,158,11,0.04) 0%, transparent 60%)',
        cardStyle: 'spotlight' },
};

const PresetsModal = ({ onLoadPreset, onClose }) => {
    const [loadingId, setLoadingId] = useState(null);
    const handleSelect = async (presetId) => {
        setLoadingId(presetId);
        await onLoadPreset(presetId);
        setLoadingId(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md anim-scaleIn" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xl shadow-2xl space-y-4" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center text-lg"><i className="fa-solid fa-bolt"></i></div>
                        <div>
                            <h3 className="fredoka text-lg font-bold text-white">Multi-Sport & Domain Presets</h3>
                            <p className="text-xs text-slate-400">Load test data from Excel to test auto-category creation</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                    {SPORT_PRESETS.map(p => (
                        <button
                            key={p.id}
                            onClick={()=>handleSelect(p.id)}
                            disabled={loadingId === p.id}
                            className="w-full text-left bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/50 p-4 rounded-2xl transition flex items-center justify-between group"
                        >
                            <div>
                                <div className="font-bold text-white text-sm group-hover:text-blue-400 flex items-center gap-2">
                                    {p.name}
                                    <span className="text-[0.65rem] bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">{p.event_name}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{p.desc}</p>
                            </div>
                            <div className="shrink-0 text-slate-500 group-hover:text-blue-400 text-sm">
                                {loadingId === p.id ? <i className="fa-solid fa-spinner animate-spin text-blue-400"></i> : <i className="fa-solid fa-arrow-right"></i>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const PlayerPhoto = ({ url, name, size = 44 }) => {
    const [imgError, setImgError] = useState(false);
    useEffect(() => { setImgError(false); }, [url]);
    const initials = (name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316'];
    const bg = colors[(name||'').charCodeAt(0)%colors.length];
    if (url && !imgError) {
        return <img src={url} alt={name} onError={()=>setImgError(true)} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'2.5px solid rgba(255,255,255,0.2)',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}} />;
    }
    return <div style={{width:size,height:size,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:size*0.35,border:'2.5px solid rgba(255,255,255,0.2)',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}}>{initials}</div>;
};

const CatBadge = ({ category }) => {
    const color = getCatColor(category);
    return <span className="text-[0.65rem] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm" style={{background:color+'25',color:color,border:`1px solid ${color}55`}}>{category || 'General'}</span>;
};

const PlayerAttributesBadges = ({ attributes, max = 5, className = "" }) => {
    if (!attributes || typeof attributes !== 'object') return null;
    const entries = Object.entries(attributes).filter(([k, v]) => {
        if (v === null || v === undefined || String(v).trim() === '') return false;
        const kl = k.toLowerCase();
        return !['name', 'photo', 'id', 'category', 'base_price', 'photo_url', 'team_id', 'sold_price', 'status', 'sold_at'].includes(kl);
    });
    if (entries.length === 0) return null;

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {entries.slice(0, max).map(([key, val]) => (
                <span key={key} className="text-[0.65rem] bg-slate-950/80 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shadow-sm">
                    <span className="text-slate-500 font-bold uppercase text-[0.55rem]">{key}:</span>
                    <span className="text-white font-bold">{String(val)}</span>
                </span>
            ))}
        </div>
    );
};

const Confetti = ({ show }) => {
    if (!show) return null;
    return <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
        {Array.from({length:45},(_,i)=>({left:Math.random()*100,delay:Math.random()*0.6,color:['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#38bdf8'][i%8],size:6+Math.random()*10})).map((p,i)=>
            <div key={i} className="absolute" style={{left:`${p.left}%`,top:'-20px',width:p.size,height:p.size,background:p.color,borderRadius:Math.random()>0.5?'50%':'3px',animation:`confettiFall ${1.4+Math.random()}s ease-in ${p.delay}s forwards`}} />
        )}
    </div>;
};

// ═══════════════════════════════════════════════
// SPIN WHEEL (Faster 3.5s Spin Duration)
// ═══════════════════════════════════════════════
const SpinWheel = ({ items, title, onSelect, onClose }) => {
    const [selected, setSelected] = useState(items.map(i=>i.id));
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [winner, setWinner] = useState(null);
    const canvasRef = useRef(null);
    const active = items.filter(i=>selected.includes(i.id));

    const toggle = id => {
        if(spinning) return;
        if(selected.includes(id)){if(selected.length>2)setSelected(selected.filter(i=>i!==id));}
        else setSelected([...selected,id]);
    };

    useEffect(()=>{
        const cv=canvasRef.current; if(!cv||active.length<2) return;
        const ctx=cv.getContext('2d'),sz=cv.width,ctr=sz/2,r=ctr-8,n=active.length,a=2*Math.PI/n;
        ctx.clearRect(0,0,sz,sz);
        active.forEach((item,i)=>{
            const start=i*a-Math.PI/2,end=start+a;
            ctx.beginPath();ctx.moveTo(ctr,ctr);ctx.arc(ctr,ctr,r,start,end);ctx.closePath();
            const hue=(i*360/n+15)%360;
            ctx.fillStyle=`hsl(${hue},75%,50%)`;ctx.fill();
            ctx.strokeStyle='#0f172a';ctx.lineWidth=2.5;ctx.stroke();
            ctx.save();ctx.translate(ctr,ctr);ctx.rotate(start+a/2);
            ctx.textAlign='right';ctx.fillStyle='white';ctx.font=`bold ${Math.min(14,280/n)}px Fredoka`;
            ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=4;
            ctx.fillText((item.name||'').substring(0,11),r-12,5);ctx.restore();
        });
        ctx.beginPath();ctx.arc(ctr,ctr,22,0,Math.PI*2);ctx.fillStyle='#0f172a';ctx.fill();
        ctx.strokeStyle='#3b82f6';ctx.lineWidth=3;ctx.stroke();
    },[active]);

    // Reduced by 2 seconds: from 5.5s down to 3.5s
    const spin = () => {
        if(spinning||active.length<2) return;
        SFX.click(); setSpinning(true); setWinner(null);
        const n=active.length,sa=360/n,wi=Math.floor(Math.random()*n),w=active[wi];
        const target=360-(wi*sa)-sa/2;
        const total=rotation+(360*(4+Math.random()*2))+target;
        setRotation(total);
        setTimeout(()=>{setSpinning(false);setWinner(w);SFX.sold();}, 3500);
    };

    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md anim-scaleIn">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 md:p-8 max-w-4xl w-full flex gap-5 md:p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] max-h-[90vh]">
            <div className="flex-1 flex flex-col items-center justify-center">
                <h2 className="fredoka text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <i className="fa-solid fa-dharmachakra text-yellow-400"></i> {title}
                </h2>
                <div className="relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-red-500 drop-shadow-xl"></div>
                    <div className="rounded-full shadow-2xl border-4 border-slate-800" style={{width:300,height:300,transform:`rotate(${rotation}deg)`,transition:spinning?'transform 3.5s cubic-bezier(0.15,0.85,0.15,1)':'none',animation:spinning?'':'spinPulse 2s infinite'}}>
                        <canvas ref={canvasRef} width={300} height={300} className="w-full h-full rounded-full" />
                    </div>
                </div>
                {winner ? (
                    <div className="mt-6 text-center anim-bounceIn">
                        <p className="text-xs text-yellow-400 font-extrabold uppercase tracking-widest mb-1">Winner Selected!</p>
                        <p className="fredoka text-3xl font-bold text-white mb-4">{winner.name}</p>
                        <button onClick={()=>onSelect(winner)} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-8 py-3 rounded-full fredoka font-bold text-lg hover:scale-105 transition shadow-lg shadow-green-500/25">✓ Confirm Selection</button>
                    </div>
                ) : (
                    <button onClick={spin} disabled={spinning||active.length<2} className={`mt-6 px-12 py-4 rounded-full fredoka font-bold text-xl transition-all ${spinning?'bg-slate-800 text-slate-500 cursor-wait':'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black hover:scale-105 shadow-xl shadow-yellow-500/20'}`}>
                        {spinning?'Spinning Fast (3.5s)... 🎰':'🎰 SPIN THE WHEEL!'}
                    </button>
                )}
            </div>
            <div className="w-64 bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex flex-col max-h-[75vh]">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Include ({active.length})</span>
                    <button onClick={onClose} disabled={spinning} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {items.map(item=><label key={item.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer text-xs transition ${selected.includes(item.id)?'bg-blue-500/15 border border-blue-500/40 text-white':'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-850'}`}>
                        <input type="checkbox" className="w-4 h-4 rounded accent-blue-500" checked={selected.includes(item.id)} onChange={()=>toggle(item.id)} disabled={spinning} />
                        <span className="font-bold truncate">{item.name}</span>
                    </label>)}
                </div>
            </div>
        </div>
    </div>;
};

// ═══════════════════════════════════════════════
// TEAM ROSTER MODAL (Dark Themed)
// ═══════════════════════════════════════════════
const TeamRosterModal = ({ team, onClose }) => {
    if(!team) return null;
    const pct=Math.max(0,Math.min(100,(team.remaining_budget/team.total_budget)*100));
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md anim-scaleIn" onClick={onClose}>
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-7 max-w-lg w-full shadow-2xl space-y-5" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-start pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white fredoka font-bold text-xl shadow-lg" style={{background:team.color||'#3b82f6'}}>
                        {team.logo_url ? <img src={team.logo_url} className="w-10 h-10 object-contain" /> : team.name[0]}
                    </div>
                    <div>
                        <h2 className="fredoka text-2xl font-bold text-white">{team.name}</h2>
                        <p className="text-xs text-slate-400 font-bold">{team.player_count||0} players acquired • ₹{(team.total_budget-team.remaining_budget).toFixed(1)}L spent</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            {/* Budget */}
            <div className="bg-slate-950 rounded-2xl p-4 text-center border border-slate-800">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Remaining Purse</p>
                <p className={`fredoka text-4xl font-bold ${pct>20?'text-green-400':'text-red-400'}`}>₹{team.remaining_budget}L</p>
                <div className="bg-slate-800 rounded-full h-2.5 mt-2.5 overflow-hidden"><div className={`h-full rounded-full transition-all ${pct>50?'bg-green-400':pct>20?'bg-yellow-400':'bg-red-400'}`} style={{width:`${pct}%`}}></div></div>
            </div>
            
            {/* Team Analytics Breakdown */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 mt-3">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Team Analytics</p>
                {(() => {
                    const spent = team.total_budget - team.remaining_budget;
                    if (spent <= 0 || !team.players || team.players.length === 0) return <div className="text-xs text-slate-500 text-center py-2">No purchases yet.</div>;
                    
                    const catSpent = {};
                    team.players.forEach(p => {
                        const c = p.category || 'Uncategorized';
                        catSpent[c] = (catSpent[c] || 0) + p.sold_price;
                    });
                    
                    const sorted = Object.keys(catSpent).sort((a,b) => catSpent[b] - catSpent[a]);
                    
                    return (
                        <div className="space-y-3">
                            <div className="w-full h-3 rounded-full flex overflow-hidden border border-slate-800 bg-slate-900">
                                {sorted.map((c, i) => {
                                    const p = (catSpent[c] / spent) * 100;
                                    const col = getCatColor(c);
                                    return <div key={i} title={`${c}: ${catSpent[c]}L (${p.toFixed(1)}%)`} style={{width: `${p}%`, background: col}}></div>;
                                })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {sorted.map((c, i) => {
                                    const p = (catSpent[c] / spent) * 100;
                                    const col = getCatColor(c);
                                    return (
                                        <div key={i} className="flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-300">
                                            <div className="w-2.5 h-2.5 rounded-[2px]" style={{background: col}}></div>
                                            {c} ({p.toFixed(0)}%)
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>
            {/* Fulfillment */}

            {team.fulfillment && team.fulfillment.length>0 && <div>
                <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2">Category Requirements</p>
                <div className="flex flex-wrap gap-2">
                    {team.fulfillment.map((f,i)=><span key={i} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${f.met?'bg-green-500/20 text-green-400 border-green-500/30':'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>{f.category}: {f.have}/{f.min} {f.met?'✅':'⚠️'}</span>)}
                </div>
            </div>}
            {/* Players */}
            <div className="border-t border-slate-800 pt-4">
                <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2.5">Squad Roster</p>
                {(!team.players||team.players.length===0)?<div className="text-center py-6 text-slate-500"><p className="text-3xl mb-1">🏏</p><p className="font-bold text-sm">No players acquired yet</p></div>
                :<div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {team.players.map(p=><div key={p.id} className="flex items-center gap-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                        <PlayerPhoto url={p.photo_url} name={p.name} size={36} />
                        <div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{p.name}</div>{p.category&&<CatBadge category={p.category}/>}</div>
                        <span className="fredoka font-bold text-green-400 text-sm">₹{p.sold_price}L</span>
                    </div>)}
                </div>}
            </div>
            {/* Shareable link */}
            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-link text-blue-400 text-sm"></i>
                <input readOnly value={`${window.location.origin}/team/${team.id}`} className="flex-1 bg-slate-950 border border-slate-700 text-blue-400 px-3 py-2 rounded-xl text-xs font-bold" onClick={e=>{e.target.select();navigator.clipboard?.writeText(e.target.value);}} />
                <span className="text-xs text-slate-400 font-bold">Copy</span>
            </div>
        </div>
    </div>;
};

// ═══════════════════════════════════════════════
// SHARE MODAL (Dark Themed)
// ═══════════════════════════════════════════════
const ShareModal = ({ teams, onClose }) => {
    const [copied, setCopied] = useState('');
    const origin = window.location.origin;
    const copy = (url, key) => {
        navigator.clipboard?.writeText(url);
        setCopied(key);
        setTimeout(() => setCopied(''), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md anim-scaleIn" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-7 max-w-xl w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-lg">🔗</div>
                        <div>
                            <h3 className="fredoka text-xl font-bold text-white">Shareable Auction Links</h3>
                            <p className="text-xs text-slate-400 font-bold">Send to team captains or display on projector screens</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                </div>

                <div className="space-y-3">
                    {/* Global Live Screen */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-blue-500/30">
                        <div className="flex justify-between items-center mb-1">
                            <span className="fredoka font-bold text-blue-400 text-sm flex items-center gap-2">
                                📺 Global Live Spectator Screen (Projector / Audience)
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">View-only live feed of the whole auction, sold list, and pool</p>
                        <div className="flex flex-wrap gap-2">
                            <input readOnly value={`${origin}/live`} className="flex-1 bg-slate-900 border border-slate-700 text-blue-300 px-3 py-1.5 rounded-xl text-xs font-bold" />
                            <button onClick={() => copy(`${origin}/live`, 'live')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-sm">
                                {copied === 'live' ? '✓ Copied!' : 'Copy'}
                            </button>
                            <a href="/live" target="_blank" className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center">
                                Open ↗
                            </a>
                        </div>
                    </div>

                    {/* Official Report */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30">
                        <span className="fredoka font-bold text-emerald-400 text-sm flex items-center gap-2 mb-1">
                            🖨️ Printable Official Report & Balance Sheet
                        </span>
                        <div className="flex gap-2 mt-2">
                            <input readOnly value={`${origin}/report`} className="flex-1 bg-slate-900 border border-slate-700 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold" />
                            <button onClick={() => copy(`${origin}/report`, 'report')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-sm">
                                {copied === 'report' ? '✓ Copied!' : 'Copy'}
                            </button>
                            <a href="/report" target="_blank" className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center">
                                Open ↗
                            </a>
                        </div>
                    </div>

                    {/* Team Portals */}
                    <div>
                        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Team-Specific Portals</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {teams.map(t => (
                                <div key={t.id} className="flex items-center gap-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-xs" style={{ background: t.color || '#3b82f6' }}>
                                        {t.name[0]}
                                    </div>
                                    <span className="font-bold text-slate-300 text-xs flex-1 truncate">{t.name}</span>
                                    <button onClick={() => copy(`${origin}/team/${t.id}`, `team-${t.id}`)} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg text-xs font-bold transition">
                                        {copied === `team-${t.id}` ? '✓ Copied' : 'Copy'}
                                    </button>
                                    <a href={`/team/${t.id}`} target="_blank" className="text-blue-400 hover:text-blue-300 text-xs font-bold px-1">
                                        ↗
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════
// SETUP WIZARD (Dark Themed)
// ═══════════════════════════════════════════════
const SetupWizard = ({ onComplete }) => {
    const [step, setStep] = useState(1);

    // Step 1
    const [eventName, setEventName] = useState('Society Auction 2026');
    const [sportTheme, setSportTheme] = useState('multi_sport');
    const [bidIncrement, setBidIncrement] = useState(5);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadedCount, setUploadedCount] = useState(0);

    // Step 2
    const [numTeams, setNumTeams] = useState(4);
    const [numSplits, setNumSplits] = useState(3);
    const [basePrice, setBasePrice] = useState(50);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analyzeError, setAnalyzeError] = useState('');
    const [flexPolicy, setFlexPolicy] = useState('allow_flex');

    // Step 3
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState('');

    // Step 4
    const [teams, setTeams] = useState([]);
    const [newTeamName, setNewTeamName] = useState('');
    const [defaultBudget, setDefaultBudget] = useState(1000);

    const updateCat = (i, field, val) => {
        const c = [...categories];
        c[i] = { ...c[i], [field]: field === 'category' ? val : (parseFloat(val) || 0) };
        setCategories(c);
    };
    const removeCategory = (i) => setCategories(categories.filter((_, idx) => idx !== i));
    const handleFlexPolicyChange = (policy) => {
        setFlexPolicy(policy);
        setCategories(prev => prev.map(c => ({
            ...c,
            per_team_max: policy === 'allow_flex' 
                ? (c.is_exact ? c.per_team_min : c.per_team_min + 1)
                : c.per_team_min
        })));
    };

    const addCustomCategory = () => {
        if (!newCat.trim()) return;
        setCategories([...categories, { category: newCat.trim(), base_price: basePrice, per_team_min: 1, per_team_max: 99, color: '#6366f1', auto: false }]);
        setNewCat('');
    };
    const addTeam = () => {
        if (!newTeamName.trim()) return;
        setTeams([...teams, { name: newTeamName.trim(), total_budget: defaultBudget, color: TEAM_COLORS[teams.length % TEAM_COLORS.length] }]);
        setNewTeamName('');
    };
    const removeTeam = (i) => setTeams(teams.filter((_, idx) => idx !== i));

    const handleWizardUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        setUploadedFileName(file.name);
        setUploadedFile(file);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('/api/players/import', { method: 'POST', body: fd });
            const d = await res.json();
            if (d.success) {
                setUploadedCount(d.count);
                setAnalysisResult(null); // reset analysis when new file uploaded
            } else {
                alert(d.error || 'Upload failed');
                setUploadedFile(null);
                setUploadedFileName('');
            }
        } catch (err) { alert('Upload failed: ' + err); }
        setUploading(false);
        e.target.value = null;
    };

    const runAnalysis = async () => {
        if (!uploadedFile) {
            setAnalyzeError('Please upload a player file in Step 1 first.');
            return;
        }
        setAnalyzing(true);
        setAnalyzeError('');
        try {
            const fd = new FormData();
            fd.append('file', uploadedFile);
            fd.append('num_teams', numTeams);
            fd.append('num_splits', numSplits);
            fd.append('base_price', basePrice);
            const res = await fetch('/api/file/smart_analyze', { method: 'POST', body: fd });
            const d = await res.json();
            if (d.success) {
                setAnalysisResult(d);
                setCategories(d.suggestions.map(s => ({
                    category: s.category,
                    base_price: basePrice,
                    per_team_min: s.per_team_min,
                    per_team_max: s.per_team_max || 99,
                    color: s.color,
                    auto: true,
                    count: s.count,
                    description: s.description,
                })));
                if (teams.length === 0) {
                    setTeams(Array.from({ length: numTeams }, (_, i) => ({
                        name: `Team ${i + 1}`,
                        total_budget: defaultBudget,
                        color: TEAM_COLORS[i % TEAM_COLORS.length],
                    })));
                }
            } else {
                setAnalyzeError(d.error || 'Analysis failed');
            }
        } catch (err) { setAnalyzeError('Error: ' + err); }
        setAnalyzing(false);
    };

    const finish = async () => {
        await fetch('/api/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                config: { event_name: eventName, bid_increment: bidIncrement, common_base_price: basePrice, setup_done: 'true', sport_theme: sportTheme },
                category_rules: categories.map(c => ({
                    category: c.category, base_price: basePrice,
                    min_per_team: c.per_team_min, max_per_team: c.per_team_max || 99,
                })),
            })
        });
        for (const t of teams) {
            await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
        }
        onComplete();
    };

    const stepMeta = [
        { label: 'Event & Players', icon: 'fa-file-excel', color: 'from-purple-500 to-indigo-600' },
        { label: 'Teams & Analysis', icon: 'fa-wand-magic-sparkles', color: 'from-blue-500 to-cyan-600' },
        { label: 'Category Rules', icon: 'fa-list-check', color: 'from-amber-500 to-orange-500' },
        { label: 'Team Names', icon: 'fa-shield-halved', color: 'from-green-500 to-emerald-600' },
    ];

    const canNext1 = eventName.trim().length > 0;
    const canNext2 = analysisResult !== null;
    const canNext3 = categories.length > 0;
    const canFinish = teams.length >= 2;

    return <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.9)] w-full w-full max-w-2xl mx-4 overflow-hidden">

            {/* Header */}
            <div className="bg-zinc-950 px-5 py-4 md:px-8 md:py-5 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">🔨</div>
                        <div>
                            <h1 className="fredoka text-xl font-bold text-white">Auction Setup</h1>
                            <p className="text-[0.65rem] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <i className={`fa-solid ${stepMeta[step-1].icon}`}></i> {stepMeta[step-1].label}
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-extrabold text-zinc-400 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">Step {step} / 4</span>
                </div>
                <div className="flex gap-1.5">
                    {stepMeta.map((s, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < step ? `bg-gradient-to-r ${s.color}` : 'bg-zinc-800'}`} />
                    ))}
                </div>
            </div>

            <div className="p-5 md:p-8">

                {/* ── STEP 1: Event Config + Upload ── */}
                {step === 1 && <div className="space-y-5 anim-slideUp">
                    <div>
                        <h2 className="fredoka text-xl font-bold text-white mb-1">Event & Player List</h2>
                        <p className="text-zinc-400 text-xs">Name your event and upload the Excel/CSV of all players</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="col-span-2">
                            {/* Sport / Theme Selector */}
                            <div className="mb-6">
                                <label className="text-sm font-bold text-slate-300 mb-2 block">Sport / Theme</label>
                                <p className="text-xs text-slate-500 mb-3">Choose a sport to set the auction stage theme, background, and player card style.</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.values(SPORT_THEMES).map(theme => (
                                        <button key={theme.id} type="button" onClick={() => setSportTheme(theme.id)}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
                                                sportTheme === theme.id 
                                                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10' 
                                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/80'
                                            }`}>
                                            <span className="text-2xl">{theme.emoji}</span>
                                            <span className={`text-xs font-bold ${sportTheme === theme.id ? 'text-amber-300' : 'text-slate-400'}`}>{theme.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider block mb-1.5">Event Name</label>
                            <input type="text" className="w-full bg-zinc-950 border border-zinc-700 p-3 rounded-2xl text-base font-bold text-white focus:border-amber-500 outline-none transition" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Greenpark Colony Auction 2026" />
                        </div>
                        <div>
                            <label className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider block mb-1.5">Bid Increment (L)</label>
                            <input type="number" className="w-full bg-zinc-950 border border-zinc-700 p-3 rounded-2xl font-bold text-white focus:border-amber-500 outline-none transition" value={bidIncrement} onChange={e => setBidIncrement(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                            <label className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider block mb-1.5">Base Price — everyone (L)</label>
                            <input type="number" className="w-full bg-zinc-950 border border-zinc-700 p-3 rounded-2xl font-bold text-white focus:border-amber-500 outline-none transition" value={basePrice} onChange={e => setBasePrice(parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>

                    {uploadedCount > 0 ? (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500/15 rounded-xl flex items-center justify-center text-green-400 text-xl shrink-0">✅</div>
                            <div className="flex-1">
                                <div className="font-bold text-green-400 text-sm">{uploadedFileName}</div>
                                <div className="text-xs text-zinc-400">{uploadedCount} players imported — proceed to Step 2 →</div>
                            </div>
                            <label className="text-xs text-zinc-500 hover:text-white cursor-pointer underline shrink-0">
                                Re-upload <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleWizardUpload} />
                            </label>
                        </div>
                    ) : (
                        <label className={`flex flex-col items-center gap-3 p-5 md:p-8 rounded-2xl border-2 border-dashed cursor-pointer transition ${uploading ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-700 hover:border-amber-500/40 hover:bg-amber-500/5'}`}>
                            {uploading
                                ? <><i className="fa-solid fa-spinner animate-spin text-3xl text-amber-400"></i><span className="text-zinc-400 text-sm font-bold">Uploading & importing players...</span></>
                                : <><i className="fa-solid fa-file-excel text-3xl text-green-400"></i>
                                    <div className="text-center">
                                        <div className="font-bold text-white text-sm">Click to upload Excel or CSV</div>
                                        <div className="text-xs text-zinc-500 mt-1">Columns: Name, Age, Gender + any extra info (Role, Building, etc.)</div>
                                    </div></>}
                            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleWizardUpload} />
                        </label>
                    )}

                    <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800 text-xs space-y-1">
                        <div className="font-extrabold text-zinc-300 mb-2">📁 Sample files in <code className="text-amber-400">sample_data\</code> folder:</div>
                        {[['sample_society.xlsx','40 players — Residential Society'],['sample_club.xlsx','80 players — Sports Club'],['sample_colony.xlsx','120 players — Colony Event']].map(([f,d])=>
                            <div key={f}>• <span className="text-white font-bold">{f}</span> <span className="text-zinc-500">— {d}</span></div>)}
                    </div>
                </div>}

                {/* ── STEP 2: Teams + Smart Analysis ── */}
                {step === 2 && <div className="space-y-5 anim-slideUp">
                    <div>
                        <h2 className="fredoka text-xl font-bold text-white mb-1">Team Count & Smart Split</h2>
                        <p className="text-zinc-400 text-xs">Choose the number of teams and how finely to split age groups — then run the analysis</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider block mb-2">Number of Teams</label>
                            <input type="number" min="2" max="20" className="w-full bg-zinc-950 border border-zinc-700 p-4 rounded-2xl text-3xl font-bold text-white text-center focus:border-amber-500 outline-none transition fredoka" value={numTeams} onChange={e => { setNumTeams(parseInt(e.target.value)||2); setAnalysisResult(null); }} />
                        </div>
                        <div>
                            <label className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider block mb-2">Age Groups per Gender</label>
                            <div className="flex flex-wrap gap-2">
                                {[2, 3, 4].map(n => (
                                    <button key={n} onClick={() => { setNumSplits(n); setAnalysisResult(null); }}
                                        className={`flex-1 p-4 rounded-2xl fredoka text-2xl font-bold transition border-2 ${numSplits === n ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[0.6rem] text-zinc-600 mt-1.5 text-center">e.g. 3 = Young / Mid / Senior</p>
                        </div>
                    </div>

                    <button onClick={runAnalysis} disabled={analyzing || !uploadedFile}
                        className={`w-full py-4 rounded-2xl font-extrabold text-sm transition flex items-center justify-center gap-2 ${analyzing || !uploadedFile ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/20 hover:scale-[1.02]'}`}>
                        {analyzing ? <><i className="fa-solid fa-spinner animate-spin"></i> Analysing {uploadedCount} players...</>
                            : <><i className="fa-solid fa-wand-magic-sparkles"></i> Run Smart Analysis — {uploadedCount} players, {numTeams} teams, {numSplits}-way age split</>}
                    </button>

                    {analyzeError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs font-bold">{analyzeError}</div>}

                    {analysisResult && <div className="space-y-3">
                        {analysisResult.is_perfect_division ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-left">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-base">
                                    <i className="fa-solid fa-circle-check"></i>
                                </div>
                                <div>
                                    <h3 className="fredoka text-emerald-400 font-bold text-sm">100% Perfect Equal Division</h3>
                                    <p className="text-zinc-300 text-xs">All {analysisResult.suggestions.length} categories divide equally across all {numTeams} teams with 0 remainders.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 text-base">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="fredoka text-amber-400 font-bold text-sm">{analysisResult.unequal_prompt.title}</h3>
                                        <p className="text-zinc-300 text-xs mt-0.5">{analysisResult.unequal_prompt.summary}</p>
                                        <p className="text-[0.68rem] text-zinc-400 mt-1">{analysisResult.unequal_prompt.details}</p>
                                    </div>
                                </div>

                                <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-800 space-y-2">
                                    <div className="text-[0.65rem] font-extrabold uppercase tracking-wider text-zinc-400">Policy for Unequal Extra Players:</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button type="button" onClick={() => handleFlexPolicyChange('allow_flex')}
                                            className={`p-2.5 rounded-xl text-left border transition ${flexPolicy === 'allow_flex' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                                            <div className="flex items-center gap-2 font-bold text-xs">
                                                <i className={`fa-solid ${flexPolicy === 'allow_flex' ? 'fa-circle-dot text-amber-400' : 'fa-circle text-zinc-600'}`}></i>
                                                <span>Allow 1 Flex Slot (Recommended)</span>
                                            </div>
                                            <div className="text-[0.62rem] text-zinc-400 mt-1 pl-5 leading-tight">
                                                Allows teams to buy 1 extra player in remainder categories so no players go unsold.
                                            </div>
                                        </button>

                                        <button type="button" onClick={() => handleFlexPolicyChange('strict_min')}
                                            className={`p-2.5 rounded-xl text-left border transition ${flexPolicy === 'strict_min' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                                            <div className="flex items-center gap-2 font-bold text-xs">
                                                <i className={`fa-solid ${flexPolicy === 'strict_min' ? 'fa-circle-dot text-amber-400' : 'fa-circle text-zinc-600'}`}></i>
                                                <span>Strict Equal Minima Only</span>
                                            </div>
                                            <div className="text-[0.62rem] text-zinc-400 mt-1 pl-5 leading-tight">
                                                Every team gets exact equal quotas. Leftovers remain in the unallocated pool.
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 divide-y divide-zinc-800/80 overflow-hidden max-h-52 overflow-y-auto custom-scrollbar">
                            {analysisResult.suggestions.map((s, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }}></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-xs truncate">{s.category}</span>
                                            {s.is_exact ? (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[0.55rem] font-bold">Exact</span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[0.55rem] font-bold">Flex (+{s.remainder})</span>
                                            )}
                                        </div>
                                        <div className="text-[0.6rem] text-zinc-500 truncate mt-0.5">{s.description}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs font-extrabold text-amber-400">
                                            {s.is_exact || flexPolicy === 'strict_min' ? `${s.per_team_min}/team` : `${s.per_team_min}–${s.per_team_max}/team`}
                                        </div>
                                        <div className="text-[0.55rem] text-zinc-600">{s.count} total</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>}
                </div>}

                {/* ── STEP 3: Edit Categories ── */}
                {step === 3 && <div className="space-y-4 anim-slideUp">
                    <div>
                        <h2 className="fredoka text-xl font-bold text-white mb-1">Review Category Rules</h2>
                        <p className="text-zinc-400 text-xs">Edit minimum players per team for each category. All base prices are ₹{basePrice}L (uniform).</p>
                    </div>

                    <div className="grid grid-cols-[1fr_50px_50px_20px] md:grid-cols-[1fr_60px_60px_24px] gap-2 px-1 text-[0.6rem] font-extrabold text-zinc-500 uppercase tracking-widest">
                        <span>Category</span><span className="text-center">Min/Team</span><span className="text-center">Max/Team</span><span></span>
                    </div>

                    <div className="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                        {categories.map((cat, i) => (
                            <div key={i} className="grid grid-cols-[1fr_50px_50px_20px] md:grid-cols-[1fr_60px_60px_24px] gap-2 items-center bg-zinc-950 rounded-xl px-3 py-2.5 border border-zinc-800">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2 h-5 rounded-full shrink-0" style={{ background: cat.color || '#64748b' }}></div>
                                    <div className="flex-1 min-w-0">
                                        <input type="text" className="font-bold text-white bg-transparent border-b border-transparent focus:border-amber-500 outline-none text-xs w-full truncate" value={cat.category} onChange={e => updateCat(i, 'category', e.target.value)} />
                                        {cat.is_exact ? (
                                            <div className="text-[0.55rem] font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                                                <i className="fa-solid fa-check text-[0.5rem]"></i> Exact ({cat.per_team_min}/team • {cat.count || 0} total)
                                            </div>
                                        ) : (
                                            <div className="text-[0.55rem] font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                                                <i className="fa-solid fa-triangle-exclamation text-[0.5rem]"></i> Flex ({cat.per_team_min}–{cat.per_team_max}/team • +{cat.remainder || 0} extra)
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <input type="number" min="0" className="bg-zinc-900 border border-zinc-700 rounded-lg py-1 text-xs font-bold text-amber-400 text-center outline-none focus:border-amber-500 w-full" value={cat.per_team_min} onChange={e => updateCat(i, 'per_team_min', e.target.value)} />
                                <input type="number" min="0" className="bg-zinc-900 border border-zinc-700 rounded-lg py-1 text-xs font-bold text-zinc-300 text-center outline-none focus:border-amber-500 w-full" value={cat.per_team_max} onChange={e => updateCat(i, 'per_team_max', e.target.value)} />
                                <button onClick={() => removeCategory(i)} className="text-zinc-700 hover:text-red-400 transition flex items-center justify-center"><i className="fa-solid fa-xmark text-xs"></i></button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <input type="text" placeholder="Add custom category..." className="flex-1 bg-zinc-950 border border-zinc-700 p-3 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none transition" value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomCategory()} />
                        <button onClick={addCustomCategory} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl font-bold transition text-sm"><i className="fa-solid fa-plus"></i></button>
                    </div>
                </div>}

                {/* ── STEP 4: Team Names ── */}
                {step === 4 && <div className="space-y-5 anim-slideUp">
                    <div>
                        <h2 className="fredoka text-xl font-bold text-white mb-1">Name Your Teams</h2>
                        <p className="text-zinc-400 text-xs">Edit team names and set the starting budget for each franchise</p>
                    </div>

                    <div>
                        <label className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider block mb-1.5">Starting Budget per Team (Lakhs)</label>
                        <input type="number" className="w-full bg-zinc-950 border border-zinc-700 p-3.5 rounded-2xl text-xl font-bold text-white text-center focus:border-green-500 outline-none transition fredoka" value={defaultBudget} onChange={e => setDefaultBudget(parseFloat(e.target.value) || 0)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                        {teams.map((t, i) => (
                            <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center gap-2.5 group">
                                <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-xs" style={{ background: t.color }}>{(t.name||'T')[0]}</div>
                                <input type="text" className="flex-1 bg-transparent font-bold text-white text-xs outline-none border-b border-transparent focus:border-amber-500 min-w-0" value={t.name} onChange={e => { const n=[...teams]; n[i]={...n[i],name:e.target.value}; setTeams(n); }} />
                                <button onClick={() => removeTeam(i)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition shrink-0"><i className="fa-solid fa-xmark text-xs"></i></button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <input type="text" placeholder="Add another team..." className="flex-1 bg-zinc-950 border border-zinc-700 p-3 rounded-xl text-xs font-bold text-white focus:border-green-500 outline-none transition" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTeam()} />
                        <button onClick={addTeam} className="bg-green-600 hover:bg-green-500 text-white px-5 rounded-xl font-bold transition"><i className="fa-solid fa-plus"></i></button>
                    </div>
                </div>}

                {/* ── Nav ── */}
                <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
                    {step > 1
                        ? <button onClick={() => setStep(s => s - 1)} className="text-zinc-400 hover:text-white font-bold transition flex items-center gap-2 text-sm"><i className="fa-solid fa-arrow-left"></i> Back</button>
                        : <div />}
                    {step < 4
                        ? <button
                            disabled={(step===1 && !canNext1) || (step===2 && !canNext2) || (step===3 && !canNext3)}
                            onClick={() => { SFX.click(); setStep(s => s + 1); }}
                            className={`bg-gradient-to-r ${stepMeta[step].color} text-white px-7 py-3 rounded-2xl fredoka font-bold text-base transition shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100`}>
                            Next <i className="fa-solid fa-arrow-right"></i>
                          </button>
                        : <button onClick={finish} disabled={!canFinish}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-8 py-3 rounded-2xl fredoka font-bold text-base hover:scale-105 transition shadow-lg shadow-green-500/25 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                            <i className="fa-solid fa-rocket"></i> Launch Auction!
                          </button>}
                </div>

            </div>
        </div>
    </div>;
};

// ═══════════════════════════════════════════════
// MAIN APP (Dark Themed Pro UI)
// ═══════════════════════════════════════════════
function App() {
    const [view, setView] = useState('loading');
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [stats, setStats] = useState(null);
    const [config, setConfig] = useState({});
    const [catRules, setCatRules] = useState([]);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [savedAuctionState, setSavedAuctionState] = useState(null);
    const [currentBid, setCurrentBid] = useState(0);
    const [showWheel, setShowWheel] = useState(false);
    const [wheelMode, setWheelMode] = useState('player');
    const [showTeamRoster, setShowTeamRoster] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [editTeam, setEditTeam] = useState(null);
    const [editPlayer, setEditPlayer] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [bidAnim, setBidAnim] = useState(false);
    const [playerFilter, setPlayerFilter] = useState('all');
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [dashTab, setDashTab] = useState('overview');
    const [showAddTeamModal, setShowAddTeamModal] = useState(false);
    const [showPresetsModal, setShowPresetsModal] = useState(false);
    const [revealPhase, setRevealPhase] = useState(6); // 0-6 phases. 6 = fully revealed (idle state)
    const [quickMode, setQuickMode] = useState(false); // Toggle to skip animations
    
    // Derived theme properties from config
    const currentTheme = config?.sport_theme && SPORT_THEMES[config.sport_theme] 
        ? SPORT_THEMES[config.sport_theme] 
        : SPORT_THEMES['multi_sport'];

    const loadData = async () => {
        try {
            const [tR,pR,sR,cR] = await Promise.all([fetch('/api/teams'),fetch('/api/players'),fetch('/api/stats'),fetch('/api/config')]);
            const [td,pd,sd,cd] = await Promise.all([tR.json(),pR.json(),sR.json(),cR.json()]);
            setTeams(Array.isArray(td) ? td : []);
            setPlayers(Array.isArray(pd) ? pd : []);
            setStats(sd || {});
            setConfig(cd.config || {});
            
            setCatRules(cd.category_rules || []);
            
            try {
                const asRes = await fetch('/api/auction/state');
                if (asRes.ok) {
                    const asData = await asRes.json();
                    setSavedAuctionState(asData.current_player ? asData : null);
                }
            } catch(e) {}
            
            return {cd, pd};

        } catch(err) {
            console.error('Error loading auction data:', err);
            return null;
        }
    };

    useEffect(()=>{
        (async()=>{
            const res = await loadData();
            if(!res) return;
            const {cd, pd} = res;
            if((cd && cd.config?.setup_done === 'true') || (pd && pd.length > 0)) {
                setView('dashboard');
            } else {
                setView('wizard');
            }
        })();
    }, []);

    const bidIncrement = parseFloat(config.bid_increment) || 2.5;

    const saveAuctionState = (player, bid) => {
        if(player) {
            fetch('/api/auction/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_player: player.name,
                    current_bid: bid || 0,
                    category: player.category || '',
                    base_price: player.base_price || 0,
                    photo_url: player.photo_url || ''
                })
            });
        } else {
            fetch('/api/auction/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_player: '', current_bid: 0, category: '', base_price: 0, photo_url: '' })
            });
        }
    };

    // CRUD
    const [newTeam,setNewTeam]=useState({name:'',total_budget:''});
    const [newPlayer,setNewPlayer]=useState({name:'',category:'',base_price:''});
    const addTeam = async e => { e.preventDefault(); await fetch('/api/teams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newTeam.name,total_budget:parseFloat(newTeam.total_budget),color:TEAM_COLORS[teams.length%TEAM_COLORS.length]})}); setNewTeam({name:'',total_budget:''}); loadData(); };
    const updateTeam = async e => { e.preventDefault(); await fetch('/api/teams/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editTeam.id,name:editTeam.name,total_budget:parseFloat(editTeam.total_budget),color:editTeam.color})}); setEditTeam(null); loadData(); };
    const addPlayer = async e => { e.preventDefault(); await fetch('/api/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newPlayer.name,category:newPlayer.category,base_price:parseFloat(newPlayer.base_price||0)})}); setNewPlayer({name:'',category:'',base_price:''}); loadData(); };
    const updatePlayer = async e => { e.preventDefault(); await fetch('/api/players/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editPlayer.id,name:editPlayer.name,category:editPlayer.category,base_price:parseFloat(editPlayer.base_price||0)})}); setEditPlayer(null); loadData(); };
    const uploadPhoto = async (pid,file) => { const fd=new FormData();fd.append('photo',file); await fetch(`/api/players/photo/${pid}`,{method:'POST',body:fd}); loadData(); };
    const handleCSV = async e => { const file=e.target.files[0]; if(!file)return; const fd=new FormData();fd.append('file',file); const r=await fetch('/api/players/import',{method:'POST',body:fd}); const d=await r.json(); if(d.success){alert(`✅ Imported ${d.count} players!`);loadData();}else alert(d.error||'Failed'); e.target.value=null; };

    // Keyboard Shortcuts
    useEffect(()=>{
        const h=e=>{
            if(view!=='auction'||!currentPlayer||showWheel) return;
            if(e.key==='ArrowUp'){e.preventDefault();setCurrentBid(p=>p+bidIncrement);SFX.bid();setBidAnim(true);setTimeout(()=>setBidAnim(false),200);}
            else if(e.key==='ArrowDown'){e.preventDefault();setCurrentBid(p=>Math.max(0,p-bidIncrement));SFX.bid();}
        };
        window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h);
    },[view,currentPlayer,showWheel,bidIncrement]);

    // Auction actions
    
    const startBargainBin = async () => {
        if(!confirm('🚨 WARNING: This will take ALL unsold players, slash their base price by 50% (minimum 1L), and restock them into the auction pool! Proceed?')) return;
        try {
            const r = await fetch('/api/action/bargain_bin', { method: 'POST' });
            const d = await r.json();
            if(d.success) {
                alert(`🔥 Bargain Bin Round Started! ${d.count} players restocked at 50% price.`);
                loadData();
            } else {
                alert(d.error || 'Failed');
            }
        } catch(e) { alert(e); }
    };

    
    const resumeLiveAuction = () => {
        if (!savedAuctionState || !savedAuctionState.current_player) return;
        const p = players.find(x => x.name === savedAuctionState.current_player);
        if (p) {
            setCurrentPlayer({...p, ...savedAuctionState});
            setCurrentBid(parseFloat(savedAuctionState.current_bid) || p.base_price || 0);
            setView('auction');
        } else {
            alert("Player not found in pool. They might have been deleted or reset.");
        }
    };

    const drawRandom = () => {
        const unsold=players.filter(p=>p.status==='unsold');
        if(!unsold.length){alert('No players left in pool!');return;}
        const pick=unsold[Math.floor(Math.random()*unsold.length)];
        setCurrentPlayer(pick);
        setCurrentBid(pick.base_price || 0);
        setView('auction');
        if (!quickMode) {
            setRevealPhase(0);
            SFX.reveal();
            // Staggered reveal sequence
            setTimeout(() => setRevealPhase(1), 500); // Category
            setTimeout(() => setRevealPhase(2), 1200); // Attributes
            setTimeout(() => setRevealPhase(3), 2000); // Photo
            setTimeout(() => setRevealPhase(4), 2800); // Name
            setTimeout(() => { setRevealPhase(5); SFX.draw(); }, 3500); // Base price & controls
            setTimeout(() => setRevealPhase(6), 3600); // Done
        } else {
            setRevealPhase(6);
            SFX.draw();
        }
        saveAuctionState(pick, pick.base_price||0);
        speakCommentary(`Now up for auction: ${pick.name}, ${pick.category || 'player'}, base price ${pick.base_price || 0} Lakhs`, voiceEnabled);
    };

    const handleSpinSelect = item => {
        if(wheelMode==='player'){
            setCurrentPlayer(item);
            setCurrentBid(item.base_price || 0);
            setShowWheel(false);
            setView('auction');
            if (!quickMode) {
                setRevealPhase(0);
                SFX.reveal();
                setTimeout(() => setRevealPhase(1), 500);
                setTimeout(() => setRevealPhase(2), 1200);
                setTimeout(() => setRevealPhase(3), 2000);
                setTimeout(() => setRevealPhase(4), 2800);
                setTimeout(() => { setRevealPhase(5); SFX.draw(); }, 3500);
                setTimeout(() => setRevealPhase(6), 3600);
            } else {
                setRevealPhase(6);
                SFX.draw();
            }
            saveAuctionState(item, item.base_price||0);
            speakCommentary(`Now up for auction: ${item.name}, ${item.category || 'player'}, base price ${item.base_price || 0} Lakhs`, voiceEnabled);
        } else {
            handleSold(item.id,currentPlayer.base_price); setShowWheel(false);
        }
    };

    
    const handlePass = async () => {
        SFX.sold(); // reusing sold sound for now or maybe undo
        await fetch('/api/action/pass', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({player_id: currentPlayer.id})});
        saveAuctionState(null, 0);
        await loadData();
        setCurrentPlayer(null);
    };

    const handleRevive = async (player, halfPrice) => {
        if(halfPrice) {
            await fetch('/api/action/revive', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({player_id: player.id, half_price: true})});
        } else {
            await fetch('/api/action/revive', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({player_id: player.id, half_price: false})});
        }
        await loadData();
        // Automatically put them on the block
        const updatedPlayer = { ...player, base_price: halfPrice ? Math.round(player.base_price / 2) : player.base_price, status: 'unsold' };
        setCurrentPlayer(updatedPlayer);
        setCurrentBid(updatedPlayer.base_price || 0);
        setView('auction');
        saveAuctionState(updatedPlayer, updatedPlayer.base_price || 0);
    };

    const handleReviveSpin = async (player) => {
        // Just put them on block and open spin wheel
        const updatedPlayer = { ...player, status: 'unsold' };
        setCurrentPlayer(updatedPlayer);
        setCurrentBid(updatedPlayer.base_price || 0);
        setWheelMode('team');
        setShowWheel(true);
        saveAuctionState(updatedPlayer, updatedPlayer.base_price || 0);
    };

    const handleSold = async (teamId, price = currentBid) => {
        const chosenTeam = teams.find(t => t.id == teamId);
        if(!chosenTeam) { alert('Please select a franchise!'); return; }

        if(chosenTeam.remaining_budget < price) {
            if(!confirm(`⚠️ WARNING: ${chosenTeam.name} has only ₹${chosenTeam.remaining_budget}L remaining, which is less than ₹${price}L! Proceed anyway?`)) {
                return;
            }
        }

        const rule = catRules.find(r => r.category === currentPlayer.category);
        const currentCatCount = (chosenTeam.players || []).filter(p => p.category === currentPlayer.category).length;
        if(rule && currentCatCount >= rule.max_per_team) {
            if(!confirm(`⚠️ WARNING: ${chosenTeam.name} has already reached the max limit of ${rule.max_per_team} for ${currentPlayer.category}! Proceed anyway?`)) {
                return;
            }
        }

        SFX.sold(); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),2500);
        speakCommentary(`Sold! ${currentPlayer.name} goes to ${chosenTeam.name} for ${price} Lakhs!`, voiceEnabled);
        await fetch('/api/sell_player',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player_id:currentPlayer.id,team_id:parseInt(teamId),sold_price:price})});
        saveAuctionState(null, 0);
        await loadData(); setCurrentPlayer(null);
    };

    const undoLast = async () => { SFX.undo(); const r=await fetch('/api/undo',{method:'POST'}); const d=await r.json(); if(d.success){alert(`↩️ Undid: ${d.player_name}`);loadData();}else alert(d.error||'Nothing to undo'); };
    
    const wipeAllAndRestart = async () => {
        if(confirm('⚠️ START NEW AUCTION?\n\nThis will WIPE ALL players, teams, and settings to start fresh.\nAre you sure?')){
            await fetch('/api/setup/restart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wipe_all:true})});
            window.location.reload();
        }
    };

    const resetAuction = async () => { if(confirm('⚠️ Reset entire auction?')){await fetch('/api/reset',{method:'POST'});await loadData();setCurrentPlayer(null);} };

    useEffect(()=>{
        if(currentPlayer && view==='auction'){
            saveAuctionState(currentPlayer, currentBid);
        }
    },[currentBid]);

    const unsoldPlayers = players.filter(p=>p.status==='unsold');
    const soldPlayers = players.filter(p=>p.status==='sold');
    const categoryList = catRules.map(r=>r.category);

    if(view==='loading') return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-center"><div className="text-5xl mb-3 animate-bounce">🏏</div><p className="fredoka text-xl text-slate-400">Loading auction system...</p></div></div>;
    if(view==='wizard') return <SetupWizard onComplete={()=>{loadData();setView('dashboard');}} />;

    // ═══════════════════════════════════════════════
    // DASHBOARD (Dark Themed)
    // ═══════════════════════════════════════════════
    if(view==='dashboard'){
        const filteredPlayers = playerFilter==='all'?players:playerFilter==='sold'?soldPlayers:playerFilter==='unsold'?unsoldPlayers:playerFilter==='passed'?players.filter(p=>p.status==='passed'):players.filter(p=>p.category===playerFilter);
        const categoriesStats = stats?.categories || [];
        const totalSpent = stats?.total_spent || 0;

        return <div className="min-h-screen bg-gradient-to-br from-[#090d16] via-[#0f172a] to-[#090d16] text-white">
            <Confetti show={showConfetti} />
            {showPresetsModal && <PresetsModal
                onLoadPreset={async(id)=>{
                    const r=await fetch('/api/presets/load',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preset_id:id})});
                    const d=await r.json();
                    if(d.success){await loadData();alert(`✅ Loaded "${id}" preset — ${d.count||''} players!`);}
                    else alert(d.error||'Failed to load preset');
                }}
                onClose={()=>setShowPresetsModal(false)}
            />}
            {showWheel && <SpinWheel items={wheelMode==='player'?unsoldPlayers:teams} title={wheelMode==='player'?'🎯 Draw Player':'🎰 Pick Team'} onSelect={handleSpinSelect} onClose={()=>setShowWheel(false)} />}
            {showTeamRoster && <TeamRosterModal team={showTeamRoster} onClose={()=>setShowTeamRoster(null)} />}
            {showShareModal && <ShareModal teams={teams} onClose={()=>setShowShareModal(false)} />}

            {/* ── Header ── */}
            <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 shadow-lg">
                <div className="max-w-[1600px] mx-auto px-6 py-3 flex justify-between items-center gap-4">
                    {/* Left: Brand */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-base shadow-lg shadow-amber-500/20">🔨</div>
                        <div>
                            <h1 className="fredoka text-lg font-bold text-white leading-none">{config.event_name||'Auction'}</h1>
                            <span className="text-[0.6rem] text-purple-400 font-extrabold uppercase tracking-widest">👑 Admin</span>
                        </div>
                    </div>

                    {/* Center: Quick stats */}
                    <div className="hidden md:flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-1.5 text-xs font-bold text-slate-400 gap-4">
                        <span><span className="text-white">{stats?.total_players||0}</span> players</span>
                        <span className="text-slate-700">•</span>
                        <span><span className="text-green-400">{stats?.sold||0}</span> sold</span>
                        <span className="text-slate-700">•</span>
                        <span><span className="text-amber-400">₹{totalSpent}L</span> spent</span>
                        <span className="text-slate-700">•</span>
                        <span><span className="text-blue-400">{unsoldPlayers.length}</span> remaining</span>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Voice toggle — icon only */}
                        <button onClick={()=>setVoiceEnabled(!voiceEnabled)} title={voiceEnabled?'Voice On (click to mute)':'Voice Off (click to unmute)'}
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${voiceEnabled?'bg-amber-500/15 text-amber-300 border-amber-500/30':'bg-slate-800 text-slate-500 border-slate-700'}`}>
                            <i className={`fa-solid text-sm ${voiceEnabled?'fa-volume-high':'fa-volume-xmark'}`}></i>
                        </button>

                        {/* Public Screen */}
                        <button onClick={()=>window.open('/live','_blank')} title="Open Projector / Public Screen"
                            className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-800 text-blue-300 hover:text-white hover:bg-blue-500/20 hover:border-blue-500/40 flex items-center justify-center transition">
                            <i className="fa-solid fa-tv text-sm"></i>
                        </button>

                        {/* Undo */}
                        <button onClick={undoLast}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-yellow-400 hover:border-yellow-500/40 hover:bg-yellow-500/10 font-bold text-xs transition">
                            <i className="fa-solid fa-rotate-left"></i> Undo
                        </button>

                        {/* More dropdown */}
                        <MoreMenu items={[
                            {icon:'fa-dharmachakra', label:'Spin Draw', onClick:()=>{setWheelMode('player');setShowWheel(true);}},
                            {icon:'fa-shuffle', label:'Random Draw', onClick:drawRandom},
                            {divider:true},
                            {icon:'fa-tags', label:'Bargain Bin Round', onClick:startBargainBin},
                            {icon:'fa-share-nodes', label:'Share Links', onClick:()=>setShowShareModal(true)},
                            {icon:'fa-print', label:'Print Report', onClick:()=>window.open('/report','_blank')},
                            {divider:true},
                            {icon:'fa-rotate-left', label:'Clear Bids Only', danger:true, onClick:resetAuction},
                            {icon:'fa-power-off', label:'Start Over (Wipe All)', danger:true, onClick:wipeAllAndRestart},
                            {icon:'fa-right-from-bracket', label:'Logout', danger:true, onClick:()=>window.location.href='/logout'},
                        ]} />

                        {/* Primary CTA */}
                        {savedAuctionState?.current_player ? (
                            <button onClick={resumeLiveAuction}
                                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs px-4 py-2 rounded-xl hover:scale-105 transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5 uppercase tracking-wide">
                                <i className="fa-solid fa-play"></i> Resume
                            </button>
                        ) : (
                            <button onClick={()=>setView('auction')}
                                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-extrabold text-xs px-5 py-2 rounded-xl hover:scale-105 transition shadow-lg shadow-green-500/20 flex items-center gap-1.5 uppercase tracking-wide">
                                <i className="fa-solid fa-play"></i> Go Live
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab bar */}
                <div className="max-w-[1600px] mx-auto px-6 flex gap-0.5 border-t border-slate-800/60">
                    {[{id:'overview', label:'Overview', icon:'fa-chart-pie'}, {id:'pool', label:'Player Pool', icon:'fa-users'}].map(tab => (
                        <button key={tab.id} onClick={()=>setDashTab(tab.id)}
                            className={`px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all ${dashTab===tab.id
                                ?'border-amber-500 text-amber-400 bg-amber-500/5'
                                :'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'}`}>
                            <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

                {/* ── OVERVIEW TAB ── */}
                {dashTab === 'overview' && <>
                    {/* Stats row */}
                    {stats && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            {l:'Total Players', v:stats.total_players, icon:'fa-users', color:'text-blue-400', border:'border-blue-500/20', bg:'bg-blue-500/5'},
                            {l:'Sold', v:stats.sold, icon:'fa-gavel', color:'text-green-400', border:'border-green-500/20', bg:'bg-green-500/5'},
                            {l:'Remaining', v:stats.unsold, icon:'fa-hourglass-half', color:'text-amber-400', border:'border-amber-500/20', bg:'bg-amber-500/5'},
                            {l:'Total Spent', v:`₹${stats.total_spent}L`, icon:'fa-indian-rupee-sign', color:'text-purple-400', border:'border-purple-500/20', bg:'bg-purple-500/5'},
                        ].map((s,i)=><div key={i} className={`${s.bg} rounded-2xl p-4 border ${s.border} flex items-center gap-3 shadow-xl anim-slideUp`} style={{animationDelay:`${i*0.06}s`}}>
                            <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 shrink-0">
                                <i className={`fa-solid ${s.icon} ${s.color}`}></i>
                            </div>
                            <div>
                                <div className="text-[0.6rem] text-slate-400 font-extrabold uppercase tracking-widest">{s.l}</div>
                                <div className="fredoka text-2xl font-bold text-white">{s.v}</div>
                            </div>
                        </div>)}
                    </div>}

                    {/* Franchises */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="fredoka text-base font-bold text-slate-300 flex items-center gap-2">🛡️ Franchises</h2>
                            <button onClick={()=>setShowAddTeamModal(true)}
                                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 transition">
                                <i className="fa-solid fa-plus"></i> Add Team
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {teams.map((t,i)=>{
                                const pct=Math.max(0,Math.min(100,(t.remaining_budget/t.total_budget)*100));
                                return <div key={t.id} onClick={()=>setShowTeamRoster(t)}
                                    className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 cursor-pointer hover:border-amber-500/30 hover:bg-slate-800/60 hover:-translate-y-0.5 transition-all group shadow-lg anim-slideUp"
                                    style={{animationDelay:`${i*0.04}s`}}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0" style={{background:t.color||'#3b82f6'}}>
                                                {t.logo_url ? <img src={t.logo_url} className="w-6 h-6 object-contain" /> : t.name[0]}
                                            </div>
                                            <h3 className="font-extrabold text-white text-sm truncate">{t.name}</h3>
                                        </div>
                                        <button onClick={e=>{e.stopPropagation();setEditTeam(t);}} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-amber-400 transition p-1">
                                            <i className="fa-solid fa-pen text-xs"></i>
                                        </button>
                                    </div>
                                    <div className="bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${pct>50?'bg-green-400':pct>20?'bg-yellow-400':'bg-red-400'}`} style={{width:`${pct}%`}}></div>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-bold">{t.player_count||0} players</span>
                                        <span className={`font-extrabold ${pct>20?'text-green-400':'text-red-400'}`}>₹{t.remaining_budget}L</span>
                                    </div>
                                    {t.fulfillment && t.fulfillment.length>0 && <div className="flex flex-wrap gap-1 mt-2">
                                        {t.fulfillment.filter(f=>f.min>0).map((f,fi)=><span key={fi} className={`text-[0.5rem] font-bold px-1.5 py-0.5 rounded-full ${f.met?'bg-green-500/20 text-green-400 border border-green-500/30':'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>{f.category}:{f.have}/{f.min}</span>)}
                                    </div>}
                                </div>;
                            })}
                        </div>
                    </div>

                    {/* Category Breakdown — collapsible */}
                    {categoriesStats.length > 0 && <details className="bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl group">
                        <summary className="flex justify-between items-center p-4 cursor-pointer list-none select-none">
                            <span className="fredoka text-sm font-bold text-slate-300 flex items-center gap-2">
                                <i className="fa-solid fa-chart-pie text-purple-400"></i> Category Spending Breakdown
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-400 font-bold">₹{totalSpent}L total</span>
                                <i className="fa-solid fa-chevron-down text-slate-500 group-open:rotate-180 transition-transform text-xs"></i>
                            </div>
                        </summary>
                        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 border-t border-slate-800 pt-4">
                            {categoriesStats.map((c, i) => (
                                <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="font-extrabold text-xs text-white truncate">{c.category}</span>
                                        <span className="text-[0.6rem] font-bold text-slate-400">{c.sold_count}/{c.total}</span>
                                    </div>
                                    <div className="fredoka text-base font-bold text-green-400">₹{c.total_spent}L</div>
                                    <div className="bg-slate-800 rounded-full h-1 overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full" style={{width:`${c.percent_of_total}%`}}></div>
                                    </div>
                                    <div className="text-[0.55rem] text-slate-400 font-bold">Avg ₹{c.avg_price}L • {c.percent_of_total}%</div>
                                </div>
                            ))}
                        </div>
                    </details>}
                </>}

                {/* ── PLAYER POOL TAB ── */}
                {dashTab === 'pool' && <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <h2 className="fredoka text-base font-bold text-slate-300 flex items-center gap-2">👥 Player Pool</h2>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
                                {['all','unsold','passed','sold',...categoryList].map(f=><button key={f} onClick={()=>setPlayerFilter(f)}
                                    className={`px-2.5 py-1 rounded-lg text-[0.6rem] font-extrabold uppercase tracking-wider transition ${playerFilter===f?'bg-amber-500 text-black shadow':'text-slate-400 hover:text-white'}`}>{f}</button>)}
                            </div>
                            <button onClick={()=>setShowPresetsModal(true)}
                                className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl hover:bg-amber-500/25 font-bold text-xs transition flex items-center gap-1.5">
                                <i className="fa-solid fa-bolt"></i>Presets
                            </button>
                            <label className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-purple-500/25 font-bold text-xs transition flex items-center gap-1.5">
                                <i className="fa-solid fa-file-excel"></i>Upload Excel/CSV
                                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleCSV} />
                            </label>
                        </div>
                    </div>

                    {/* Add player inline form */}
                    <form onSubmit={addPlayer} className="flex gap-2 bg-slate-900/80 rounded-2xl p-3 border border-slate-800">
                        <input required type="text" placeholder="Player name" className="bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl flex-1 text-xs font-bold focus:border-purple-500 outline-none" value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer,name:e.target.value})} />
                        <select className="bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl w-36 text-xs font-bold focus:border-purple-500 outline-none" value={newPlayer.category} onChange={e=>setNewPlayer({...newPlayer,category:e.target.value})}>
                            <option value="">Category</option>{categoryList.map(c=><option key={c}>{c}</option>)}
                        </select>
                        <input type="number" placeholder="Base (L)" className="bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl w-24 text-xs font-bold focus:border-purple-500 outline-none" value={newPlayer.base_price} onChange={e=>setNewPlayer({...newPlayer,base_price:e.target.value})} />
                        <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-5 rounded-xl font-bold text-xs transition">
                            <i className="fa-solid fa-user-plus"></i>
                        </button>
                    </form>

                    {/* Player grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                        {filteredPlayers.map(p=><div key={p.id} className={`relative bg-slate-900/80 border rounded-xl p-2.5 flex items-center gap-2 hover:border-slate-700 transition group ${p.status==='sold'?'border-green-500/30 bg-green-500/5':'border-slate-800'}`}>
                            <div className="relative shrink-0">
                                <PlayerPhoto url={p.photo_url} name={p.name} size={36} />
                                <label className="absolute -bottom-0.5 -right-0.5 bg-slate-800 hover:bg-blue-500 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition opacity-0 group-hover:opacity-100 border border-slate-600">
                                    <i className="fa-solid fa-camera text-[0.4rem] text-white"></i>
                                    <input type="file" accept="image/*" className="hidden" onChange={e=>{if(e.target.files[0])uploadPhoto(p.id,e.target.files[0]);}} />
                                </label>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-extrabold text-white text-xs truncate">{p.name}</div>
                                <div className="flex items-center gap-1 mt-0.5">{p.category&&<CatBadge category={p.category}/>}</div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <span className="text-[0.55rem] text-slate-400 font-bold">₹{p.base_price}L</span>
                                {p.status==='sold'?<span className="text-[0.5rem] text-green-400 font-extrabold">SOLD ₹{p.sold_price}L</span>:p.status==='passed'?<span className="text-[0.5rem] text-red-400 font-bold">PASSED</span>:<span className="text-[0.5rem] text-amber-400 font-bold">POOL</span>}
                                <button onClick={()=>setEditPlayer(p)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-purple-400 transition text-[0.6rem]"><i className="fa-solid fa-pen"></i></button>
                            </div>
                            {p.status==='passed' && (
                                <div className="absolute inset-0 bg-slate-900/95 backdrop-blur flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 rounded-xl border border-red-500/50 p-2 z-10">
                                    <button onClick={()=>handleRevive(p, true)} className="bg-amber-600 hover:bg-amber-500 text-white text-[0.6rem] font-bold px-2 py-1 rounded w-full flex justify-center items-center gap-1 shadow-lg">
                                        <i className="fa-solid fa-gavel"></i> Auction @ 50%
                                    </button>
                                    <button onClick={()=>handleReviveSpin(p)} className="bg-purple-600 hover:bg-purple-500 text-white text-[0.6rem] font-bold px-2 py-1 rounded w-full flex justify-center items-center gap-1 shadow-lg">
                                        <i className="fa-solid fa-dharmachakra"></i> Random Spin
                                    </button>
                                </div>
                            )}

                        </div>)}
                    </div>
                </div>}
            </div>

            {/* ── Modals ── */}
            {editTeam && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md anim-scaleIn" onClick={()=>setEditTeam(null)}>
                <form onSubmit={updateTeam} onClick={e=>e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-96 space-y-4 shadow-2xl">
                    <h3 className="fredoka text-lg font-bold text-white">Edit Franchise</h3>
                    <input required type="text" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl font-bold text-sm" value={editTeam.name} onChange={e=>setEditTeam({...editTeam,name:e.target.value})} />
                    <input required type="number" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl font-bold text-sm" value={editTeam.total_budget} onChange={e=>setEditTeam({...editTeam,total_budget:e.target.value})} />
                    <div className="flex items-center gap-2 flex-wrap"><label className="text-xs font-bold text-slate-400">Color:</label><input type="color" value={editTeam.color||'#3b82f6'} onChange={e=>setEditTeam({...editTeam,color:e.target.value})} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" /></div>
                    <div className="flex gap-3"><button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm">Save</button><button type="button" onClick={()=>setEditTeam(null)} className="bg-slate-800 text-slate-300 px-5 py-2.5 rounded-xl font-bold text-sm">Cancel</button></div>
                </form>
            </div>}

            {showAddTeamModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md anim-scaleIn" onClick={()=>setShowAddTeamModal(false)}>
                <form onSubmit={addTeam} onClick={e=>e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-96 space-y-4 shadow-2xl">
                    <h3 className="fredoka text-lg font-bold text-white flex items-center gap-2"><i className="fa-solid fa-plus text-blue-400"></i>Add Franchise</h3>
                    <input required type="text" placeholder="Franchise name" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl font-bold text-sm focus:border-blue-400 outline-none" value={newTeam.name} onChange={e=>setNewTeam({...newTeam,name:e.target.value})} />
                    <input required type="number" placeholder="Budget (Lakhs)" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl font-bold text-sm focus:border-blue-400 outline-none" value={newTeam.total_budget} onChange={e=>setNewTeam({...newTeam,total_budget:e.target.value})} />
                    <div className="flex gap-3"><button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm">Add Team</button><button type="button" onClick={()=>setShowAddTeamModal(false)} className="bg-slate-800 text-slate-300 px-5 py-2.5 rounded-xl font-bold text-sm">Cancel</button></div>
                </form>
            </div>}

            {editPlayer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md anim-scaleIn" onClick={()=>setEditPlayer(null)}>
                <form onSubmit={updatePlayer} onClick={e=>e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-96 space-y-4 shadow-2xl">
                    <h3 className="fredoka text-lg font-bold text-white">Edit Player</h3>
                    <input required type="text" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl font-bold text-sm" value={editPlayer.name} onChange={e=>setEditPlayer({...editPlayer,name:e.target.value})} />
                    <select className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl font-bold text-sm" value={editPlayer.category} onChange={e=>setEditPlayer({...editPlayer,category:e.target.value})}><option value="">Category</option>{categoryList.map(c=><option key={c}>{c}</option>)}</select>
                    <input type="number" className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl font-bold text-sm" value={editPlayer.base_price} onChange={e=>setEditPlayer({...editPlayer,base_price:e.target.value})} />
                    <div className="flex gap-3"><button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl font-bold text-sm">Save</button><button type="button" onClick={()=>setEditPlayer(null)} className="bg-slate-800 text-slate-300 px-5 py-2.5 rounded-xl font-bold text-sm">Cancel</button></div>
                </form>
            </div>}
        </div>;
    }

        // ═══════════════════════════════════════════════
    // AUCTION VIEW (Stadium Broadcast Theme)
    // ═══════════════════════════════════════════════
    return <div className="flex flex-col lg:flex-row h-screen lg:overflow-hidden fixed inset-0 z-[100]" 
                style={{ background: currentTheme.bg, '--accent-rgb': currentTheme.accent === '#f59e0b' ? '245,158,11' : currentTheme.accent === '#22c55e' ? '34,197,94' : '59,130,246' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: currentTheme.overlay }}></div>
        <Confetti show={showConfetti} />
        {showWheel && <SpinWheel items={wheelMode==='player'?unsoldPlayers:teams} title={wheelMode==='player'?'🎯 Draw Player':'🎰 Pick Team'} onSelect={handleSpinSelect} onClose={()=>setShowWheel(false)} />}
        {showTeamRoster && <TeamRosterModal team={showTeamRoster} onClose={()=>setShowTeamRoster(null)} />}
        {showShareModal && <ShareModal teams={teams} onClose={()=>setShowShareModal(false)} />}

        {/* Main Stage */}
        <div className="flex-1 flex flex-col relative z-10">
            <header className="flex justify-between items-center px-6 py-2 bg-slate-950/60 backdrop-blur-md border-b border-slate-800/50">
                <button onClick={()=>setView('dashboard')} className="text-slate-400 hover:text-white font-bold text-xs transition flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800"><i className="fa-solid fa-arrow-left"></i>Dashboard</button>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 px-3 py-1 rounded-full"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div><span className="fredoka text-red-400 font-bold text-[0.65rem] uppercase tracking-widest">Live Hammer</span></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={()=>setQuickMode(!quickMode)} className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 border ${quickMode ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-slate-900/80 text-slate-500 border-slate-800'}`} title="Skip animations">
                        <i className="fa-solid fa-bolt"></i> {quickMode ? 'Quick Mode ON' : 'Quick Mode OFF'}
                    </button>
                    <button onClick={()=>setVoiceEnabled(!voiceEnabled)} className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 border ${voiceEnabled ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-slate-900/80 text-slate-500 border-slate-800'}`}>
                        <i className={`fa-solid ${voiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i> {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
                    </button>
                    <button onClick={()=>window.open('/live', '_blank')} className="text-blue-300 hover:text-white font-bold text-xs bg-blue-500/15 px-3 py-1.5 rounded-xl border border-blue-500/30 hover:bg-blue-500/25 transition">
                        Public Screen ↗
                    </button>
                    <button onClick={undoLast} className="text-yellow-400 font-bold text-xs bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 transition"><i className="fa-solid fa-rotate-left mr-1"></i>Undo</button>
                </div>
            </header>

            <div className="flex-1 flex items-center justify-center p-6">
                {currentPlayer ? (
                    <div className="w-full max-w-4xl relative">
                        {/* The Trading Card Container */}
                        <div className={`bg-slate-950/80 backdrop-blur-3xl border border-slate-700/50 rounded-3xl p-10 text-center relative overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.6)] mb-6 transition-all duration-1000 ${revealPhase >= 0 ? 'anim-cardGlow opacity-100' : 'opacity-0 scale-95'}`}>
                            
                            {/* Watermark Background Emoji */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15rem] opacity-5 pointer-events-none select-none grayscale" style={{animation: 'revealPulse 4s infinite'}}>{currentTheme.emoji}</div>

                            <div className="relative z-10 flex flex-col items-center">
                                
                                {/* Photo Phase (Phase 3) */}
                                <div className={`relative mb-6 ${revealPhase >= 3 ? 'anim-dramaticZoom' : 'opacity-0 hidden'}`}>
                                    <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{background: currentTheme.accent}}></div>
                                    <div className="relative z-10 border-4 rounded-full overflow-hidden shadow-2xl" style={{borderColor: currentTheme.accent}}>
                                        <PlayerPhoto url={currentPlayer.photo_url} name={currentPlayer.name} size={160} />
                                    </div>
                                    
                                    {/* Category Phase (Phase 1) */}
                                    {currentPlayer.category && (
                                        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 ${revealPhase >= 1 ? 'anim-slideInLeft' : 'opacity-0'}`}>
                                            <div className="px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest text-black shadow-lg" style={{background: currentTheme.accent}}>
                                                {currentPlayer.category}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Name Phase (Phase 4) */}
                                <div className={`${revealPhase >= 4 ? 'anim-slamIn' : 'opacity-0'}`}>
                                    <h2 className="fredoka text-6xl md:text-7xl font-black text-white tracking-tight uppercase" style={{textShadow: `0 4px 20px ${currentTheme.accent}40`}}>
                                        {currentPlayer.name}
                                    </h2>
                                </div>

                                {/* Base Price & Controls Phase (Phase 5) */}
                                <div className={`mt-8 w-full ${revealPhase >= 5 ? 'anim-fadeInUp' : 'opacity-0'}`}>
                                    <div className="mb-8">
                                        <p className="fredoka text-slate-400 text-sm font-bold mb-2 uppercase tracking-[0.3em]">Current Live Bid</p>
                                        <div className={`fredoka text-[7rem] leading-none font-black transition-transform duration-150 ${bidAnim?'scale-110':'scale-100'}`} style={{color: currentTheme.accent, textShadow: `0 0 40px ${currentTheme.accent}40`}}>
                                            ₹{currentBid}L
                                        </div>
                                        <p className="text-slate-500 font-bold text-xs mt-2">Base Price: ₹{currentPlayer.base_price}L</p>
                                    </div>

                                    <div className="flex justify-center items-center gap-3">
                                        {[-10,-bidIncrement].map(v=><button key={v} onClick={()=>{setCurrentBid(p=>Math.max(0,p+v));SFX.bid();}} className="bg-slate-800/80 hover:bg-slate-700 border border-slate-600 w-14 h-14 rounded-2xl fredoka font-bold text-white transition active:scale-90 text-lg backdrop-blur-md">{v}</button>)}
                                        <input type="number" value={currentBid} onChange={e=>setCurrentBid(parseFloat(e.target.value)||0)} className="bg-slate-900 border-2 text-white text-center fredoka text-4xl font-bold rounded-2xl w-48 py-2 outline-none transition" style={{borderColor: currentTheme.accent}} />
                                        {[bidIncrement,10,25].map(v=><button key={v} onClick={()=>{setCurrentBid(p=>p+v);SFX.bid();setBidAnim(true);setTimeout(()=>setBidAnim(false),150);}} className="bg-slate-800/80 hover:bg-slate-700 border border-slate-600 w-14 h-14 rounded-2xl fredoka font-bold text-white transition active:scale-90 text-lg backdrop-blur-md">+{v}</button>)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Team Selection with Safeguards & SOLD Button */}
                        <div className={`flex gap-3 transition-all duration-500 ${revealPhase >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                            
                            <button onClick={handlePass} className="bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 border border-slate-700/50 py-4 px-6 rounded-2xl font-bold text-slate-300 hover:text-red-400 transition group flex items-center gap-2 shadow-xl">
                                <i className="fa-solid fa-ban text-xl text-red-400 group-hover:scale-110 transition"></i>Pass (Bin)
                            </button>

                            <button onClick={()=>{setWheelMode('team');setShowWheel(true);}} className="bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 border border-slate-700/50 py-4 px-6 rounded-2xl font-bold text-slate-300 hover:text-orange-400 transition group flex items-center gap-2 shadow-xl">
                                <i className="fa-solid fa-dharmachakra text-xl text-orange-400 group-hover:animate-spin"></i>Unsold→Spin
                            </button>

                            <div className="flex-1 flex gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-2 rounded-2xl shadow-2xl">
                                <select id="teamSel" className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-5 fredoka text-lg font-bold text-white outline-none cursor-pointer">
                                    <option value="">Select Buying Franchise...</option>
                                    {teams.map(t => {
                                        const isAffordable = t.remaining_budget >= currentBid;
                                        const rule = catRules.find(r => r.category === currentPlayer.category);
                                        const have = (t.players || []).filter(p => p.category === currentPlayer.category).length;
                                        const isUnderMax = !rule || have < rule.max_per_team;
                                        const isValid = isAffordable && isUnderMax;
                                        
                                        let label = `${t.name} (₹${t.remaining_budget}L)`;
                                        if (!isAffordable) label += ` [❌ Low Purse]`;
                                        else if (!isUnderMax) label += ` [❌ Max Limit Reached]`;
                                        
                                        return <option key={t.id} value={t.id} disabled={!isValid} className={!isValid ? 'text-red-400 bg-slate-950 font-normal' : 'text-white font-bold bg-slate-900'}>{label}</option>;
                                    })}
                                </select>
                                <button className="px-10 rounded-xl fredoka text-2xl font-bold text-white transition active:scale-95 flex items-center gap-3 shadow-xl" style={{background: currentTheme.accent, textShadow: '0 2px 4px rgba(0,0,0,0.3)'}} onClick={()=>{const s=document.getElementById('teamSel').value;if(!s){alert('Please pick a franchise!');return;}handleSold(s);}}>
                                    <i className="fa-solid fa-gavel"></i>SOLD!
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-8 anim-float">
                        <div className="w-32 h-32 rounded-full flex items-center justify-center border-2 shadow-[0_0_60px_rgba(var(--accent-rgb),0.3)] backdrop-blur-md" style={{borderColor: currentTheme.accent, background: `${currentTheme.accent}20`}}>
                            <span className="text-6xl filter drop-shadow-xl">{currentTheme.emoji}</span>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={()=>{setWheelMode('player');setShowWheel(true);}} className="group bg-slate-900/80 backdrop-blur-md border-2 border-slate-700/50 hover:border-white/50 px-10 py-5 rounded-3xl flex items-center gap-4 hover:bg-slate-800 transition shadow-2xl">
                                <i className="fa-solid fa-dharmachakra text-3xl group-hover:animate-spin" style={{color: currentTheme.accent}}></i>
                                <span className="fredoka text-2xl font-bold text-white">Spin Draw</span>
                            </button>
                            <button onClick={drawRandom} className="group bg-slate-900/80 backdrop-blur-md border-2 border-slate-700/50 hover:border-white/50 px-10 py-5 rounded-3xl flex items-center gap-4 hover:bg-slate-800 transition shadow-2xl">
                                <i className="fa-solid fa-shuffle text-3xl" style={{color: currentTheme.accent}}></i>
                                <span className="fredoka text-2xl font-bold text-white">Random Draw</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Sidebar HUD */}
        <div className="w-full lg:w-[380px] h-2/5 lg:h-full bg-slate-950/90 overflow-y-auto lg:overflow-visible backdrop-blur-xl border-l border-slate-800 flex flex-col z-20">
            <div className="p-5 border-b border-slate-800"><h3 className="fredoka text-base font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-ranking-star text-yellow-400"></i>Franchise HUD</h3></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {teams.map(t=>{
                    const pct=Math.max(0,Math.min(100,(t.remaining_budget/t.total_budget)*100));
                    return <div key={t.id} onClick={()=>setShowTeamRoster(t)} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 cursor-pointer hover:border-slate-700 transition">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md" style={{background:t.color||'#3b82f6'}}>
                                    {t.logo_url ? <img src={t.logo_url} className="w-5 h-5 object-contain" /> : t.name[0]}
                                </div>
                                <div><h4 className="font-extrabold text-white text-xs truncate max-w-[130px]">{t.name}</h4><span className="text-[0.6rem] text-slate-500 font-bold">{t.player_count||0} players</span></div>
                            </div>
                            <div className="text-right"><div className="text-[0.55rem] text-slate-500 font-bold uppercase">Purse</div><div className={`fredoka font-bold text-base ${pct>20?'text-green-400':'text-red-400'}`}>₹{t.remaining_budget}L</div></div>
                        </div>
                        <div className="bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2"><div className={`h-full rounded-full transition-all ${pct>50?'bg-green-400':pct>20?'bg-yellow-400':'bg-red-400'}`} style={{width:`${pct}%`}}></div></div>
                        {t.fulfillment && t.fulfillment.filter(f=>f.min>0).length>0 && <div className="flex flex-wrap gap-1">
                            {t.fulfillment.filter(f=>f.min>0).map((f,fi)=><span key={fi} className={`text-[0.45rem] font-bold px-1.5 py-0.5 rounded-full ${f.met?'bg-green-500/20 text-green-400 border border-green-500/30':'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>{f.category}:{f.have}/{f.min}{f.met?'✓':'!'}</span>)}
                        </div>}
                        {t.players && t.players.length>0 && <div className="flex -space-x-1.5 mt-2">
                            {t.players.slice(0,6).map(p=><PlayerPhoto key={p.id} url={p.photo_url} name={p.name} size={26} />)}
                            {t.players.length>6&&<div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[0.5rem] font-bold text-slate-400">+{t.players.length-6}</div>}
                        </div>}
                    </div>;
                })}
            </div>
        </div>
    </div>;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
