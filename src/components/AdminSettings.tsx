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

  const handleResetAllPoints = async () => {
    if (!window.confirm(`전체 ${members.length}명의 포인트를 모두 0으로 초기화하시겠습니까?\n회원 정보(이름, 소속 등)는 그대로 유지됩니다.`)) return;
    if (!window.confirm('⚠️ 마지막 확인: 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
    setProcessing('__reset_all__');
    try {
      // 500개 단위로 배치 처리
      const chunkSize = 450;
      for (let i = 0; i < members.length; i += chunkSize) {
        const chunk = members.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(member => {
          batch.update(doc(db, 'users', member.uid), {
            totalPoints: 0,
            lastMissionId: '',
            lastMeetingId: ''
          });
        });
        await batch.commit();
      }
      alert('✅ 포인트 초기화 완료');
    } catch (err: any) {
      console.error(err);
      alert('초기화 실패: ' + err.message);
    } finally {
      setProcessing(null);
    }
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
          {/* Header + Search 통합 */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-900/50">
            <div className="p-1.5 bg-indigo-600/20 rounded-lg text-indigo-400 shrink-0">
              <Settings size={16} />
            </div>
            <div className="shrink-0">
              <h2 className="text-[17px] font-black text-white tracking-tighter uppercase leading-none">회원관리</h2>
              <p className="text-[17px] text-slate-300 font-mono">전체 {members.length}명</p>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
              <input
                type="text"
                placeholder="이름 또는 소속 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-1.5 pl-8 pr-3 text-[16px] text-white outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Member List */}
          <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 font-sans bg-[#0f172a]/30">
            {loading ? (
              <div className="text-center py-16 text-slate-300 animate-pulse font-mono uppercase tracking-widest text-xs">데이터 동기화 중...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-16 text-slate-300 font-mono uppercase tracking-widest text-xs">검색 결과가 없습니다.</div>
            ) : (
              filteredMembers.map(member => (
                <div key={member.uid} className="bg-[#1e293b] px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-all group flex items-center gap-2">
                  {/* 이름 + 소속 (1줄) */}
                  <div className="min-w-0 flex-1">
                    {editingAffiliation === member.uid ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[15px] font-bold text-white shrink-0">{member.name}</span>
                        <input
                          autoFocus
                          type="text"
                          value={affiliationInput}
                          onChange={e => setAffiliationInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveAffiliation(member); if (e.key === 'Escape') setEditingAffiliation(null); }}
                          className="bg-[#0f172a] border border-indigo-500 rounded px-1.5 py-0.5 text-[13px] text-white outline-none flex-1 min-w-0"
                        />
                        <button onClick={() => handleSaveAffiliation(member)} disabled={!!processing} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30 shrink-0"><Check size={12} /></button>
                        <button onClick={() => setEditingAffiliation(null)} className="text-slate-300 hover:text-white shrink-0"><X size={12} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[15px] font-bold text-white shrink-0">{member.name}</span>
                        {member.role && (
                          <span className={`${member.role === 'manager' ? 'text-amber-500' : 'text-emerald-400'} text-[11px] font-black shrink-0`}>
                            [{member.role === 'manager' ? '관리자' : '총무'}]
                          </span>
                        )}
                        <span className="text-slate-300 text-[13px] shrink-0">·</span>
                        <span className="text-[13px] text-slate-300 truncate">{member.affiliation || '—'}</span>
                        {adminRole === 'manager' && (
                          <button onClick={() => startEditAffiliation(member)} className="text-slate-700 hover:text-indigo-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                            <Pencil size={9} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* PT + 버튼들 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[13px] text-indigo-400/80 font-mono font-bold">{member.totalPoints.toLocaleString()}<span className="text-[12px] opacity-50">pt</span></span>

                    {adminRole === 'manager' && (
                      <div className="flex items-center bg-[#0f172a] border border-slate-700 rounded h-6 relative group/btn">
                        <input
                          type="number"
                          value={memberPoints[member.uid] || ''}
                          placeholder="0"
                          onChange={e => onPointInputChange(member.uid, e.target.value)}
                          className="w-10 bg-transparent text-center text-[13px] text-white outline-none font-mono"
                        />
                        <button
                          onClick={() => handleAddPoints(member)}
                          disabled={!!processing || (memberPoints[member.uid] || 0) === 0}
                          className="px-1.5 h-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 transition-colors rounded-r"
                        >
                          <Coins size={11} />
                        </button>
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-[17px] text-white px-1.5 py-1 rounded border border-slate-700 opacity-0 group-hover/btn:opacity-100 whitespace-nowrap pointer-events-none z-10">점수추가</span>
                      </div>
                    )}

                    {adminRole === 'manager' && (
                      <button
                        onClick={() => handleToggleTreasurer(member)}
                        disabled={!!processing}
                        className={`p-1 h-6 w-6 flex items-center justify-center rounded transition-all relative group/btn ${member.role === 'treasurer' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : member.role === 'manager' ? 'bg-amber-600/20 text-amber-500 border-amber-500/20 cursor-default' : 'text-slate-300 bg-slate-800 border border-slate-700 hover:text-white'} disabled:opacity-30`}
                      >
                        {member.role === 'manager' ? <Shield size={12} className="text-amber-500" fill="currentColor" /> : member.role === 'treasurer' ? <UserMinus size={12} /> : <UserPlus size={12} />}
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-[17px] text-white px-1.5 py-1 rounded border border-slate-700 opacity-0 group-hover/btn:opacity-100 whitespace-nowrap pointer-events-none z-10">총무권한</span>
                      </button>
                    )}

                    {adminRole === 'manager' && member.role !== 'manager' && (
                      <button
                        onClick={() => handleDeleteMember(member)}
                        disabled={!!processing}
                        className="p-1 h-6 w-6 flex items-center justify-center rounded bg-red-900/20 text-red-500 hover:bg-red-600/30 border border-red-900/30 transition-all relative group/btn disabled:opacity-30"
                      >
                        <Trash2 size={11} />
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-[17px] text-white px-1.5 py-1 rounded border border-slate-700 opacity-0 group-hover/btn:opacity-100 whitespace-nowrap pointer-events-none z-10">삭제</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Status Bar */}
          <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[17px] text-slate-300 font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              {adminRole === 'manager' ? '마스터 관리자' : '지정 총무'} · 검색결과 {filteredMembers.length}명
            </div>
            {adminRole === 'manager' && (
              <button
                onClick={handleResetAllPoints}
                disabled={!!processing}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-900/30 hover:bg-rose-800/50 border border-rose-700/40 text-rose-400 hover:text-rose-300 rounded text-[17px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 shrink-0"
              >
                ⚠ 포인트 전체 초기화
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
