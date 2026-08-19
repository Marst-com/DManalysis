import { useState } from 'react';
import { Settings, Shield, Key, Lock, FileText, Trash2, Plus, Eye, EyeOff, Users, RefreshCw, Copy, Check } from 'lucide-react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { Input, Btn, Badge, Table, LoadingState, ErrorState, Modal } from '../../components/ui/Common';
import api from '../../services/api';

// ─── Sub-nav ────────────────────────────────────────────────────────────────
export function SettingsLayout() {
  const nav = [
    { to: '/settings/general', label: 'General', icon: Settings },
    { to: '/settings/security', label: 'Security', icon: Shield },
    { to: '/settings/team', label: '팀 & 초대', icon: Users },
    { to: '/settings/api-keys', label: 'API Keys', icon: Key },
    { to: '/settings/secrets', label: 'Secrets', icon: Lock },
    { to: '/settings/audit-logs', label: 'Audit Logs', icon: FileText },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">플랫폼 및 사이트 설정</p>
      </div>
      <div className="flex gap-1 border-b border-white/10 pb-0 -mb-2 overflow-x-auto">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                isActive ? 'text-indigo-400 border-indigo-500' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`
            }
          >
            <n.icon size={12} />{n.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

// ─── General ────────────────────────────────────────────────────────────────
export function GeneralSettings() {
  const { current } = useSite();
  const [name, setName] = useState(current?.name || '');
  const [domain, setDomain] = useState(current?.domain || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!current) return;
    setSaving(true);
    try {
      await api.put(`/sites/${current.id}`, { name, domain });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-white">그룹(사이트) 정보</h2>
        {current ? (
          <>
            <Input label="그룹 이름" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">슬러그</label>
              <div className="text-sm text-slate-500 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                {current.slug} <span className="text-xs ml-2 text-slate-600">(변경 불가)</span>
              </div>
            </div>
            <Input label="도메인" placeholder="games.example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <Btn onClick={save} loading={saving}>{saved ? '✓ 저장됨' : '저장'}</Btn>
          </>
        ) : <p className="text-slate-500 text-sm">그룹을 선택하세요.</p>}
      </div>
    </div>
  );
}

// ─── Security ───────────────────────────────────────────────────────────────
export function SecuritySettings() {
  return (
    <div className="space-y-4 max-w-lg">
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-white">보안 설정</h2>
        <div className="space-y-3">
          {[
            { label: 'HTTPS only', status: true, desc: 'API는 HTTPS를 통해서만 접근됩니다.' },
            { label: 'Rate Limiting', status: true, desc: '요청당 분당 100건으로 제한됩니다.' },
            { label: 'AES-256 암호화', status: true, desc: '모든 시크릿은 AES-256-GCM으로 암호화됩니다.' },
            { label: 'CORS 제한', status: true, desc: '등록된 도메인에서만 이벤트를 수신합니다.' },
            { label: 'JWT 토큰 (15분)', status: true, desc: 'Access token은 15분마다 갱신됩니다.' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div>
                <div className="text-sm text-slate-200">{item.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
              </div>
              <Badge color={item.status ? 'emerald' : 'rose'}>{item.status ? '활성' : '비활성'}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Team & Invite ───────────────────────────────────────────────────────────
export function TeamSettings() {
  const { current } = useSite();
  const { data: membersData, loading, error, refetch } = useApi(
    current ? `/sites/${current.id}/members` : null, [current?.id]
  );
  const [inviteCode, setInviteCode] = useState(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);

  const members = membersData?.members || [];

  async function loadInviteCode() {
    if (!current) return;
    setLoadingCode(true);
    try {
      const res = await api.get(`/auth/group/${current.id}/invite`);
      setInviteCode(res.inviteCode);
    } catch (e) { alert(e.message); }
    finally { setLoadingCode(false); }
  }

  async function rotateCode() {
    if (!confirm('초대코드를 재발급하면 기존 코드는 사용할 수 없습니다. 계속하시겠습니까?')) return;
    setRotating(true);
    try {
      const res = await api.post(`/auth/group/${current.id}/invite/rotate`);
      setInviteCode(res.inviteCode);
    } catch (e) { alert(e.message); }
    finally { setRotating(false); }
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function changeMemberRole(userId, role) {
    try {
      await api.post(`/sites/${current.id}/members`, { userId, role });
      refetch();
    } catch (e) { alert(e.message); }
  }

  async function removeMember(userId) {
    if (!confirm('이 멤버를 그룹에서 제거하시겠습니까?')) return;
    try {
      await api.delete(`/sites/${current.id}/members/${userId}`);
      refetch();
    } catch (e) { alert(e.message); }
  }

  const roleColors = { OWNER: 'indigo', ADMIN: 'violet', ANALYST: 'amber', VIEWER: 'slate' };

  const memberCols = [
    { key: 'userId', label: '사용자 ID', render: (r) => <span className="font-mono text-xs text-slate-400">{r.userId.slice(0, 12)}...</span> },
    { key: 'role', label: '역할', render: (r) => (
      <select
        value={r.role}
        onChange={(e) => changeMemberRole(r.userId, e.target.value)}
        className="bg-transparent text-xs border-0 focus:outline-none cursor-pointer"
      >
        {['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'].map(role => (
          <option key={role} value={role}>{role}</option>
        ))}
      </select>
    )},
    { key: 'grantedAt', label: '참여일', render: (r) => new Date(r.grantedAt).toLocaleDateString('ko') },
    { key: 'actions', label: '', render: (r) => (
      r.role !== 'OWNER' && (
        <button onClick={() => removeMember(r.userId)}
          className="text-xs text-rose-400 hover:text-rose-300 transition-colors">
          제거
        </button>
      )
    )},
  ];

  if (!current) return <p className="text-slate-500 text-sm">그룹을 선택하세요.</p>;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* 초대코드 */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">초대코드</h2>
        <p className="text-xs text-slate-500 mb-4">
          팀원에게 초대코드를 공유하면 회원가입 후 이 그룹에 자동으로 참여할 수 있습니다.
        </p>

        {!inviteCode ? (
          <Btn onClick={loadInviteCode} loading={loadingCode} variant="secondary">
            <Key size={13} /> 초대코드 확인
          </Btn>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3 font-mono text-lg font-bold text-indigo-300 tracking-[0.3em] text-center">
                {inviteCode}
              </div>
              <button
                onClick={copyCode}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="복사"
              >
                {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Btn onClick={rotateCode} loading={rotating} variant="secondary" size="sm">
                <RefreshCw size={12} /> 재발급
              </Btn>
              <span className="text-xs text-slate-600">재발급 시 기존 코드 무효화</span>
            </div>
          </div>
        )}
      </div>

      {/* 멤버 목록 */}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">멤버 ({members.length}명)</h2>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
          <Table cols={memberCols} rows={members} empty="멤버가 없습니다." />
        )}
      </div>
    </div>
  );
}

// ─── API Keys ───────────────────────────────────────────────────────────────
export function ApiKeysSettings() {
  const { current } = useSite();
  const { data, loading, error, refetch } = useApi(current ? `/sites/${current.id}/keys` : null, [current?.id]);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [label, setLabel] = useState('');

  const keys = data?.keys || [];

  async function createKey() {
    if (!current) return;
    setCreating(true);
    try {
      const res = await api.post(`/sites/${current.id}/keys`, { label: label || '새 키' });
      setNewKey(res.rawKey);
      setLabel('');
      refetch();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  const cols = [
    { key: 'label', label: '이름' },
    { key: 'active', label: '상태', render: (r) => <Badge color={r.active ? 'emerald' : 'slate'}>{r.active ? '활성' : '비활성'}</Badge> },
    { key: 'createdAt', label: '발급일', render: (r) => new Date(r.createdAt).toLocaleDateString('ko') },
    { key: 'expiresAt', label: '만료', render: (r) => r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('ko') : '없음' },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={async () => {
        if (!confirm('이 키를 비활성화하시겠습니까?')) return;
        await api.delete(`/sites/${current.id}/keys/${r.id}`);
        refetch();
      }} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">비활성화</button>
    )},
  ];

  if (!current) return <p className="text-slate-500 text-sm">그룹을 선택하세요.</p>;

  return (
    <div className="space-y-4">
      {newKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs text-emerald-400 font-medium mb-2">🔑 새 API 키 — 지금만 표시됩니다!</p>
          <code className="text-sm text-white break-all block bg-black/20 p-3 rounded-lg">{newKey}</code>
          <p className="text-xs text-slate-500 mt-2">이 키를 SDK의 <code>data-key</code> 속성에 넣으세요.</p>
        </div>
      )}
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">API 키</h2>
          <div className="flex gap-2 items-center">
            <input placeholder="키 이름" value={label} onChange={(e) => setLabel(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none w-32" />
            <Btn size="sm" onClick={createKey} loading={creating}><Plus size={12} /> 발급</Btn>
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : <Table cols={cols} rows={keys} empty="발급된 API 키가 없습니다." />}
      </div>
    </div>
  );
}

// ─── Secrets ────────────────────────────────────────────────────────────────
export function SecretsSettings() {
  const { current } = useSite();
  const { data, loading, error, refetch } = useApi(current ? `/sites/${current.id}/secrets` : null, [current?.id]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ placeholder: '', value: '', label: '' });
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const secrets = data?.secrets || [];

  async function save() {
    setSaving(true); setFormError('');
    try {
      await api.put(`/sites/${current.id}/secrets/${form.placeholder.toUpperCase()}`, { value: form.value, label: form.label });
      setShowAdd(false);
      setForm({ placeholder: '', value: '', label: '' });
      refetch();
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  const cols = [
    { key: 'placeholder', label: 'Placeholder', render: (r) => <code className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{r.placeholder}</code> },
    { key: 'label', label: '설명' },
    { key: 'updatedAt', label: '수정일', render: (r) => new Date(r.updatedAt).toLocaleDateString('ko') },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={async () => {
        if (!confirm(`"${r.placeholder}" 시크릿을 삭제하시겠습니까?`)) return;
        await api.delete(`/sites/${current.id}/secrets/${r.placeholder}`);
        refetch();
      }} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">삭제</button>
    )},
  ];

  if (!current) return <p className="text-slate-500 text-sm">그룹을 선택하세요.</p>;

  return (
    <div className="space-y-4">
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 text-xs text-slate-300">
        <span className="text-indigo-300 font-medium">Secret이란?</span>{' '}
        코드에 <code className="bg-white/10 px-1 rounded">"GEMINI_KEY"</code> 같은 플레이스홀더를 쓰고, 실제 키를 여기 등록하면 백엔드에서 자동 치환합니다.
        실제 값은 AES-256-GCM 암호화 저장되며 프론트엔드에 절대 노출되지 않습니다.
      </div>
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">Secret Keys</h2>
          <Btn size="sm" onClick={() => setShowAdd(true)}><Plus size={12} /> 추가</Btn>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : <Table cols={cols} rows={secrets} empty="등록된 Secret이 없습니다." />}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Secret 추가">
        <div className="space-y-4">
          <Input label="Placeholder (대문자, 숫자, _)" placeholder="GEMINI_KEY" value={form.placeholder}
            onChange={(e) => setForm(f => ({ ...f, placeholder: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} />
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">실제 값 *</label>
            <div className="relative">
              <input type={showValue ? 'text' : 'password'} placeholder="AIzaSy..." value={form.value}
                onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
              <button onClick={() => setShowValue(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <Input label="설명 (선택)" placeholder="Gemini API Key" value={form.label}
            onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} />
          {formError && <p className="text-xs text-rose-400">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <Btn onClick={save} loading={saving}>저장</Btn>
            <Btn variant="secondary" onClick={() => setShowAdd(false)}>취소</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────
export function AuditLogsSettings() {
  const { current } = useSite();
  const [action, setAction] = useState('');
  const { data, loading, error, refetch } = useApi(
    current ? `/audit/${current.id}?limit=100${action ? `&action=${action}` : ''}` : null,
    [current?.id, action]
  );

  const entries = data?.entries || [];
  const resultColor = { SUCCESS: 'emerald', FAIL: 'rose', WARNING: 'amber' };

  const cols = [
    { key: 'ts', label: '시간', render: (r) => <span className="text-xs font-mono">{new Date(r.ts).toLocaleString('ko')}</span> },
    { key: 'action', label: '액션', render: (r) => <Badge color="indigo">{r.action}</Badge> },
    { key: 'result', label: '결과', render: (r) => <Badge color={resultColor[r.result] || 'slate'}>{r.result}</Badge> },
    { key: 'actorId', label: '사용자', render: (r) => <span className="text-xs font-mono text-slate-400">{r.actorId?.slice(0, 8) || '—'}...</span> },
  ];

  if (!current) return <p className="text-slate-500 text-sm">그룹을 선택하세요.</p>;

  return (
    <div className="space-y-4">
      <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">감사 로그</h2>
          <div className="flex gap-2 items-center">
            <input placeholder="액션 필터 (예: GROUP_JOIN)" value={action}
              onChange={(e) => setAction(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none w-48" />
            <Btn size="sm" variant="secondary" onClick={refetch}>적용</Btn>
          </div>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
          <Table cols={cols} rows={entries} empty="로그가 없습니다." />
        )}
      </div>
    </div>
  );
}
