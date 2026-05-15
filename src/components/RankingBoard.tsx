import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Shield, UserPlus, UserMinus } from 'lucide-react';
import { UserProfile } from '../hooks/useUserRole';

export default function RankingBoard({ adminRole }: { adminRole: 'manager' | 'treasurer' | null }) {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('totalPoints', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => {
        const data = d.data() as UserProfile;
        // Hide managers, specific administrative role, and specific user
        const isExcluded = data.role === 'manager' || data.affiliation === '관리자(도시주택국장)' || data.name === '김종진';
        if (!isExcluded) {
          list.push({ uid: d.id, ...data });
        }
      });
      setMembers(list);
      setLoading(false);
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleTreasurer = async (member: UserProfile) => {
    try {
      const newRole = member.role === 'treasurer' ? null : 'treasurer';
      await updateDoc(doc(db, 'users', member.uid), {
        role: newRole
      });
    } catch (err: any) {
      console.error(err);
      alert('권한 변경 실패: ' + err.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-200">랭킹 로드 중...</div>;

  const rankedMembers = members.map((member, index, arr) => {
    const rank = arr.findIndex(m => m.totalPoints === member.totalPoints) + 1;
    return { ...member, rank };
  });

  return (
    <div className="flex flex-col gap-10 w-full animate-in fade-in duration-500">
      {/* Leaderboard Table */}
      <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-w-2xl mx-auto w-full mt-4">
        <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
           <span className="text-[13px] font-bold uppercase tracking-widest text-slate-200">실행자 전체 랭킹 현황</span>
           <div className="flex items-center gap-2 text-[13px] font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 실시간 동기화
           </div>
        </div>
        <div className="flex flex-col">
          {rankedMembers.map((member) => (
            <div key={member.uid} className="flex items-center gap-3 px-4 py-1.5 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
              <div className="w-6 text-[16px] font-black font-mono text-slate-300 group-hover:text-amber-400 transition-colors flex justify-center italic shrink-0">
                {member.rank}
              </div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[16px] font-bold text-white group-hover:translate-x-1 transition-transform truncate">{member.name}</span>
                    {member.role === 'manager' && <span className="bg-amber-500/10 text-amber-500 text-[11px] px-1 rounded border border-amber-500/20 font-black shrink-0">관리자</span>}
                    {member.role === 'treasurer' && <span className="bg-emerald-500/10 text-emerald-500 text-[11px] px-1 rounded border border-emerald-500/20 font-black shrink-0">총무</span>}
                  </div>
                  <div className="text-[17px] text-slate-300 font-medium truncate leading-tight">{member.affiliation || '소속 정보 없음'}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-[17px] font-black text-indigo-400 font-mono tracking-tighter">{member.totalPoints.toLocaleString()} <span className="text-[17px] opacity-60">PT</span></div>
                </div>
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-mono text-[13px] uppercase tracking-widest">
               랭킹 데이터가 존재하지 않습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
