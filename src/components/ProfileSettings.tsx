import { useState } from 'react';
import { X, Save, User as UserIcon, Building2, LogOut } from 'lucide-react';
import { UserProfile } from '../hooks/useUserRole';
import { logout } from '../firebase';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdate: (name: string, affiliation: string) => Promise<void>;
}

export default function ProfileSettings({ isOpen, onClose, profile, onUpdate }: ProfileSettingsProps) {
  const [name, setName] = useState(profile.name || '');
  const [affiliation, setAffiliation] = useState(profile.affiliation || '');
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        <div className="h-1 bg-indigo-600"></div>
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
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

        <div className="p-8 space-y-6">
          <div className="space-y-4">
             <div>
                <label className="block text-[13px] font-bold text-slate-200 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                   <UserIcon size={10} className="text-indigo-400" />
                   사용자 성명
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-3 px-4 text-white text-[17px] outline-none focus:border-indigo-500 transition-colors"
                  placeholder="성명을 입력하세요"
                />
             </div>

             <div>
                <label className="block text-[13px] font-bold text-slate-200 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                   <Building2 size={10} className="text-indigo-400" />
                   소속 업데이트
                </label>
                <input
                  type="text"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-3 px-4 text-white text-[17px] outline-none focus:border-indigo-500 transition-colors"
                  placeholder="새로운 소속을 입력하세요"
                />
             </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
             <div className="flex gap-3">
                <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[15px] font-bold rounded-lg transition-all uppercase tracking-widest"
                >
                    취소
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !name.trim() || !affiliation.trim() || (name === profile.name && affiliation === profile.affiliation)}
                    className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[15px] font-bold rounded-lg transition-all shadow-lg shadow-indigo-600/20 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                    {isSaving ? (
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : <Save size={14} />}
                    변경사항 저장
                </button>
             </div>

             <div className="pt-4 border-t border-slate-800/50">
                <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 bg-red-900/10 hover:bg-red-900/20 border border-red-900/30 text-red-400 text-[15px] font-bold rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                    <LogOut size={14} />
                    로그아웃
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
