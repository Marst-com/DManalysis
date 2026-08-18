export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <div className={`${s} border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin`} />
  );
}

export function LoadingState({ text = '불러오는 중...' }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <Spinner />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
        <span className="text-rose-400 text-lg">!</span>
      </div>
      <p className="text-sm text-slate-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {desc && <p className="text-xs text-slate-500 text-center max-w-xs">{desc}</p>}
      {action}
    </div>
  );
}

export function Badge({ color = 'slate', children }) {
  const colors = {
    slate:   'bg-slate-500/10 text-slate-400',
    indigo:  'bg-indigo-500/10 text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber:   'bg-amber-500/10 text-amber-400',
    rose:    'bg-rose-500/10 text-rose-400',
    violet:  'bg-violet-500/10 text-violet-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
}

export function Table({ cols, rows, empty = '데이터 없음' }) {
  if (!rows?.length) {
    return <p className="text-sm text-slate-500 py-8 text-center">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            {cols.map((c) => (
              <th key={c.key} className="text-left text-xs text-slate-500 font-medium pb-3 pr-4">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-white/3 transition-colors">
              {cols.map((c) => (
                <td key={c.key} className="py-3 pr-4 text-slate-300">
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e2235] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs text-slate-400 mb-1.5">{label}</label>}
      <input
        className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600
          focus:outline-none focus:border-indigo-500 transition-colors
          ${error ? 'border-rose-500/50' : 'border-white/10'}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  );
}

export function Select({ label, options, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs text-slate-400 mb-1.5">{label}</label>}
      <select
        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
          focus:outline-none focus:border-indigo-500 transition-colors"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Btn({ variant = 'primary', size = 'md', loading, children, ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:  'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary:'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10',
    danger:   'bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/20',
    ghost:    'text-slate-400 hover:text-slate-200 hover:bg-white/5',
  };
  const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2', lg: 'text-sm px-5 py-2.5' };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
