import { UserCheck, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { StatCard } from '../../components/ui/Card';
import { LoadingState, ErrorState, Badge, Table } from '../../components/ui/Common';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MOCK_STATUS = [
  { status: '제출 완료', count: 142, color: 'emerald' },
  { status: '검토 중', count: 38, color: 'amber' },
  { status: '승인', count: 91, color: 'indigo' },
  { status: '거절', count: 13, color: 'rose' },
];

const MOCK_DAILY = Array.from({ length: 14 }, (_, i) => ({
  day: `${i + 1}일`,
  신청: Math.floor(Math.random() * 30 + 5),
}));

export default function ApplicantsPage() {
  const { current } = useSite();
  const { data, loading, error, refetch } = useApi(
    current ? `/analytics/${current.id}/events?eventName=application_submit&limit=20` : null,
    [current?.id]
  );

  const events = data?.events || [];

  const cols = [
    { key: 'eventName', label: '이벤트', render: () => <Badge color="emerald">application_submit</Badge> },
    { key: 'sessionId', label: '세션', render: (r) => <span className="font-mono text-xs">{r.sessionId?.slice(0, 12) || '—'}</span> },
    { key: 'regionCoarse', label: '지역', render: (r) => r.regionCoarse || '—' },
    { key: 'receivedAt', label: '시간', render: (r) => new Date(r.receivedAt).toLocaleString('ko') },
  ];

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">신청자 분석</h1>
        <p className="text-sm text-slate-400 mt-0.5">{current.name} — application_submit 이벤트</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 신청" value="142" icon={UserCheck} accent="emerald" trend={15.3} />
        <StatCard label="오늘 신청" value="8" icon={TrendingUp} accent="indigo" trend={-3.1} />
        <StatCard label="평균 처리시간" value="2.4일" icon={Clock} accent="amber" />
        <StatCard label="승인율" value="64%" icon={CheckCircle} accent="emerald" trend={2.1} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 일별 신청 */}
        <div className="lg:col-span-2 bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white mb-4">일별 신청 추이</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MOCK_DAILY}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="신청" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 상태별 */}
        <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white mb-4">상태별 현황</h2>
          <div className="space-y-3">
            {MOCK_STATUS.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color={s.color}>{s.status}</Badge>
                </div>
                <span className="text-sm font-semibold text-white">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 최근 신청 이벤트 */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">최근 신청 이벤트</h2>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
          <Table cols={cols} rows={events} empty="신청 이벤트가 없습니다. SDK에서 analytics.track('application_submit')을 호출하세요." />
        )}
      </div>
    </div>
  );
}
