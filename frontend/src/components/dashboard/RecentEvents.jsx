const MOCK_EVENTS = [
  { id: 1, name: 'page_view', site: 'DuoMarst Games', time: '방금', device: 'Mobile', region: 'KR' },
  { id: 2, name: 'clickbutton', site: 'DuoMarst Main', time: '1분 전', device: 'Desktop', region: 'KR' },
  { id: 3, name: 'watch_complete', site: 'DuoMarst Games', time: '2분 전', device: 'Mobile', region: 'US' },
  { id: 4, name: 'application_submit', site: 'DuoMarst Main', time: '3분 전', device: 'Desktop', region: 'JP' },
  { id: 5, name: 'read_complete', site: 'DuoMarst Games', time: '4분 전', device: 'Tablet', region: 'KR' },
  { id: 6, name: 'openproject', site: 'DuoMarst Main', time: '5분 전', device: 'Desktop', region: 'KR' },
];

const EVENT_COLORS = {
  page_view: 'text-slate-400 bg-slate-500/10',
  clickbutton: 'text-indigo-400 bg-indigo-500/10',
  watch_complete: 'text-emerald-400 bg-emerald-500/10',
  application_submit: 'text-amber-400 bg-amber-500/10',
  read_complete: 'text-sky-400 bg-sky-500/10',
  openproject: 'text-violet-400 bg-violet-500/10',
};

export default function RecentEvents() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 text-xs text-slate-500 pb-2 border-b border-white/5 px-1">
        <span>이벤트</span>
        <span>사이트</span>
        <span>환경</span>
        <span className="text-right">시간</span>
      </div>
      {MOCK_EVENTS.map((e) => (
        <div key={e.id} className="grid grid-cols-4 items-center text-sm py-2 px-1 rounded hover:bg-white/3 transition-colors">
          <span className={`text-xs font-mono px-2 py-0.5 rounded w-fit ${EVENT_COLORS[e.name] || 'text-slate-400 bg-slate-500/10'}`}>
            {e.name}
          </span>
          <span className="text-slate-400 text-xs">{e.site}</span>
          <span className="text-slate-500 text-xs">{e.device} · {e.region}</span>
          <span className="text-slate-500 text-xs text-right">{e.time}</span>
        </div>
      ))}
    </div>
  );
}
