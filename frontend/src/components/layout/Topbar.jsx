import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSite } from '../../context/SiteContext';
import SiteSelector from './SiteSelector';

export default function Topbar() {
  const { user, logout } = useAuth();
  const { sites, current, setCurrent } = useSite();

  return (
    <header className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-[#0f1117]/80 backdrop-blur sticky top-0 z-30">
      <SiteSelector sites={sites} current={current} onChange={setCurrent} />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live</span>
        </div>
        <button className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors">
          <Bell size={16} />
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-medium text-white">
            {user?.email?.[0]?.toUpperCase() || 'A'}
          </div>
          <span className="text-xs text-slate-500 hidden md:block">{user?.email || 'Admin'}</span>
        </button>
      </div>
    </header>
  );
}
