import { useState } from 'react';
import { Users, Globe, Monitor, Smartphone, Clock, TrendingUp } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { StatCard } from '../../components/ui/Card';
import { LoadingState, ErrorState, Badge } from '../../components/ui/Common';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

const PERIODS = [
  { label: '오늘', days: 1 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
];

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

const MOCK_REGIONS = [
  { name: 'Korea', value: 64, color: '#6366f1' },
  { name: 'US', value: 18, color: '#818cf8' },
  { name: 'Japan', value: 11, color: '#a5b4fc' },
  { name: 'Other', value: 7, color: '#c7d2fe' },
];

const MOCK_DEVICES = [
  { name: 'Mobile', value: 58 },
  { name: 'Desktop', value: 34 },
  { name: 'Tablet', value: 8 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1117] border border-white/20 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</div>
      ))}
    </div>
  );
}

export default function VisitorsPage() {
  const { current } = useSite();
  const [days, setDays] = useState(7);
  const { data, loading, error, refetch } = useApi(
    current ? `/analytics/${current.id}/summary?days=${days}` : null,
    [current?.id, days]
  );

  const timeSeries = data?.timeSeries || [];
  const chartData = timeSeries.map((t) => ({
    hour: new Date(t.hour).toLocaleString('ko', { month: 'numeric', day: 'numeric', hour: 'numeric' }),
    방문자: t.count,
  }));

  if (!current) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">방문자 분석</h1>
          <p className="text-sm text-slate-400 mt-0.5">{current.name}</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                days === p.days
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="세션 수" value={loading ? '—' : (data?.uniqueSessions?.toLocaleString() || '0')} icon={Users} accent="indigo" trend={8.2} />
        <StatCard label="총 이벤트" value={loading ? '—' : (data?.totalEvents?.toLocaleString() || '0')} icon={TrendingUp} accent="emerald" trend={12.4} />
        <StatCard label="평균 체류시간" value="3m 42s" icon={Clock} accent="amber" />
        <StatCard label="주요 지역" value="KR 64%" icon={Globe} accent="indigo" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Time series */}
        <div className="lg:col-span-2 bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white mb-4">시간별 방문자</h2>
          {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData.length ? chartData : [{ hour: '—', 방문자: 0 }]}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="방문자" stroke="#6366f1" strokeWidth={2} fill="url(#gv)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Region */}
        <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white mb-4">지역 분포</h2>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={MOCK_REGIONS} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value" strokeWidth={0}>
                {MOCK_REGIONS.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {MOCK_REGIONS.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: r.color }} />
                <span className="text-slate-400 flex-1">{r.name}</span>
                <span className="text-slate-300 font-medium">{r.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Device breakdown */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">디바이스</h2>
        <div className="space-y-3">
          {MOCK_DEVICES.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-20 text-xs text-slate-400 text-right">{d.name}</div>
              <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all duration-700"
                  style={{ width: `${d.value}%`, opacity: 1 - i * 0.2 }}
                />
              </div>
              <div className="w-10 text-xs text-slate-300 font-medium">{d.value}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
