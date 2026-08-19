import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Plus, Users, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState('choice'); // choice | create | join
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 그룹 만들기
  const [groupName, setGroupName] = useState('');
  const [domain, setDomain] = useState('');
  const [createdCode, setCreatedCode] = useState('');

  // 그룹 참여
  const [inviteCode, setInviteCode] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!groupName.trim()) { setError('그룹 이름을 입력하세요.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/group/create', { name: groupName.trim(), domain: domain.trim() });
      setCreatedCode(res.inviteCode);
      setStep('created');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (inviteCode.length !== 10) { setError('초대코드는 10자리입니다.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/group/join', { inviteCode: inviteCode.trim() });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <div className="text-base font-semibold text-white">DuoMarst Analytics</div>
            <div className="text-xs text-slate-500">환영합니다, {user?.email}</div>
          </div>
        </div>

        {/* Choice */}
        {step === 'choice' && (
          <div className="space-y-3">
            <p className="text-center text-sm text-slate-400 mb-6">그룹을 만들거나 기존 그룹에 참여하세요.</p>

            <button
              onClick={() => setStep('create')}
              className="w-full bg-[#1e2235] border border-white/10 hover:border-indigo-500/50 rounded-xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Plus size={22} className="text-indigo-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white mb-0.5">그룹 만들기</div>
                  <div className="text-xs text-slate-500">새 Analytics 그룹을 생성하고 팀원을 초대하세요</div>
                </div>
                <ArrowRight size={16} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </div>
            </button>

            <button
              onClick={() => setStep('join')}
              className="w-full bg-[#1e2235] border border-white/10 hover:border-emerald-500/50 rounded-xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Users size={22} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white mb-0.5">그룹 참여</div>
                  <div className="text-xs text-slate-500">10자리 초대코드로 기존 그룹에 합류하세요</div>
                </div>
                <ArrowRight size={16} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </div>
            </button>
          </div>
        )}

        {/* Create */}
        {step === 'create' && (
          <div className="bg-[#1e2235] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => { setStep('choice'); setError(''); }} className="text-slate-500 hover:text-slate-300 text-sm">←</button>
              <h2 className="text-sm font-semibold text-white">그룹 만들기</h2>
            </div>

            {error && <div className="mb-4 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">그룹 이름 *</label>
                <input
                  value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  required placeholder="DuoMarst Games"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">도메인 (선택)</label>
                <input
                  value={domain} onChange={(e) => setDomain(e.target.value)}
                  placeholder="games.duomarst.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="text-xs text-slate-600 mt-1">나중에 설정에서 변경 가능합니다.</p>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {loading ? '생성 중...' : '그룹 생성'}
              </button>
            </form>
          </div>
        )}

        {/* Created — 초대코드 표시 */}
        {step === 'created' && (
          <div className="bg-[#1e2235] border border-white/10 rounded-xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎉</span>
            </div>
            <h2 className="text-sm font-semibold text-white mb-1">그룹이 생성됐어요!</h2>
            <p className="text-xs text-slate-500 mb-6">아래 초대코드를 팀원에게 공유하세요.</p>

            <div className="bg-[#0f1117] border border-white/10 rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-500 mb-2">초대코드</p>
              <p className="text-2xl font-mono font-bold text-indigo-300 tracking-[0.3em]">{createdCode}</p>
            </div>

            <p className="text-xs text-slate-600 mb-6">이 코드는 Settings에서 언제든지 확인하고 재발급할 수 있습니다.</p>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              대시보드로 이동
            </button>
          </div>
        )}

        {/* Join */}
        {step === 'join' && (
          <div className="bg-[#1e2235] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => { setStep('choice'); setError(''); }} className="text-slate-500 hover:text-slate-300 text-sm">←</button>
              <h2 className="text-sm font-semibold text-white">그룹 참여</h2>
            </div>

            {error && <div className="mb-4 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400">{error}</div>}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">초대코드 (10자리)</label>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.slice(0, 10))}
                  required maxLength={10}
                  placeholder="Ab3Xy7Pq2Z"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono tracking-widest text-center"
                />
                <p className="text-xs text-slate-600 mt-1 text-center">{inviteCode.length}/10</p>
              </div>
              <button
                type="submit" disabled={loading || inviteCode.length !== 10}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {loading ? '참여 중...' : '그룹 참여'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
