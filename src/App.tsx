import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Users,
  CalendarCheck,
  CheckSquare,
  Trophy,
  Megaphone,
  Wallet,
  LayoutDashboard,
  CheckCircle2,
  LogOut,
  LogIn
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithPin, logout, testFirestoreConnection, handleRedirectResult } from './firebase';
import { useUserRole } from './hooks/useUserRole';
import Onboarding from './components/Onboarding';
import MeetingBoard from './components/MeetingBoard';
import MissionBoard from './components/MissionBoard';
import MemberBoard from './components/MemberBoard';
import NoticeBoard from './components/NoticeBoard';
import AccountingBoard from './components/AccountingBoard';
import RankingBoard from './components/RankingBoard';
import AdminSettings from './components/AdminSettings';
import ProfileSettings from './components/ProfileSettings';
import { Settings } from 'lucide-react';

function LoginScreen({ onError }: { onError: (msg: string | null) => void }) {
  const [mode, setMode] = useState<'select' | 'pin'>('select');
  const [pinId, setPinId] = useState('');
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      onError(null);
      await loginWithGoogle();
    } catch (e: any) {
      let msg = `로그인 중 문제가 발생했습니다: ${e.message || '알 수 없는 오류'}`;
      if (e.code === 'auth/unauthorized-domain') msg = `도메인(${window.location.hostname})이 Firebase 승인 도메인에 없습니다.`;
      else if (e.code === 'auth/popup-blocked') msg = '팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.';
      else if (e.code === 'auth/popup-closed-by-user') msg = '로그인 창이 닫혔습니다. 다시 시도해 주세요.';
      else if (e.code === 'auth/network-request-failed') msg = '네트워크 연결 상태를 확인해 주세요.';
      onError(msg);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!pinId.trim()) return setPinError('아이디를 입력해주세요.');
    if (!/^[a-zA-Z0-9가-힣]+$/.test(pinId.trim())) return setPinError('아이디는 영문, 숫자, 한글만 사용 가능합니다.');
    if (pin.length !== 6) return setPinError('PIN은 6자리 숫자여야 합니다.');
    setPinLoading(true);
    try {
      await loginWithPin(pinId, pin);
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setPinError('PIN이 틀렸습니다.');
      } else if (e.code === 'auth/too-many-requests') {
        setPinError('시도 횟수 초과. 잠시 후 다시 시도해주세요.');
      } else {
        setPinError(`오류: ${e.message}`);
      }
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0f172a] p-4 font-sans">
      <div className="bg-[#1e293b] p-8 rounded-xl shadow-2xl border border-slate-800 text-center max-w-sm w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
        <div className="mx-auto mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-indigo-600 rounded-2xl blur opacity-25"></div>
            <div className="relative w-24 h-24 bg-[#1e293b] rounded-2xl flex items-center justify-center p-3 border border-slate-700 shadow-2xl">
              <Logo size={48} />
            </div>
          </div>
        </div>
        <h1 className="text-xl font-bold text-white mb-1 tracking-tight">실행자들 ARCHITECT</h1>
        <p className="text-slate-300 mb-6 text-[13px] uppercase tracking-widest font-mono">Build Environment v1.0.0</p>

        {mode === 'select' ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg active:scale-95 text-[16px]"
            >
              <LogIn size={15} /> 구글 계정으로 로그인
            </button>
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-slate-700"></div>
              <span className="text-[13px] text-slate-300 font-mono">OR</span>
              <div className="flex-1 h-px bg-slate-700"></div>
            </div>
            <button
              onClick={() => setMode('pin')}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold py-3 px-4 rounded-lg transition-all text-[16px]"
            >
              🔑 간편 로그인 (아이디 + PIN)
            </button>
            <p className="text-[13px] text-slate-300 mt-1">만든이: 초실행관</p>
          </div>
        ) : (
          <form onSubmit={handlePinLogin} className="flex flex-col gap-3 text-left">
            <div>
              <label className="block text-[13px] font-bold text-slate-300 uppercase tracking-wider mb-1">아이디</label>
              <input
                type="text"
                value={pinId}
                onChange={e => setPinId(e.target.value)}
                placeholder="영문·숫자·한글"
                autoComplete="username"
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-indigo-500 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-300 uppercase tracking-wider mb-1">PIN (6자리 숫자)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                autoComplete="current-password"
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-indigo-500 transition-all font-mono tracking-[0.5em]"
              />
            </div>
            {pinError && <p className="text-[15px] text-rose-400 font-medium">{pinError}</p>}
            <button
              type="submit"
              disabled={pinLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all text-[16px] active:scale-95 mt-1"
            >
              {pinLoading ? '로그인 중...' : '로그인 / 가입하기'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('select'); setPinError(''); }}
              className="text-[15px] text-slate-300 hover:text-slate-300 transition-colors"
            >
              ← 뒤로
            </button>
            <p className="text-[17px] text-slate-300 text-center">처음 입력하면 자동으로 계정이 생성됩니다</p>
          </form>
        )}
      </div>
    </div>
  );
}

