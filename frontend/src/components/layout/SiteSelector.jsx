import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SiteSelector({ sites, current, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm text-slate-300 hover:text-white
          bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/10 transition-colors"
      >
        <Globe size={14} />
        <span className="max-w-[120px] truncate">{current?.name || '사이트 선택'}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[#1e2235] border border-white/10 rounded-xl shadow-xl z-50 py-1">
          {sites.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                ${current?.id === s.id ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-300 hover:bg-white/5'}`}
            >
              <Globe size={12} />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto text-xs text-slate-600">{s.accessRole}</span>
            </button>
          ))}
          <div className="border-t border-white/5 mt-1 pt-1">
            <button
              onClick={() => { navigate('/sites/new'); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-400 hover:bg-white/5 transition-colors"
            >
              <Plus size={12} />
              <span>사이트 추가</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
