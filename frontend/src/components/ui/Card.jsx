export function Card({ children, className = '' }) {
  return (
    <div className={`bg-[#1e2235] border border-white/10 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, trend, icon: Icon, accent = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors[accent]}`}>
          {Icon && <Icon size={16} className={colors[accent].split(' ')[0]} />}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend >= 0
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-rose-400 bg-rose-500/10'
          }`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}
