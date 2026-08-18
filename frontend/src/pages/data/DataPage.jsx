import { useState } from 'react';
import { Database, Download, Search, Filter } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { Input, Btn, Badge, LoadingState, ErrorState, Table } from '../../components/ui/Common';

export default function DataPage() {
  const { current } = useSite();
  const [eventName, setEventName] = useState('');
  const [days, setDays] = useState(7);
  const [limit, setLimit] = useState(100);

  const query = current
    ? `/analytics/${current.id}/events?limit=${limit}&days=${days}${eventName ? `&eventName=${encodeURIComponent(eventName)}` : ''}`
    : null;

  const { data, loading, error, refetch } = useApi(query, [current?.id, eventName, days, limit]);
  const events = data?.events || [];

  function exportJson() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `events_${current?.slug}_${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function exportCsv() {
    if (!events.length) return;
    const headers = ['id', 'eventName', 'sessionId', 'deviceCategory', 'browser', 'os', 'regionCoarse', 'referrer', 'timestamp', 'receivedAt'];
    const rows = events.map(e => headers.map(h => JSON.stringify(e[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `events_${current?.slug}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const cols = [
    { key: 'eventName', label: '이벤트', render: (r) => <Badge color="indigo">{r.eventName}</Badge> },
    { key: 'sessionId', label: '세션', render: (r) => <span className="font-mono text-xs text-slate-400">{r.sessionId?.slice(0, 12) || '—'}</span> },
    { key: 'deviceCategory', label: '디바이스', render: (r) => r.deviceCategory || '—' },
    { key: 'regionCoarse', label: '지역' },
    { key: 'referrer', label: 'Referrer', render: (r) => <span className="text-xs text-slate-500 truncate max-w-[120px] block">{r.referrer || '—'}</span> },
    { key: 'receivedAt', label: '수신 시간', render: (r) => <span className="text-xs">{new Date(r.receivedAt).toLocaleString('ko')}</span> },
  ];

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Data Explorer</h1>
          <p className="text-sm text-slate-400 mt-0.5">{current.name} — 이벤트 조회 및 Export</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={exportCsv} disabled={!events.length}><Download size={13} /> CSV</Btn>
          <Btn variant="secondary" onClick={exportJson} disabled={!events.length}><Download size={13} /> JSON</Btn>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-slate-500 flex-shrink-0" />
            <input
              placeholder="이벤트 이름 필터 (예: page_view)"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {[1, 7, 30, 90].map((d) => (
              <button key={d}
                onClick={() => setDays(d)}
                className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${days === d ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'}`}
              >{d}일</button>
            ))}
          </div>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-[#0f1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            {[50, 100, 500, 1000].map(n => <option key={n} value={n}>{n}건</option>)}
          </select>
          <Btn variant="secondary" size="sm" onClick={refetch}><Filter size={12} /> 적용</Btn>
        </div>
      </div>

      {/* 결과 */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">이벤트 목록</h2>
          <span className="text-xs text-slate-500">{loading ? '로딩 중...' : `${events.length}건`}</span>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
          <Table cols={cols} rows={events} empty="이벤트가 없습니다. SDK로 이벤트를 전송하세요." />
        )}
      </div>
    </div>
  );
}
