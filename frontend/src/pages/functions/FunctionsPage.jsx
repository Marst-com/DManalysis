import { useState } from 'react';
import { Zap, Plus, Trash2, Edit2, Activity, Users, Calendar } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { LoadingState, ErrorState, EmptyState, Modal, Input, Btn, Badge } from '../../components/ui/Common';
import api from '../../services/api';

function FunctionCard({ fn, onDelete, onEdit }) {
  return (
    <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Zap size={14} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-mono font-medium text-white">{fn.name}</div>
            <div className="text-xs text-slate-500">{fn.label}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(fn)} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(fn)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {fn.description && (
        <p className="text-xs text-slate-500 mb-3">{fn.description}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Activity, label: '총 실행', value: fn.totalExecutions?.toLocaleString() || '0' },
          { icon: Calendar, label: '오늘', value: fn.executionsToday?.toLocaleString() || '0' },
          { icon: Users, label: '고유 사용자', value: fn.uniqueUsers?.toLocaleString() || '0' },
        ].map((s, i) => (
          <div key={i} className="bg-white/3 rounded-lg p-2.5 text-center">
            <s.icon size={12} className="text-slate-500 mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">{s.value}</div>
            <div className="text-xs text-slate-600">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-white/5">
        <code className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">
          analytics.track("{fn.name}")
        </code>
      </div>
    </div>
  );
}

export default function FunctionsPage() {
  const { current } = useSite();
  const { data, loading, error, refetch } = useApi(
    current ? `/functions/${current.id}` : null,
    [current?.id]
  );

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', label: '', description: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const functions = data?.functions || [];

  async function handleCreate() {
    if (!form.name.trim()) { setFormError('함수 이름을 입력하세요.'); return; }
    setSaving(true); setFormError('');
    try {
      await api.post(`/functions/${current.id}`, form);
      setShowCreate(false);
      setForm({ name: '', label: '', description: '' });
      refetch();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(fn) {
    if (!confirm(`"${fn.name}" 함수를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/functions/${current.id}/${fn.name}`);
      refetch();
    } catch (e) {
      alert(e.message);
    }
  }

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Functions</h1>
          <p className="text-sm text-slate-400 mt-0.5">{current.name} — 커스텀 이벤트 추적</p>
        </div>
        <Btn onClick={() => setShowCreate(true)}>
          <Plus size={14} /> 함수 추가
        </Btn>
      </div>

      {/* SDK 사용법 */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-xs text-indigo-300 font-medium mb-2">SDK 사용법</p>
        <code className="text-xs text-slate-300 block">
          {'// 사이트 HTML에 추가 (실제 키는 대시보드 → Connections에서 확인)'}
          <br />
          {'duomarst.track("clickbutton");'}
          <br />
          {'duomarst.track("watch_complete", { videoId: "VIDEO_ID" });'}
        </code>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> :
        functions.length === 0 ? (
          <EmptyState
            title="등록된 함수가 없습니다"
            desc="함수를 추가하고 SDK로 이벤트를 추적하세요."
            action={<Btn onClick={() => setShowCreate(true)}><Plus size={13} /> 첫 함수 추가</Btn>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {functions.map((fn) => (
              <FunctionCard key={fn.id} fn={fn} onDelete={handleDelete} onEdit={() => {}} />
            ))}
          </div>
        )
      }

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="함수 추가">
        <div className="space-y-4">
          <Input
            label="함수 이름 *"
            placeholder="clickbutton (영문, 숫자, _, - 만 가능)"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value.toLowerCase() }))}
            error={formError}
          />
          <Input
            label="표시 이름"
            placeholder="버튼 클릭"
            value={form.label}
            onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
          />
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">설명</label>
            <textarea
              rows={2}
              placeholder="이 함수가 추적하는 내용..."
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Btn onClick={handleCreate} loading={saving}>추가</Btn>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>취소</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
