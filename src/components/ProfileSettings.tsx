import { useState, useEffect } from 'react';
import { X, Save, User as UserIcon, Building2, LogOut, Bell, BellOff, BellRing } from 'lucide-react';
import { UserProfile } from '../hooks/useUserRole';
import { logout, registerFCMToken, unregisterFCMToken } from '../firebase';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdate: (name: string, affiliation: string) => Promise<void>;
  userId: string;
  adminRole: string | null;
  adminNotifEnabled: boolean;
  onToggleAdminNotif: () => void;
}

export default function ProfileSettings({
  isOpen, onClose, profile, onUpdate,
  userId, adminRole, adminNotifEnabled, onToggleAdminNotif,
}: ProfileSettingsProps) {
  const [name, setName] = useState(profile.name || '');
  const [affiliation, setAffiliation] = useState(profile.affiliation || '');
  const [isSaving, setIsSaving] = useState(false);

  // 푸시 알림 상태
  const [pushPerm, setPushPerm] = useState<NotificationPermission>('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // 알림 권한 + 활성 상태 초기화
  useEffect(() => {
    if (!isOpen) return;
    if (!('Notification' in window)) return;
    const perm = Notification.permission;
    setPushPerm(perm);
    // localStorage에 저장된 사용자 선택 기반
    const saved = localStorage.getItem('fcm_push_enabled');
    setPushEnabled(perm === 'granted' && saved !== 'false');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || !affiliation.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(name.trim(), affiliation.trim());
      onClose();
    } catch (error) {
      console.error("Update profile error:", error);
      alert("프로필 수정에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      try {
        await logout();
        onClose();
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        // 끄기: Firestore에서 토큰 제거
        await unregisterFCMToken(userId);
        localStorage.setItem('fcm_push_enabled', 'false');
        setPushEnabled(false);
      } else {
        // 켜기: 권한 요청 + 토큰 등록
        await registerFCMToken(userId);
        const perm = Notification.permission;
        setPushPerm(perm);
        if (perm === 'granted') {
          localStorage.setItem('fcm_push_enabled', 'true');
          setPushEnabled(true);
        }
      }
    } catch (err) {
      console.error('Push toggle error:', err);
    } finally {
      setPushLoading(false);
    }
  };

  const isAdmin = adminRole === 'manager' || adminRole === 'treasurer';
  const pushBlocked = pushPerm === 'denied';
  const noNotifSupport = !('Notification' in window);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        <div className="h-1 bg-indigo-600"></div>
        <div className="p-5 border-b border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/30 rounded-lg">
              <UserIcon size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-tighter">프로필 설정</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* 프로필 편집 */}
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                <UserIcon size={10} className="text-indigo-400" />
                사용자 성명
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-2.5 px-4 text-white text-[16px] outline-none focus:border-indigo-500 transition-colors"
                placeholder="성명을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                <Building2 size={10} className="text-indigo-400" />
                소속
              </label>
              <input
                type="text"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-2.5 px-4 text-white text-[16px] outline-none focus:border-indigo-500 transition-colors"
                placeholder="소속을 입력하세요"
              />
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[14px] font-bold rounded-lg transition-all uppercase tracking-widest"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || !affiliation.trim() || (name === profile.name && affiliation === profile.affiliation)}
              className="flex-[2] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[14px] font-bold rounded-lg transition-all shadow-lg shadow-indigo-600/20 uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : <Save size={13} />}
              저장
            </button>
          </div>

          {/* 알림 설정 섹션 */}
          <div className="border-t border-slate-800/50 pt-4 space-y-3">
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Bell size={11} className="text-indigo-400" />
              알림 설정
            </p>

            {/* 백그라운드 푸시 알림 */}
            <div className={`flex items-center justify-between p-3 rounded-xl border ${
              pushBlocked
                ? 'bg-red-900/10 border-red-900/30'
                : pushEnabled
                ? 'bg-emerald-900/10 border-emerald-900/30'
                : 'bg-slate-800/50 border-slate-700/50'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg ${
                  pushBlocked ? 'bg-red-900/30' : pushEnabled ? 'bg-emerald-900/30' : 'bg-slate-700/50'
                }`}>
                  {pushBlocked ? (
                    <BellOff size={14} className="text-red-400" />
                  ) : pushEnabled ? (
                    <BellRing size={14} className="text-emerald-400" />
                  ) : (
                    <Bell size={14} className="text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">푸시 알림</p>
                  <p className="text-[12px] text-slate-400">
                    {noNotifSupport
                      ? '이 브라우저는 알림을 지원하지 않습니다'
                      : pushBlocked
                      ? '브라우저에서 알림이 차단됨 (브라우저 설정에서 해제)'
                      : pushEnabled
                      ? '새 게시글·모임 알림 수신 중'
                      : '알림을 켜면 새 소식을 받습니다'}
                  </p>
                </div>
              </div>
              {/* 토글 */}
              {!noNotifSupport && !pushBlocked && (
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
                    pushEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                  } disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    pushEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              )}
            </div>

            {/* 관리자 전용: 실시간 알림 (포그라운드) */}
            {isAdmin && (
              <div className={`flex items-center justify-between p-3 rounded-xl border ${
                adminNotifEnabled
                  ? 'bg-amber-900/10 border-amber-900/30'
                  : 'bg-slate-800/50 border-slate-700/50'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg ${adminNotifEnabled ? 'bg-amber-900/30' : 'bg-slate-700/50'}`}>
                    {adminNotifEnabled
                      ? <Bell size={14} className="text-amber-400" />
                      : <BellOff size={14} className="text-slate-400" />
                    }
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-white">관리자 실시간 알림</p>
                    <p className="text-[12px] text-slate-400">
                      {adminNotifEnabled
                        ? '앱 사용 중 게시글·신청 알림 수신 중'
                        : '앱 사용 중 실시간 알림 (관리자 전용)'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onToggleAdminNotif}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
                    adminNotifEnabled ? 'bg-amber-500' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    adminNotifEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            )}
          </div>

          {/* 로그아웃 */}
          <div className="border-t border-slate-800/50 pt-3">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 bg-red-900/10 hover:bg-red-900/20 border border-red-900/30 text-red-400 text-[14px] font-bold rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <LogOut size={13} />
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
