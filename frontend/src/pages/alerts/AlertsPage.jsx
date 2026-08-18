import { useState } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { Modal, Input, Select, Btn, Badge, LoadingState, ErrorState, EmptyState, Table } from '../../components/ui/Common';
import api from '../../services/api';

const METRICS = [
  { value: 'visitors', label: '방문자 수' },
  { value: 'events', label: '이벤트 수' },
  { value: 'unique_sessions', label: '고유 세션' },
  { value: 'error_rate', label: '에러율 (%)' },
];
const OPERATORS = [
  { value: '>', label: '초과 (>)' },
  { value: '>=', label: '이상 (>=)' },
  { value: '<', label: '미만 (<)' },
  { value: '<=', label: '이하 (<=)' },
];

function RuleCard({ rule, onToggle, onDelete }) {
  return (
    <div className={`bg-[#1e2235] border rounded-xl p-5 transition-all ${rule.active ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${rule.active ? 'bg-amber-500/10' : 'bg-white/5'}`}>
            <Bell size={14} className={rule.active ? 'text-amber-400' : 'text-slate-600'} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{rule.name}</div>
            <div className="text-xs text-slate-500">
              {METRICS.find(m => m.value === rule.metric)?.label} {rule.operator} {rule.threshold} / {rule.windowMinutes}분
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onToggle(rule)} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors">
            {rule.active ? <ToggleRight size={16} className="text-indigo-400" /> : <ToggleLeft size={16} />}
          </button>
          <button onClick={() => onDelete(rule)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {rule.channels.map((c, i) => <Badge key={i} color={c === 'webhook' ? 'indigo' : 'slate'}>{c}</Badge>)}
        {rule.lastTriggeredAt && (
          <span className="text-xs text-slate-500">마지막 트리거: {new Date(rule.lastTriggeredAt).toLocaleString('ko')}</span>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { current } = useSite();
  const { data: rulesData, loading, error, refetch } = useApi(current ? `/alerts/${current.id}/rules` : null, [current?.id]);
  const { data: histData } = useApi(current ? `/alerts/${current.id}/history?limit=20` : null, [current?.id]);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', metric: 'visitors', operator: '>', threshold: '100', windowMinutes: '10', channels: ['dashboard'], webhookUrl: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const rules = rulesData?.rules || [];
  const history = histData?.alerts || [];

  async function handleCreate() {
    setSaving(true); setFormError('');
    try {
      await api.post(`/alerts/${current.id}/rules`, {
        ...form,
        threshold: parseFloat(form.threshold),
        windowMinutes: parseInt(form.windowMinutes, 10),
      });
      setShowCreate(false);
      refetch();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleToggle(rule) {
    try { await api.put(`/alerts/${current.id}/rules/${rule.id}`, { active: !rule.active }); refetch(); }
    catch (e) { alert(e.message); }
  }

  async function handleDelete(rule) {
    if (!confirm(`"${rule.name}" 규칙을 삭제하시겠습니까?`)) return;
    try { await api.delete(`/alerts/${current.id}/rules/${rule.id}`); refetch(); }
    catch (e) { alert(e.message); }
  }

  const histCols = [
    { key: 'ruleName', label: '규칙' },
    { key: 'metric', label: '지표', render: (r) => <Badge color="amber">{r.metric}</Badge> },
    { key: 'actualValue', label: '실제 값', render: (r) => <span className="text-rose-400 font-medium">{r.actualValue}</span> },
    { key: 'threshold', label: '임계값', render: (r) => r.threshold },
    { key: 'triggeredAt', label: '시간', render: (r) => new Date(r.triggeredAt).toLocaleString('ko') },
  ];

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Alerts</h1>
          <p className="text-sm text-slate-400 mt-0.5">{current.name} — 이상 탐지 규칙</p>
        </div>
        <Btn onClick={() => setShowCreate(true)}><Plus size={14} /> 규칙 추가</Btn>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> :
        rules.length === 0
          ? <EmptyState title="등록된 규칙이 없습니다" desc="방문자 급증, 에러율 증가 등을 감지할 규칙을 만드세요." action={<Btn onClick={() => setShowCreate(true)}><Plus size={13} /> 첫 규칙 추가</Btn>} />
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((r) => <RuleCard key={r.id} rule={r} onToggle={handleToggle} onDelete={handleDelete} />)}
            </div>
      }

      {/* Alert history */}
      {history.length > 0 && (
        <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-amber-400" />
            <h2 className="text-sm font-medium text-white">최근 알림</h2>
          </div>
          <Table cols={histCols} rows={history} />
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="알림 규칙 추가">
        <div className="space-y-4">
          <Input label="규칙 이름 *" placeholder="방문자 급증" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="지표" value={form.metric} onChange={(e) => setForm(f => ({ ...f, metric: e.target.value }))} options={METRICS} />
            <Select label="연산자" value={form.operator} onChange={(e) => setForm(f => ({ ...f, operator: e.target.value }))} options={OPERATORS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="임계값" type="number" value={form.threshold} onChange={(e) => setForm(f => ({ ...f, threshold: e.target.value }))} />
            <Input label="기간 (분)" type="number" value={form.windowMinutes} onChange={(e) => setForm(f => ({ ...f, windowMinutes: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">알림 채널</label>
            <div className="flex gap-2">
              {['dashboard', 'webhook'].map((ch) => (
                <button key={ch}
                  onClick={() => setForm(f => ({
                    ...f,
                    channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch]
                  }))}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    form.channels.includes(ch) ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30' : 'text-slate-400 border-white/10 hover:bg-white/5'
                  }`}
                >{ch}</button>
              ))}
            </div>
          </div>
          {form.channels.includes('webhook') && (
            <Input label="Webhook URL (HTTPS 필수)" placeholder="https://your-server.com/hook" value={form.webhookUrl} onChange={(e) => setForm(f => ({ ...f, webhookUrl: e.target.value }))} />
          )}
          {formError && <p className="text-xs text-rose-400">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <Btn onClick={handleCreate} loading={saving}>추가</Btn>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>취소</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
