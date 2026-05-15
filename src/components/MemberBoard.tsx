import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, Search, Trash2, Shield, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../hooks/useUserRole';
import { format } from 'date-fns';

export default function MemberBoard({ adminRole }: { adminRole: 'manager' | 'treasurer' | null }) {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const safeAlert = (msg: string) => {
    try { window.alert(msg); } catch (e) { console.log(msg); }
  };

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as UserProfile));
      setMembers(list);
      setLoading(false);
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      setConfirmDeleteId(null);
      safeAlert('삭제 성공');
    } catch (e) {
      console.error(e);
      safeAlert('삭제 실패');
    }
  };

  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="p-10 text-center text-slate-200">명단 동기화 중...</div>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Users size={16} className="text-indigo-400" />
          <h3 className="text-[16px] font-bold text-slate-200 uppercase tracking-widest">실행자 명단 조회 ({members.length})</h3>
        </div>
        <div className="relative w-full sm:w-64">
           <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
           <input 
             type="text" 
             placeholder="식별자 검색..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-indigo-500"
           />
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="flex flex-col">
          <div className="bg-[#0f172a]/50 px-6 py-3 border-b border-slate-800 flex items-center justify-between text-[15px] font-bold uppercase tracking-widest text-slate-300">
            <span>실행자 정보 (이름, 소속, 포인트)</span>
            {adminRole === 'manager' && <span className="w-8 text-center text-[12px]">옵션</span>}
          </div>
          <div className="divide-y divide-slate-800/50">
            {filtered.map(member => (
              <div key={member.uid} className="px-6 py-4 hover:bg-indigo-900/10 transition-colors group flex items-center justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[19px] text-white font-bold tracking-tight shrink-0">{member.name}</span>
                    <span className="text-[16px] text-slate-200 font-medium truncate">
                      ({member.affiliation || member.tier})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-black text-indigo-400 font-mono">
                      {member.totalPoints.toLocaleString()} <span className="text-[19px] opacity-70">PT</span>
                    </span>
                    <span className="text-[19px] text-slate-300 font-mono hidden sm:inline">
                      • {member.createdAt?.toDate ? format(member.createdAt.toDate(), 'yyyy.MM.dd') : 'N/A'}
                    </span>
                  </div>
                </div>

                {adminRole === 'manager' && (
                  <div className="ml-4 shrink-0">
                    {confirmDeleteId === member.uid ? (
                      <button onClick={() => handleDelete(member.uid)} className="text-[15px] font-black text-rose-500 hover:text-rose-400 bg-rose-500/10 px-2 py-1 rounded transition-colors whitespace-nowrap">
                        삭제 확정
                      </button>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(member.uid)} className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center text-slate-300 font-mono text-[15px] uppercase tracking-widest">
                일치하는 실행자를 찾을 수 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
