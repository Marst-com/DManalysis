import { useState } from 'react';
import { MessageSquare, ThumbsUp, Minus, ThumbsDown, Sparkles } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { StatCard } from '../../components/ui/Card';
import { Badge, Btn, Input, LoadingState } from '../../components/ui/Common';
import api from '../../services/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const MOCK_SENTIMENT = [
  { name: 'Positive', value: 72, color: '#22c55e' },
  { name: 'Neutral', value: 20, color: '#94a3b8' },
  { name: 'Negative', value: 8, color: '#ef4444' },
];

const MOCK_COMMENTS = [
  { text: '정말 재밌는 게임이에요!', sentiment: 'positive', confidence: 0.94, keywords: ['재밌는', '게임'] },
  { text: '그냥 그래요. 보통인 것 같아요.', sentiment: 'neutral', confidence: 0.71, keywords: ['보통'] },
  { text: '이 기능이 마음에 들지 않아요.', sentiment: 'negative', confidence: 0.83, keywords: ['마음에 들지'] },
];

const SENTIMENT_CONFIG = {
  positive: { icon: ThumbsUp, color: 'emerald', label: 'Positive' },
  neutral:  { icon: Minus, color: 'slate', label: 'Neutral' },
  negative: { icon: ThumbsDown, color: 'rose', label: 'Negative' },
};

export default function CommentsPage() {
  const { current } = useSite();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  async function analyze() {
    if (!text.trim() || !current) return;
    setAnalyzing(true);
    setError('');
    try {
      const res = await api.post(`/ai/${current.id}/analyze-comment`, { text: text.trim() });
      setResult(res.result);
    } catch (err) {
      setError(err.message || '분석 실패. AI API 키를 설정했는지 확인하세요.');
    } finally {
      setAnalyzing(false);
    }
  }

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">댓글 분석</h1>
        <p className="text-sm text-slate-400 mt-0.5">{current.name} — AI 감성 분석 (추정치)</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Positive" value="72%" icon={ThumbsUp} accent="emerald" trend={3.2} />
        <StatCard label="Neutral" value="20%" icon={Minus} accent="indigo" />
        <StatCard label="Negative" value="8%" icon={ThumbsDown} accent="rose" trend={-1.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 감성 분포 */}
        <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white mb-4">감성 분포</h2>
          <p className="text-xs text-slate-500 mb-4">※ AI 추정치, 실제와 다를 수 있음</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={MOCK_SENTIMENT} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" strokeWidth={0}>
                {MOCK_SENTIMENT.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v}%`, '비율']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {MOCK_SENTIMENT.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-slate-400 flex-1">{s.name}</span>
                <span className="text-white font-medium">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI 분석 테스트 */}
        <div className="lg:col-span-2 bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-indigo-400" />
            <h2 className="text-sm font-medium text-white">댓글 분석 테스트</h2>
          </div>
          <div className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="분석할 댓글을 입력하세요..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <Btn onClick={analyze} loading={analyzing} disabled={!text.trim()}>
              <Sparkles size={13} /> 분석하기
            </Btn>

            {result && (
              <div className="mt-4 p-4 bg-white/3 rounded-lg border border-white/5 space-y-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    const c = SENTIMENT_CONFIG[result.sentiment];
                    const Icon = c.icon;
                    return (
                      <>
                        <Badge color={c.color}>{c.label}</Badge>
                        <span className="text-xs text-slate-400">신뢰도 {Math.round(result.confidence * 100)}%</span>
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(result.scores || {}).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <div className="text-xs text-slate-500 mb-1 capitalize">{k}</div>
                      <div className="h-1.5 bg-white/5 rounded-full">
                        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.round(v * 100)}%` }} />
                      </div>
                      <div className="text-xs text-slate-300 mt-1">{Math.round(v * 100)}%</div>
                    </div>
                  ))}
                </div>
                {result.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.keywords.map((k, i) => <Badge key={i} color="indigo">{k}</Badge>)}
                  </div>
                )}
                <p className="text-xs text-slate-600">{result.disclaimer}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 최근 댓글 */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">최근 분석된 댓글 (예시)</h2>
        <div className="space-y-3">
          {MOCK_COMMENTS.map((c, i) => {
            const cfg = SENTIMENT_CONFIG[c.sentiment];
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/3 rounded-lg border border-white/5">
                <div className={`mt-0.5 p-1.5 rounded-md ${
                  c.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                  c.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-400' :
                  'bg-slate-500/10 text-slate-400'
                }`}>
                  <Icon size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{c.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge color={cfg.color}>{cfg.label}</Badge>
                    <span className="text-xs text-slate-500">신뢰도 {Math.round(c.confidence * 100)}%</span>
                    {c.keywords.map((k, j) => <span key={j} className="text-xs text-slate-600">#{k}</span>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
