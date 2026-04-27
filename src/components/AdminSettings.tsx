import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Settings,
  Shield,
  UserPlus,
  UserMinus,
  Coins,
  X,
  Search,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Trash2,
  Pencil,
  Check
} from 'lucide-react';
import { UserProfile } from '../hooks/useUserRole';
import { motion, AnimatePresence } from 'motion/react';

interface AdminSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  adminRole: 'manager' | 'treasurer' | null;
}

export default function AdminSettings({ isOpen, onClose, adminRole }: AdminSettingsProps) {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [memberPoints, setMemberPoints] = useState<{[key: string]: number}>({});
  const [editingAffiliation, setEditingAffiliation] = useState<string | null>(null);
  const [affiliationInput, setAffiliationInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as UserProfile));
      setMembers(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen]);

  const handleToggleTreasurer = async (member: UserProfile) => {
    if (processing) return;
    if (member.role === 'manager') {
      alert('관리자 권한은 시스템 핵심 권한으로 제거할 수 없습니다.');
      return;
    }
    setProcessing(member.uid);
    try {
      const newRole = member.role === 'treasurer' ? null : 'treasurer';
      await updateDoc(doc(db, 'users', member.uid), {
        role: newRole
      });
    } catch (err: any) {
      console.error(err);
      alert('권한 변경 실패: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleAddPoints = async (member: UserProfile) => {
    const amount = memberPoints[member.uid] || 0;
    if (processing || amount === 0) return;
    
    if (!window.confirm(`${member.name}님에게 ${amount} 포인트를 ${amount > 0 ? '지급' : '차감'}하시겠습니까?`)) return;
    
    setProcessing(member.uid);
    try {
      await updateDoc(doc(db, 'users', member.uid), {
        totalPoints: increment(amount)
      });
      // Reset input for this member after success
      setMemberPoints(prev => ({ ...prev, [member.uid]: 0 }));
    } catch (err: any) {
      console.error(err);
      alert('포인트 지급 실패: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteMember = async (member: UserProfile) => {
    if (processing) return;
    if (member.role === 'manager') {
      alert('관리자 계정은 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm(`${member.name}(${member.affiliation || '소속없음'}) 회원을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setProcessing(member.uid);
    try {
      await deleteDoc(doc(db, 'users', member.uid));
    } catch (err: any) {
      console.error(err);
      alert('삭제 실패: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const startEditAffiliation = (member: UserProfile) => {
    setEditingAffiliation(member.uid);
    setAffiliationInput(member.affiliation || '');
  };

  const handleSaveAffiliation = async (member: UserProfile) => {
    if (processing || !affiliationInput.trim()) return;
    setProcessing(member.uid);
    try {
      await updateDoc(doc(db, 'users', member.uid), { affiliation: affiliationInput.trim() });
      setEditingAffiliation(null);
    } catch (err: any) {
      console.error(err);
      alert('소속 수정 실패: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const onPointInputChange = (uid: string, value: string) => {
    const num = parseInt(value) || 0;
    setMemberPoints(prev => ({ ...prev, [uid]: num }));
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.affiliation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-[#1e293b] rounded-2xl border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
                <Settings size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tighter uppercase">회원관리</h2>
                <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Member Management</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-6 border-b border-slate-800 bg-[#1e293b]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="실행자 이름 또는 소속 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* Member List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-sans bg-[#0f172a]/30">
            {loading ? (
              <div className="text-center py-20 text-slate-600 animate-pulse font-mono uppercase tracking-widest text-xs">데이터 동기화 중...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-20 text-slate-600 font-mono uppercase tracking-widest text-xs">검색 결과가 없습니다.</div>
            ) : (
              filteredMembers.map(member => (
                <div key={member.uid} className="bg-[#1e293b] p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-all group flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-white truncate">{member.name}</span>
                        {member.role && (
                          <span className={`${member.role === 'manager' ? 'text-amber-500' : 'text-emerald-400'} text-[8px] font-black uppercase tracking-tighter shrink-0`}>
                             [{member.role === 'manager' ? '관리자' : '총무'}]
                          </span>
                        )}
                      </div>
                      {editingAffiliation === member.uid ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            autoFocus
                            type="text"
                            value={affiliationInput}
                            onChange={e => setAffiliationInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveAffiliation(member); if (e.key === 'Escape') setEditingAffiliation(null); }}
                            className="bg-[#0f172a] border border-indigo-500 rounded px-2 py-0.5 text-[11px] text-white outline-none w-36"
                          />
                          <button onClick={() => handleSaveAffiliation(member)} disabled={!!processing} className="p-0.5 text-emerald-400 hover:text-emerald-300 disabled:opacity-30">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingAffiliation(null)} className="p-0.5 text-slate-500 hover:text-white">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[9px] text-slate-500 font-medium truncate leading-tight">{member.affiliation || '소속 정보 없음'}</p>
                          {adminRole === 'manager' && (
                            <button onClick={() => startEditAffiliation(member)} className="text-slate-600 hover:text-indigo-400 transition-colors shrink-0">
                              <Pencil size={10} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="text-[9px] text-indigo-400/70 font-mono font-bold">{member.totalPoints.toLocaleString()} <span className="opacity-50 text-[7px]">PT</span></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Point Individual Control */}
                    {adminRole === 'manager' && (
                      <div className="flex items-center bg-[#0f172a] border border-slate-700 rounded-lg h-9 relative group/btn">
                        <input 
                          type="number" 
                          value={memberPoints[member.uid] || ''}
                          placeholder="0"
                          onChange={e => onPointInputChange(member.uid, e.target.value)}
                          className="w-12 bg-transparent text-center text-xs text-white outline-none font-mono"
                        />
                        <button 
                          onClick={() => handleAddPoints(member)}
                          disabled={!!processing || (memberPoints[member.uid] || 0) === 0}
                          className="px-3 h-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 transition-colors rounded-r-lg"
                        >
                          <Coins size={14} />
                        </button>
                        <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-white px-2 py-1.5 rounded border border-slate-700 opacity-0 group-hover/btn:opacity-100 transition-all scale-75 group-hover/btn:scale-100 whitespace-nowrap pointer-events-none z-10 shadow-2xl">점수추가</span>
                      </div>
                    )}

                    {/* Admin role can manage everything */}
                    {adminRole === 'manager' && (
                      <button
                        onClick={() => handleToggleTreasurer(member)}
                        disabled={!!processing}
                        className={`p-2 h-7 rounded-lg transition-all relative group/btn ${member.role === 'treasurer' ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 border border-emerald-500/20' : member.role === 'manager' ? 'bg-amber-600/20 text-amber-500 border-amber-500/20 cursor-default' : 'text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700'} disabled:opacity-30`}
                      >
                        {member.role === 'manager' ? <Shield size={18} className="text-amber-500" fill="currentColor" /> : member.role === 'treasurer' ? <UserMinus size={18} /> : <UserPlus size={18} />}
                        <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-white px-2 py-1.5 rounded border border-slate-700 opacity-0 group-hover/btn:opacity-100 transition-all scale-75 group-hover/btn:scale-100 whitespace-nowrap pointer-events-none z-10 shadow-2xl">총무권한</span>
                      </button>
                    )}

                    {/* Delete member */}
                    {adminRole === 'manager' && member.role !== 'manager' && (
                      <button
                        onClick={() => handleDeleteMember(member)}
                        disabled={!!processing}
                        className="p-2 h-7 rounded-lg bg-red-900/20 text-red-500 hover:bg-red-600/30 hover:text-red-400 border border-red-900/30 transition-all relative group/btn disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                        <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-white px-2 py-1.5 rounded border border-slate-700 opacity-0 group-hover/btn:opacity-100 transition-all scale-75 group-hover/btn:scale-100 whitespace-nowrap pointer-events-none z-10 shadow-2xl">회원삭제</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Status Bar */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              접속 권한: {adminRole === 'manager' ? '마스터 관리자' : '지정 총무'}
            </div>
            <div className="text-[10px] text-slate-600 italic">
               * 관리자(MANAGER)만 권한 및 포인트를 직접 제어할 수 있습니다.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
