import {
  Users, Clock, MapPin, Eye, RefreshCw, Activity, TrendingUp, Zap
} from 'lucide-react';
import { StatCard } from '../../components/ui/Card';
import VisitorLineChart from '../../components/charts/VisitorLineChart';
import DonutChart from '../../components/charts/DonutChart';
import RecentEvents from '../../components/dashboard/RecentEvents';

// Mock data — replaced by API calls in STEP 6+
const MOCK_STATS = {
  totalVisitors: '128,492',
  uniqueVisitors: '84,317',
  avgDuration: '3m 42s',
  topRegion: 'KR 64%',
  pageViews: '347,210',
  returnRate: '38.4%',
  realtimeActive: 142,
};

const MOCK_DEVICE_DATA = [
  { name: 'Mobile', value: 58, color: '#6366f1' },
  { name: 'Desktop', value: 34, color: '#818cf8' },
  { name: 'Tablet', value: 8, color: '#c7d2fe' },
];

const MOCK_REGION_DATA = [
  { name: 'Korea', value: 64, color: '#6366f1' },
  { name: 'US', value: 18, color: '#818cf8' },
  { name: 'Japan', value: 11, color: '#c7d2fe' },
  { name: 'Other', value: 7, color: '#e0e7ff' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">전체 사이트 통합 현황</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity size={12} className="text-emerald-400" />
          <span>실시간 <span className="text-emerald-400 font-medium">{MOCK_STATS.realtimeActive}</span>명 접속 중</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="누적 접속자" value={MOCK_STATS.totalVisitors} icon={Users} accent="indigo" trend={12.4} />
        <StatCard label="순 방문자" value={MOCK_STATS.uniqueVisitors} icon={TrendingUp} accent="emerald" trend={8.1} />
        <StatCard label="평균 체류시간" value={MOCK_STATS.avgDuration} icon={Clock} accent="amber" trend={-2.3} />
        <StatCard label="주요 지역" value={MOCK_STATS.topRegion} icon={MapPin} accent="indigo" />
        <StatCard label="페이지 조회" value={MOCK_STATS.pageViews} icon={Eye} accent="emerald" trend={15.7} />
        <StatCard label="재방문율" value={MOCK_STATS.returnRate} icon={RefreshCw} accent="amber" trend={3.2} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart: visitor trend */}
        <div className="lg:col-span-2 bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white">시간별 방문자</h2>
            <div className="flex gap-1">
              {['1H', '24H', '7D', '30D'].map((t) => (
                <button
                  key={t}
                  className="text-xs px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors first:bg-indigo-600/20 first:text-indigo-300"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <VisitorLineChart />
        </div>

        {/* Donut charts */}
        <div className="space-y-4">
          <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3">디바이스</h2>
            <DonutChart data={MOCK_DEVICE_DATA} />
          </div>
          <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3">지역</h2>
            <DonutChart data={MOCK_REGION_DATA} />
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">최근 이벤트</h2>
        <RecentEvents />
      </div>
    </div>
  );
}
