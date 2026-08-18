import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, Users, UserCheck, Eye, MessageSquare,
  Zap, Database, Link2, Bot, Bell, Globe, Settings,
  ChevronDown, ChevronRight, Plus, Activity
} from 'lucide-react';

const NAV = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/',
  },
  {
    label: 'Analytics',
    icon: BarChart2,
    children: [
      { label: 'Visitors', icon: Users, to: '/analytics/visitors' },
      { label: 'Applicants', icon: UserCheck, to: '/analytics/applicants' },
      { label: 'Viewers', icon: Eye, to: '/analytics/viewers' },
      { label: 'Comments', icon: MessageSquare, to: '/analytics/comments' },
    ],
  },
  {
    label: 'Functions',
    icon: Zap,
    children: [
      { label: 'clickbutton', icon: Activity, to: '/functions/clickbutton' },
      { label: 'openproject', icon: Activity, to: '/functions/openproject' },
      { label: 'read_complete', icon: Activity, to: '/functions/read_complete' },
      { label: 'watch_complete', icon: Activity, to: '/functions/watch_complete' },
      { label: 'Add New', icon: Plus, to: '/functions/new', accent: true },
    ],
  },
  {
    label: 'Data',
    icon: Database,
    children: [
      { label: 'Events', icon: Activity, to: '/data/events' },
      { label: 'Users', icon: Users, to: '/data/users' },
      { label: 'Sessions', icon: Eye, to: '/data/sessions' },
      { label: 'Export', icon: Database, to: '/data/export' },
    ],
  },
  {
    label: 'Connections',
    icon: Link2,
    children: [
      { label: 'Firebase', icon: Link2, to: '/connections/firebase' },
      { label: 'Supabase', icon: Link2, to: '/connections/supabase' },
      { label: 'REST API', icon: Link2, to: '/connections/rest' },
      { label: 'Webhook', icon: Link2, to: '/connections/webhook' },
    ],
  },
  {
    label: 'AI',
    icon: Bot,
    children: [
      { label: 'Comment Analysis', icon: MessageSquare, to: '/ai/comments' },
      { label: 'Visitor Patterns', icon: Users, to: '/ai/patterns' },
      { label: 'Auto Reports', icon: BarChart2, to: '/ai/reports' },
    ],
  },
  {
    label: 'Alerts',
    icon: Bell,
    children: [
      { label: 'Visitor Spike', icon: Bell, to: '/alerts/visitor-spike' },
      { label: 'Error Alert', icon: Bell, to: '/alerts/error' },
      { label: 'Custom Rules', icon: Bell, to: '/alerts/custom' },
    ],
  },
  {
    label: 'Sites',
    icon: Globe,
    children: [
      { label: 'Site 1', icon: Globe, to: '/sites/1' },
      { label: 'Add Site', icon: Plus, to: '/sites/new', accent: true },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'General', icon: Settings, to: '/settings/general' },
      { label: 'Privacy', icon: Settings, to: '/settings/privacy' },
      { label: 'Security', icon: Settings, to: '/settings/security' },
      { label: 'Team', icon: Settings, to: '/settings/team' },
      { label: 'API Keys', icon: Settings, to: '/settings/api-keys' },
      { label: 'Audit Logs', icon: Settings, to: '/settings/audit-logs' },
    ],
  },
];

function NavItem({ item, depth = 0 }) {
  const location = useLocation();
  const hasChildren = item.children?.length > 0;

  // Auto-expand if any child is active
  const isChildActive = hasChildren && item.children.some(
    (c) => c.to && location.pathname.startsWith(c.to)
  );
  const [open, setOpen] = useState(isChildActive);

  const Icon = item.icon;

  if (!hasChildren) {
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          [
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
            depth > 0 ? 'ml-4' : '',
            item.accent
              ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
              : isActive
              ? 'bg-indigo-600/20 text-indigo-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
          ].join(' ')
        }
        end={item.to === '/'}
      >
        <Icon size={14} />
        <span>{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
      >
        <Icon size={14} />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavItem key={child.to} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 flex flex-col border-r border-white/10 bg-[#0f1117] z-40">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center">
            <BarChart2 size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">DuoMarst</div>
            <div className="text-[10px] text-slate-500 leading-tight">Analytics</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV.map((item) => (
          <NavItem key={item.label} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="text-[10px] text-slate-600">v1.0.0</div>
      </div>
    </aside>
  );
}
