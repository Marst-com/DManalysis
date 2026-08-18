import { useState } from 'react';
import { Globe, Plus, Trash2, Edit2, Key, Users, ChevronRight } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { Modal, Input, Btn, Badge, Table, EmptyState, LoadingState, ErrorState } from '../../components/ui/Common';
import api from '../../services/api';

export default function SitesPage() {
  const { sites, reload, setCurrent } = useSite();
  const [showCreate, setShowCreate] = useState(false);
  const [showKeys, setShowKeys] = useState(null); // siteId
  const [form, setForm] = useState({ name: '', slug: '', domain: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.name.trim() || !form.slug.trim()) { setFormError('이름과 슬러그를 입력하세요.'); return; }
    setSaving(true); setFormError('');
    try {
      await api.post('/sites', form);
      setShowCreate(false);
      setForm({ name: '', slug: '', domain: '' });
      reload();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(site) {
    if (!confirm(`"${site.name}" 사이트를 삭제하시겠습니까? 모든 데이터가 삭제됩니다.`)) return;
    try { await api.delete(`/sites/${site.id}`); reload(); }
    catch (e) { alert(e.message); }
  }

  const cols = [
    { key: 'name', label: '사이트 이름', render: (r) => (
      <div className="flex items-center gap-2">
        <Globe size={13} className="text-slate-500" />
        <span className="font-medium text-white">{r.name}</span>
      </div>
    )},
    { key: 'slug', label: '슬러그', render: (r) => <code className="text-xs text-indigo-300">{r.slug}</code> },
    { key: 'domain', label: '도메인', render: (r) => r.domain || <span className="text-slate-600">—</span> },
    { key: 'accessRole', label: '역할', render: (r) => <Badge color="indigo">{r.accessRole}</Badge> },
    { key: 'active', label: '상태', render: (r) => <Badge color={r.active ? 'emerald' : 'slate'}>{r.active ? '활성' : '비활성'}</Badge> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => setShowKeys(r.id)} className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors" title="API 키 관리">
          <Key size={13} />
        </button>
        <button onClick={() => setCurrent(r)} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors" title="선택">
          <ChevronRight size={13} />
        </button>
        <button onClick={() => handleDelete(r)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors" title="삭제">
          <Trash2 size={13} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Sites</h1>
          <p className="text-sm text-slate-400 mt-0.5">등록된 사이트 관리</p>
        </div>
        <Btn onClick={() => setShowCreate(true)}>
          <Plus size={14} /> 사이트 추가
        </Btn>
      </div>

      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        {sites.length === 0
          ? <EmptyState title="등록된 사이트가 없습니다" desc="사이트를 추가하고 Analytics SDK를 설치하세요." action={<Btn onClick={() => setShowCreate(true)}><Plus size={13} /> 첫 사이트 추가</Btn>} />
          : <Table cols={cols} rows={sites} />
        }
      </div>

      {/* API Keys Panel */}
      {showKeys && <ApiKeysPanel siteId={showKeys} onClose={() => setShowKeys(null)} />}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="사이트 추가">
        <div className="space-y-4">
          <Input label="사이트 이름 *" placeholder="DuoMarst Games" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} error={formError} />
          <Input label="슬러그 *" placeholder="duomarst-games (소문자, 숫자, 하이픈)" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))} />
          <Input label="도메인 (선택)" placeholder="games.duomarst.com" value={form.domain} onChange={(e) => setForm(f => ({ ...f, domain: e.target.value }))} />
          <div className="flex gap-2 pt-1">
            <Btn onClick={handleCreate} loading={saving}>추가</Btn>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>취소</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ApiKeysPanel({ siteId, onClose }) {
  const { data, loading, error, refetch } = useApi(`/sites/${siteId}/keys`, [siteId]);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);

  const keys = data?.keys || [];

  async function createKey() {
    setCreating(true);
    try {
      const res = await api.post(`/sites/${siteId}/keys`, { label: '새 키' });
      setNewKey(res.rawKey);
      refetch();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function revokeKey(keyId) {
    if (!confirm('이 키를 비활성화하시겠습니까?')) return;
    try { await api.delete(`/sites/${siteId}/keys/${keyId}`); refetch(); }
    catch (e) { alert(e.message); }
  }

  const keyCols = [
    { key: 'label', label: '이름' },
    { key: 'active', label: '상태', render: (r) => <Badge color={r.active ? 'emerald' : 'slate'}>{r.active ? '활성' : '비활성'}</Badge> },
    { key: 'expiresAt', label: '만료', render: (r) => r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('ko') : '없음' },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={() => revokeKey(r.id)} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">비활성화</button>
    )},
  ];

  return (
    <Modal open onClose={onClose} title="API 키 관리">
      <div className="space-y-4">
        {newKey && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-xs text-emerald-400 font-medium mb-1">새 API 키 — 지금만 표시됩니다!</p>
            <code className="text-xs text-white break-all">{newKey}</code>
            <p className="text-xs text-slate-500 mt-1">복사해서 SDK data-key에 넣으세요.</p>
          </div>
        )}
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : <Table cols={keyCols} rows={keys} empty="API 키 없음" />}
        <div className="flex gap-2 pt-1">
          <Btn onClick={createKey} loading={creating}><Key size={13} /> 새 키 발급</Btn>
          <Btn variant="secondary" onClick={onClose}>닫기</Btn>
        </div>
      </div>
    </Modal>
  );
}
