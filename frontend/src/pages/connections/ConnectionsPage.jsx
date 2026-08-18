import { useState } from 'react';
import { Link2, Database, Webhook, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useApi } from '../../hooks/useApi';
import { Modal, Input, Btn, Select, Badge } from '../../components/ui/Common';
import api from '../../services/api';

const DB_TYPES = [
  { value: 'firebase', label: 'Firebase (Firestore)', icon: '🔥', desc: '실시간 NoSQL DB' },
  { value: 'supabase', label: 'Supabase (PostgreSQL)', icon: '⚡', desc: '오픈소스 PostgreSQL' },
  { value: 'memory', label: 'Memory (개발용)', icon: '💾', desc: '서버 재시작 시 초기화' },
];

function ConnectionCard({ title, icon, status, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-[#1e2235] border border-white/10 hover:border-white/20 rounded-xl p-5 text-left transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl">{icon}</div>
          <div>
            <div className="text-sm font-medium text-white">{title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <Badge color="emerald">연결됨</Badge>
          ) : (
            <Badge color="slate">미설정</Badge>
          )}
          <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

export default function ConnectionsPage() {
  const { current } = useSite();
  const { data: dbConfig, refetch } = useApi(
    current ? `/sites/${current.id}/db-config` : null,
    [current?.id]
  );

  const [showDbModal, setShowDbModal] = useState(false);
  const [dbType, setDbType] = useState('firebase');
  const [creds, setCreds] = useState({ projectId: '', clientEmail: '', privateKey: '', url: '', serviceRoleKey: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentConfig = dbConfig?.config;

  async function saveDbConfig() {
    setSaving(true); setError('');
    try {
      const credentials = dbType === 'firebase'
        ? { projectId: creds.projectId, clientEmail: creds.clientEmail, privateKey: creds.privateKey }
        : dbType === 'supabase'
        ? { url: creds.url, serviceRoleKey: creds.serviceRoleKey }
        : {};
      await api.put(`/sites/${current.id}/db-config`, { type: dbType, credentials });
      setShowDbModal(false);
      refetch();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!current) return <div className="flex items-center justify-center h-64"><p className="text-slate-500 text-sm">사이트를 먼저 선택하세요.</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Connections</h1>
        <p className="text-sm text-slate-400 mt-0.5">{current.name} — 외부 서비스 연동</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">데이터베이스</h2>
        <ConnectionCard
          title="사이트별 DB 연결"
          icon={currentConfig?.type === 'firebase' ? '🔥' : currentConfig?.type === 'supabase' ? '⚡' : '💾'}
          status={currentConfig ? 'connected' : 'none'}
          desc={currentConfig ? `${currentConfig.type} — 마지막 업데이트 ${new Date(currentConfig.updatedAt).toLocaleDateString('ko')}` : '이 사이트 전용 DB를 연결하세요'}
          onClick={() => setShowDbModal(true)}
        />
      </div>

      {/* SDK 설치 가이드 */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">SDK 설치</h2>
        <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-3">HTML 파일 &lt;head&gt;에 추가하세요:</p>
          <div className="bg-[#0f1117] rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <span className="text-slate-600">{'<script>'}</span><br />
            {'(function(w,d){'}<br />
            {'  w._dm = w._dm || { q: [] };'}<br />
            {'  var s = d.createElement("script");'}<br />
            {`  s.src = "${window.location.origin.replace('localhost:5173', 'YOUR_APP.onrender.com')}/sdk/dm.js";`}<br />
            {'  s.async = true;'}<br />
            {'  s.dataset.key = "YOUR_API_KEY"; // Connections > API Keys'}<br />
            {'  d.head.appendChild(s);'}<br />
            {'})(window, document);'}<br />
            <span className="text-slate-600">{'</script>'}</span>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            API 키는 <span className="text-indigo-400">Settings → API Keys</span> 에서 발급하세요.
            키가 노출돼도 관리자 권한은 없습니다.
          </p>
        </div>
      </div>

      {/* Webhook 설정 */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Webhook</h2>
        <div className="bg-[#1e2235] border border-white/10 rounded-xl p-5">
          <p className="text-sm text-slate-300 mb-2">Alert 트리거 시 외부 URL에 알림을 보냅니다.</p>
          <p className="text-xs text-slate-500">Alerts 메뉴에서 규칙을 만들 때 Webhook URL을 설정할 수 있습니다.</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
            <AlertCircle size={12} />
            <span>Webhook URL은 반드시 HTTPS여야 하며, 사설 IP(192.168.x.x 등)는 허용되지 않습니다.</span>
          </div>
        </div>
      </div>

      {/* DB Config Modal */}
      <Modal open={showDbModal} onClose={() => setShowDbModal(false)} title="사이트별 DB 연결">
        <div className="space-y-4">
          <Select
            label="DB 유형"
            value={dbType}
            onChange={(e) => setDbType(e.target.value)}
            options={DB_TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
          />

          {dbType === 'firebase' && (
            <>
              <Input label="Project ID" placeholder="my-project-id" value={creds.projectId} onChange={(e) => setCreds(c => ({ ...c, projectId: e.target.value }))} />
              <Input label="Client Email" placeholder="firebase-adminsdk@..." value={creds.clientEmail} onChange={(e) => setCreds(c => ({ ...c, clientEmail: e.target.value }))} />
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Private Key</label>
                <textarea
                  rows={3}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                  value={creds.privateKey}
                  onChange={(e) => setCreds(c => ({ ...c, privateKey: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none font-mono"
                />
              </div>
            </>
          )}

          {dbType === 'supabase' && (
            <>
              <Input label="Project URL" placeholder="https://xxx.supabase.co" value={creds.url} onChange={(e) => setCreds(c => ({ ...c, url: e.target.value }))} />
              <Input label="Service Role Key" placeholder="eyJhbGciOiJIUzI1NiJ9..." value={creds.serviceRoleKey} onChange={(e) => setCreds(c => ({ ...c, serviceRoleKey: e.target.value }))} type="password" />
            </>
          )}

          {dbType === 'memory' && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              개발/테스트용입니다. 서버 재시작 시 데이터가 초기화됩니다.
            </div>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="text-xs text-slate-500 bg-white/3 rounded-lg p-3">
            🔒 입력한 자격증명은 AES-256-GCM으로 암호화되어 서버에 저장됩니다. 프론트엔드에 절대 노출되지 않습니다.
          </div>

          <div className="flex gap-2 pt-1">
            <Btn onClick={saveDbConfig} loading={saving}>저장</Btn>
            <Btn variant="secondary" onClick={() => setShowDbModal(false)}>취소</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
