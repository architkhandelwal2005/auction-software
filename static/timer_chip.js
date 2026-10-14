/* The bid timer's seconds left, as a chip for the React screens: team phones,
   the spectator view and the control phone. Counts down between polls by the
   server's clock (LiveFeed.timerLeft); renders nothing while no timer runs.
   <BidTimerChip state={auction_state} big /> */
window.BidTimerChip = function BidTimerChip(props) {
  const st = props.state || {};
  const running = !!(st.timer_ends_at && st.current_player);
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!running) return undefined;
    const every = setInterval(() => tick(x => x + 1), 250);
    return () => clearInterval(every);
  }, [running]);
  if (!running) return null;
  const left = window.LiveFeed.timerLeft(st);
  if (left === null) return null;
  const urgent = left <= 5;
  const tone = urgent
    ? 'text-red-300 border-red-500/60 bg-red-500/15 animate-pulse'
    : 'text-sky-200 border-sky-400/40 bg-sky-500/10';
  const size = props.big ? 'text-lg px-4 py-1.5' : 'text-xs px-3 py-1';
  return React.createElement('span', {
    className: 'inline-flex items-center gap-1.5 rounded-full border font-extrabold tabular-nums ' + tone + ' ' + size,
    title: 'Bid timer: each new bid restarts it',
  }, '⏱ ', left > 0 ? Math.ceil(left) + 's' : 'Time up');
};
