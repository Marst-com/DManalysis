import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart2, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/register', { email: email.trim(), password });
      // 가입 성공 → 로그인 후 그룹 선택으로
      const loginRes = await api.post('/auth/login', { email: email.trim(), password });
      const { setAccessToken } = await import('../services/api');
      setAccessToken(loginRes.accessToken);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <div className="text-base font-semibold text-white leading-tight">DuoMarst Analytics</div>
            <div className="text-xs text-slate-500">계정 만들기</div>
          </div>
        </div>

        <div className="bg-[#1e2235] border border-white/10 rounded-xl p-6">
          <h1 className="text-sm font-semibold text-white mb-5">회원가입</h1>

          {error && (
            <div className="mb-4 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">이메일</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="new-password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="8자 이상, 대문자+숫자 포함"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {/* 비밀번호 강도 표시 */}
              <PasswordStrength password={password} />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">비밀번호 확인</label>
              <input
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required autoComplete="new-password"
                className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                  confirm && password !== confirm ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'
                }`}
                placeholder="비밀번호 재입력"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-4">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [
    { label: '8자 이상', ok: password.length >= 8 },
    { label: '대문자', ok: /[A-Z]/.test(password) },
    { label: '숫자', ok: /[0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500'];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : 'bg-white/10'}`} />
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {checks.map((c, i) => (
          <span key={i} className={`text-xs ${c.ok ? 'text-emerald-400' : 'text-slate-600'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
