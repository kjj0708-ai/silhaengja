import { useState, useEffect, useMemo } from 'react';
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
import { auth, loginWithGoogle, logout, testFirestoreConnection, handleRedirectResult } from './firebase';
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
          <p className="text-slate-400 text-[11px] mb-4 whitespace-pre-line">{renderError}</p>
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
        <p className="text-slate-500 text-[11px] font-mono uppercase tracking-widest">구동 환경 초기화 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] p-4 font-sans max-h-screen overflow-hidden">
        <div className="bg-[#1e293b] p-8 rounded-xl shadow-2xl border border-slate-800 text-center max-w-sm w-full relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
          <div className="mx-auto mb-6 flex justify-center">
            <div className="relative group/logo">
              <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover/logo:opacity-50 transition duration-1000 group-hover/logo:duration-200"></div>
              <div className="relative w-32 h-32 bg-[#1e293b] rounded-2xl flex items-center justify-center p-4 border border-slate-700 shadow-2xl transition-transform duration-500 group-hover/logo:scale-105 group-hover/logo:border-pink-500/50">
                <Logo size={64} />
              </div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mb-2 tracking-tight">실행자들 ARCHITECT</h1>
          <p className="text-slate-400 mb-8 text-[11px] uppercase tracking-widest font-mono">Build Environment v1.0.0</p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={async () => {
                try { 
                  setRenderError(null);
                  await loginWithGoogle(); 
                } catch (e: any) { 
                  console.error("Login attempt failed:", e);
                  let errorMessage = `로그인 중 문제가 발생했습니다: ${e.message || '알 수 없는 오류'}`;
                  
                  if (e.code === 'auth/unauthorized-domain') {
                    errorMessage = `현재 도메인(${window.location.hostname})이 Firebase '승인된 도메인'에 등록되지 않았습니다.\n\nFirebase Console > Authentication > Settings > Authorized Domains에 해당 도메인을 추가해 주세요.`;
                  } else if (e.code === 'auth/popup-blocked') {
                    errorMessage = '팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.';
                  } else if (e.code === 'auth/popup-closed-by-user') {
                    errorMessage = '로그인 창이 닫혔습니다. 다시 시도해 주세요.';
                  } else if (e.code === 'auth/network-request-failed') {
                    errorMessage = '네트워크 연결 상태를 확인해 주세요.';
                  }
                  
                  setRenderError(errorMessage);
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg active:scale-95 text-[12px]"
            >
              <LogIn size={16} />
              구글 계정으로 시작하기
            </button>
            <p className="text-[10px] text-slate-500 mt-2">만든이:초실행관</p>
          </div>
        </div>
      </div>
    );
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
             <h1 className="text-[15px] font-black text-white leading-tight tracking-tighter">실행자들</h1>
             <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest italic">데이터 센터</p>
           </div>
        </div>
        
        <div className="p-4 border-b border-slate-800/30">
           <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">메뉴</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 text-[11px] font-medium transition-all group ${
                  isActive 
                    ? 'bg-indigo-900/20 text-indigo-400 border-r-2 border-indigo-500' 
                    : 'text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={14} className={`${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
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
                 <p className="text-[11px] font-bold text-white truncate">{profile!.name}</p>
                 <p className="text-[9px] text-slate-500 font-mono truncate">{profile!.affiliation || profile!.tier}</p>
              </div>
              <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors">
                 <LogOut size={14} />
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#1e293b] shrink-0">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 md:hidden">
                 <div className="w-8 h-8 rounded shrink-0 overflow-hidden border border-slate-700 bg-[#1e293b] p-0.5">
                    <Logo size={16} />
                 </div>
                 <h1 className="text-[14px] font-black text-white tracking-tighter">실행자들</h1>
              </div>
              <div className="h-4 w-[1px] bg-slate-700 hidden md:hidden"></div>
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                 {navigation.find(n => n.id === activeTab)?.name}
              </h2>
           </div>
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsProfileOpen(true)}
                className="p-2 text-slate-500 hover:text-indigo-400 transition-all hover:bg-slate-800 rounded-lg relative group"
              >
                <Settings size={18} />
                <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] shadow-2xl text-white px-2 py-1.5 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">프로필 수정</span>
              </button>
              
              {(adminRole === 'manager' || adminRole === 'treasurer') && (
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-slate-500 hover:text-amber-500 transition-all hover:bg-slate-800 rounded-lg relative group"
                >
                  <Users size={20} />
                  <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] shadow-2xl text-white px-2 py-1.5 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">회원관리</span>
                </button>
              )}
              {(adminRole === 'manager' || adminRole === 'treasurer') && (
                <div className="px-3 py-1.5 rounded bg-amber-900/20 text-[10px] text-amber-500 border border-amber-900/30 font-bold">
                   권한: {adminRole === 'manager' ? '관리자' : '총무'}
                </div>
              )}
           </div>
        </header>

        {/* Main Workspace scrollable */}
        <main className="flex-1 overflow-y-auto bg-[#0f172a] p-6 lg:p-8">
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
        <footer className="h-6 bg-indigo-600 text-white flex items-center justify-between px-3 text-[10px] font-medium shrink-0">
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
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center p-2 rounded-lg text-[9px] font-bold transition-all ${
                isActive ? 'text-indigo-400' : 'text-slate-500'
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
