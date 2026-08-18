import { useState } from 'react';
import { Bot, Sparkles, TrendingUp, FileText, Upload } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { Btn, Badge, Input } from '../../components/ui/Common';
import api from '../../services/api';

function AiCard({ icon: Icon, title, desc, children }) {
  return (
    <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <Icon size={15} className="text-indigo-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="text-xs text-slate-500">{desc}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function AiPage() {
  const { current } = useSite();

  // Comment analysis
  const [commentText, setCommentText] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Batch
  const [batchText, setBatchText] = useState('');
  const [batchResults, setBatchResults] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  async function analyzeOne() {
    if (!commentText.trim() || !current) return;
    setAnalyzing(true); setError(''); setResult(null);
    try {
      const body = { text: commentText.trim(), provider };
      if (placeholder.trim()) body.apiKeyPlaceholder = placeholder.trim().toUpperCase();
      const res = await api.post(`/ai/${current.id}/analyze-comment`, body);
      setResult(res.result);
    } catch (e) { setError(e.message); }
    finally { setAnalyzing(false); }
  }

  async function analyzeBatch() {
    const lines = batchText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length || !current) return;
    setBatchLoading(true); setBatchResults([]);
    try {
      const body = { comments: lines.map(text => ({ text })), provider };
      if (placeholder.trim()) body.apiKeyPlaceholder = placeholder.trim().toUpperCase();
      const res = await api.post(`/ai/${current.id}/analyze-batch`, body);
      setBatchResults(res.results || []);
    } catch (e) { setError(e.message); }
    finally { setBatchLoading(false); }
  }

  const sentimentColor = { positive: 'emerald', neutral: 'slate', negative: 'rose' };

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">AI 분석</h1>
        <p className="text-sm text-slate-400 mt-0.5">{current.name} — AI 기반 인사이트</p>
      </div>

      {/* API Key 설정 안내 */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
        <Bot size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-slate-300">
          <span className="font-medium text-indigo-300">API 키 설정:</span>{' '}
          Settings → Secrets 에서 <code className="bg-white/10 px-1 rounded">GEMINI_KEY</code> 또는{' '}
          <code className="bg-white/10 px-1 rounded">OPENAI_KEY</code> 를 등록하고, 아래 Placeholder 필드에 이름을 입력하세요.
          실제 키는 백엔드에서만 사용되며 프론트엔드에 노출되지 않습니다.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI 설정 */}
        <AiCard icon={Bot} title="AI 설정" desc="Provider 및 API 키 플레이스홀더">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Provider</label>
              <div className="flex gap-2">
                {['gemini', 'openai'].map((p) => (
                  <button key={p}
                    onClick={() => setProvider(p)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      provider === p ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30' : 'text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >{p === 'gemini' ? '✨ Gemini' : '🤖 OpenAI'}</button>
                ))}
              </div>
            </div>
            <Input
              label="API 키 Placeholder (Secrets에 등록된 이름)"
              placeholder="GEMINI_KEY"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-slate-500">
              비워두면 플랫폼 기본 AI 키를 사용합니다 (없으면 503).
            </p>
          </div>
        </AiCard>

        {/* 단건 분석 */}
        <AiCard icon={Sparkles} title="댓글 감성 분석" desc="단건 실시간 분석">
          <div className="space-y-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              placeholder="분석할 댓글을 입력하세요..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <Btn onClick={analyzeOne} loading={analyzing} disabled={!commentText.trim()}>
              <Sparkles size={13} /> 분석
            </Btn>
            {result && (
              <div className="p-3 bg-white/3 rounded-lg border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge color={sentimentColor[result.sentiment]}>{result.sentiment}</Badge>
                  <span className="text-xs text-slate-400">신뢰도 {Math.round(result.confidence * 100)}%</span>
                  {result.cached && <Badge color="slate">캐시</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {Object.entries(result.scores || {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="text-xs text-slate-500 capitalize">{k}</div>
                      <div className="text-sm font-semibold text-white">{Math.round(v * 100)}%</div>
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
        </AiCard>
      </div>

      {/* 배치 분석 */}
      <AiCard icon={FileText} title="배치 분석" desc="여러 댓글을 한 번에 분석 (최대 20개)">
        <div className="space-y-3">
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={5}
            placeholder={"댓글을 줄바꿈으로 구분해 입력하세요:\n이 게임 정말 재밌어요!\n그냥 그렇네요.\n별로입니다."}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
          <Btn onClick={analyzeBatch} loading={batchLoading} disabled={!batchText.trim()}>
            <FileText size={13} /> 배치 분석
          </Btn>
          {batchResults.length > 0 && (
            <div className="space-y-2">
              {batchResults.map((r, i) => {
                const text = batchText.split('\n').filter(Boolean)[r.index];
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-white/3 rounded-lg border border-white/5">
                    <span className="text-xs text-slate-500 w-5 text-right flex-shrink-0">{r.index + 1}</span>
                    <span className="text-sm text-slate-300 flex-1 truncate">{text}</span>
                    <Badge color={sentimentColor[r.result?.sentiment]}>{r.result?.sentiment || '?'}</Badge>
                    <span className="text-xs text-slate-500 w-12 text-right">{Math.round((r.result?.confidence || 0) * 100)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AiCard>
    </div>
  );
}