const Logo = ({ size = 24 }: { size?: number }) => {
  const [error, setError] = useState(false);
  
  return (
    <div className="w-full h-full flex items-center justify-center">
      {error ? (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
          <path d="M50 5 L5 50 L50 95 L95 50 Z" fill="#000" />
          <path d="M50 10 L10 50 L50 90 L90 50 Z" fill="#ec4899" />
          <text x="50" y="42" textAnchor="middle" fill="white" fontSize="15" fontWeight="900" fontFamily="sans-serif">실행자들</text>
          <path d="M55 48 L40 68 H50 L45 88 L65 58 H55 Z" fill="black" />
        </svg>
      ) : (
        <img 
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Logo" 
          className="w-full h-full object-contain"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('ranking');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 뒤로가기 히스토리 관리 (ref 사용으로 stale closure 방지)
  const tabHistoryRef = useRef<string[]>([]);

  const { profile, adminRole, createProfile, updateProfileInfo, loadingProfile } = useUserRole(user);

  useEffect(() => {
    // Initial connection test
    testFirestoreConnection().catch(e => {
      setRenderError(`데이터베이스 연결 실패: ${e.message}`);
    });

    // iOS redirect 결과 처리 (에러만 캐치, 성공은 onAuthStateChanged가 처리)
    handleRedirectResult().catch((e: any) => {
      if (e.code === 'auth/unauthorized-domain') {
        setRenderError(`현재 도메인(${window.location.hostname})이 Firebase 승인된 도메인에 등록되지 않았습니다.`);
      } else if (e.code !== 'auth/popup-closed-by-user') {
        console.error("Redirect auth error:", e);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    }, (error) => {
      console.error("Auth state change error:", error);
      setAuthLoading(false);
      setRenderError(`인증 오류: ${error.message}`);
    });
    return () => unsubscribe();
  }, []);

  // 뒤로가기 처리: 앱 내 이전 탭으로, 없으면 종료 확인
  useEffect(() => {
    // 초기 진입 시 ghost 히스토리 엔트리 생성 (뒤로가기 감지용)
    window.history.replaceState({ appEntry: true }, '');

    const handlePopState = () => {
      const history = tabHistoryRef.current;
      if (history.length > 0) {
        // 이전 탭으로 복귀
        const prevTab = history[history.length - 1];
        tabHistoryRef.current = history.slice(0, -1);
        setActiveTab(prevTab);
        // 다음 뒤로가기를 위한 ghost 엔트리 재추가
        window.history.pushState({ appEntry: true }, '');
      } else {
        // 히스토리 없음 → 앱 종료 확인
        if (window.confirm('앱을 종료하시겠습니까?')) {
          window.history.go(-1); // 실제로 뒤로 이동 (PWA 종료)
        } else {
          window.history.pushState({ appEntry: true }, ''); // ghost 엔트리 복원
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 탭 전환 핸들러 (뒤로가기 히스토리 쌓기)
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(prev => {
      if (prev === tab) return prev;
      tabHistoryRef.current = [...tabHistoryRef.current, prev];
      return tab;
    });
    window.history.pushState({ appEntry: true }, '');
  }, []);

  const navigation = useMemo(() => {
    const baseNav = [
      { id: 'ranking', name: '랭킹', icon: Trophy },
      { id: 'attendance', name: '런치클럽', icon: CalendarCheck },
      { id: 'missions', name: '미션', icon: CheckSquare },
      { id: 'notices', name: '게시판', icon: Megaphone },
    ];
    
    if (adminRole === 'manager' || adminRole === 'treasurer') {
      baseNav.push({ id: 'accounting', name: '회비', icon: Wallet });
    }
    
    return baseNav;
  }, [adminRole]);

  if (renderError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] p-4">
        <div className="bg-[#1e293b] p-6 rounded-xl shadow-lg border border-red-900/30 text-center max-w-sm">
          <h2 className="text-red-400 font-bold mb-2">오류가 발생했습니다</h2>
          <p className="text-slate-200 text-[15px] mb-4 whitespace-pre-line">{renderError}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs hover:bg-indigo-500 transition-colors">새로고침</button>
            <button onClick={() => window.open(window.location.href, '_blank')} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs hover:bg-slate-700 transition-colors">새 탭에서 열기 (강추)</button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || (user && loadingProfile)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] flex-col gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <p className="text-slate-300 text-[15px] font-mono uppercase tracking-widest">구동 환경 초기화 중...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onError={setRenderError} />;
  }

  if (profile === null) {
    return <Onboarding userEmail={user.email} onSubmit={createProfile} />;
  }

  return (
    <div key={user?.uid} className="flex h-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden select-none">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-800 flex flex-col bg-[#0f172a] shrink-0 hidden md:flex">
        <div className="h-16 border-b border-slate-800/50 flex items-center px-4 gap-3 bg-[#1e293b]">
           <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-700 bg-[#1e293b] p-1">
              <Logo size={20} />
           </div>
           <div>
             <h1 className="text-[20px] font-black text-white leading-tight tracking-tighter">실행자들</h1>
           </div>
        </div>
        
        <div className="p-4 border-b border-slate-800/30">
           <span className="text-[13px] font-bold uppercase tracking-widest text-slate-300">메뉴</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 text-[15px] font-medium transition-all group ${
                  isActive 
                    ? 'bg-indigo-900/20 text-indigo-400 border-r-2 border-indigo-500' 
                    : 'text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={14} className={`${isActive ? 'text-indigo-400' : 'text-slate-300 group-hover:text-slate-300'}`} />
                {item.name.toUpperCase()}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 bg-slate-900/30 border-t border-slate-800">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
                 <span className="text-xs font-black text-indigo-400">{profile!.name.slice(0, 1)}</span>
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-[15px] font-bold text-white truncate">{profile!.name}</p>
                 <p className="text-[17px] text-slate-300 font-mono truncate">{profile!.affiliation || profile!.tier}</p>
              </div>
              <button onClick={logout} className="text-slate-300 hover:text-red-400 transition-colors">
                 <LogOut size={14} />
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <header className="h-11 border-b border-slate-800 flex items-center justify-between px-3 md:px-6 bg-[#1e293b] shrink-0">
           <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 md:hidden shrink-0">
                 <div className="w-6 h-6 rounded shrink-0 overflow-hidden border border-slate-700 bg-[#1e293b] p-0.5">
                    <Logo size={12} />
                 </div>
                 <h1 className="text-[13px] font-black text-white tracking-tighter">실행자들</h1>
                 <span className="text-slate-700 text-[13px]">·</span>
              </div>
              <h2 className="text-[13px] font-bold text-slate-300 uppercase tracking-wider truncate">
                 {navigation.find(n => n.id === activeTab)?.name}
              </h2>
           </div>
           <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="p-1.5 text-slate-300 hover:text-indigo-400 transition-all hover:bg-slate-800 rounded-lg"
              >
                <Settings size={15} />
              </button>

              {(adminRole === 'manager' || adminRole === 'treasurer') && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 text-slate-300 hover:text-amber-500 transition-all hover:bg-slate-800 rounded-lg"
                >
                  <Users size={16} />
                </button>
              )}

              {(adminRole === 'manager' || adminRole === 'treasurer') && (
                <div className="px-2 py-0.5 rounded bg-amber-900/20 text-[11px] text-amber-500 border border-amber-900/30 font-bold whitespace-nowrap">
                   {adminRole === 'manager' ? '관리자' : '총무'}
                </div>
              )}
           </div>
        </header>

        {/* Main Workspace scrollable */}
        <main className="flex-1 overflow-y-auto bg-[#0f172a] p-6 pb-28 md:pb-6 lg:p-8 lg:pb-8">
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
            {activeTab === 'ranking' && <RankingBoard adminRole={adminRole} />}
            {activeTab === 'attendance' && <MeetingBoard userId={user.uid} adminRole={adminRole} profile={profile!} />}
            {activeTab === 'missions' && <MissionBoard profile={profile!} adminRole={adminRole} />}
            {activeTab === 'notices' && <NoticeBoard adminRole={adminRole} profile={profile!} />}
            {activeTab === 'accounting' && <AccountingBoard adminRole={adminRole} />}
            {activeTab === 'members' && <MemberBoard adminRole={adminRole} />}
          </div>
        </main>

        <AdminSettings 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          adminRole={adminRole}
        />

        <ProfileSettings
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          profile={profile!}
          onUpdate={updateProfileInfo}
        />

        {/* Footer Bar */}
        <footer className="h-6 bg-indigo-600 text-white flex items-center justify-between px-3 text-[13px] font-medium shrink-0">
          <div className="flex items-center gap-4">
            <span>● 렌더링 엔진: 활성</span>
            <span>● 지연 시간: 12ms</span>
          </div>
          <div className="flex items-center gap-4 uppercase font-bold tracking-tighter text-indigo-200">
            <span>프로세스: {user.uid.slice(0,8).toUpperCase()}</span>
            <span>데이터 스토리지: FIRESTORE</span>
            <span>시스템 버젼: v1.0.0</span>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1e293b] border-t border-slate-800 md:hidden flex justify-around p-2 pb-safe z-10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
             <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`flex flex-col items-center p-2 rounded-lg text-[17px] font-bold transition-all ${
                isActive ? 'text-indigo-400' : 'text-slate-300'
              }`}
            >
              <Icon size={16} className="mb-1" />
              {item.name.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  );
}
