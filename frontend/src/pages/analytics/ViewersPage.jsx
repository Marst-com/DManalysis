import { Eye, PlayCircle, CheckCircle, TrendingDown } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Common';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const FUNNEL = [
  { stage: '시작', pct: 100, count: 1240, color: '#6366f1' },
  { stage: '25%', pct: 78, count: 967, color: '#818cf8' },
  { stage: '50%', pct: 61, count: 756, color: '#a5b4fc' },
  { stage: '75%', pct: 44, count: 546, color: '#c7d2fe' },
  { stage: '완료', pct: 32, count: 397, color: '#e0e7ff' },
];

const CONTENT_TYPES = [
  { name: 'read_complete', label: '읽기 완료', count: 234, trend: '+12%', color: 'indigo' },
  { name: 'watch_complete', label: '시청 완료', count: 163, trend: '+8%', color: 'emerald' },
  { name: 'read_start', label: '읽기 시작', count: 892, trend: '+5%', color: 'amber' },
  { name: 'watch_start', label: '시청 시작', count: 741, trend: '-2%', color: 'slate' },
];

export default function ViewersPage() {
  const { current } = useSite();

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">관람자 분석</h1>
        <p className="text-sm text-slate-400 mt-0.5">{current.name} — 콘텐츠 소비 퍼널</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="콘텐츠 시작" value="1,240" icon={PlayCircle} accent="indigo" trend={5.2} />
        <StatCard label="완료" value="397" icon={CheckCircle} accent="emerald" trend={8.1} />
        <StatCard label="완료율" value="32%" icon={Eye} accent="amber" trend={2.4} />
        <StatCard label="이탈율" value="68%" icon={TrendingDown} accent="rose" trend={-2.4} />
      </div>

      {/* Funnel */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-6">콘텐츠 퍼널</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bar chart */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={FUNNEL} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n, p) => [`${v}% (${p.payload.count.toLocaleString()}명)`, '비율']}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {FUNNEL.map((f, i) => <Cell key={i} fill={f.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Step breakdown */}
          <div className="space-y-3">
            {FUNNEL.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: f.color + '30', color: f.color }}>
                  {f.pct}%
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{f.stage} 지점</span>
                    <span className="text-white font-medium">{f.count.toLocaleString()}명</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${f.pct}%`, background: f.color }} />
                  </div>
                </div>
                {i > 0 && (
                  <span className="text-xs text-rose-400 w-12 text-right">
                    -{(FUNNEL[i-1].pct - f.pct)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content type breakdown */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">이벤트 유형별</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CONTENT_TYPES.map((c, i) => (
            <div key={i} className="bg-white/3 rounded-lg p-4 border border-white/5">
              <Badge color={c.color}>{c.name}</Badge>
              <div className="text-2xl font-bold text-white mt-3 mb-1">{c.count.toLocaleString()}</div>
              <div className="text-xs text-slate-400">{c.label}</div>
              <div className={`text-xs mt-2 font-medium ${c.trend.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {c.trend} 전주 대비
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
