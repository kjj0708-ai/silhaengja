import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp, runTransaction, updateDoc, deleteDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../hooks/useUserRole';
import { format } from 'date-fns';
import { Pencil, Trash2, X, Check, CalendarCheck, Calendar, Bell, BellOff } from 'lucide-react';
import { useMeetingNotifications } from '../hooks/useNotifications';

interface Meeting {
  id: string;
  title: string;
  date: string;
  maxAttendees: number;
  attendeesCount: number;
  createdAt: any;
}

export default function MeetingBoard({
  userId,
  adminRole,
  profile
}: {
  userId: string;
  adminRole: 'manager' | 'treasurer' | null;
  profile: UserProfile;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Set<string>>(new Set());
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]); // For admin view
  const [loading, setLoading] = useState(true);
  const knownMeetingIds = useRef<Set<string> | null>(null); // null = initial load not done
  const { notifEnabled, permission, toggle, notify } = useMeetingNotifications();

  // New Meeting Form
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('12:00');
  const [newMax, setNewMax] = useState(8);

  // Edit State
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editMax, setEditMax] = useState(8);
  
  // Confirm Delete State
  const [confirmDeleteReg, setConfirmDeleteReg] = useState<string | null>(null);
  const [confirmDeleteMtg, setConfirmDeleteMtg] = useState<string | null>(null);

  const safeAlert = (msg: string) => {
    try { window.alert(msg); } catch (e) { console.log(msg); }
  };

  useEffect(() => {
    // 1. Listen to meetings
    const mq = collection(db, 'meetings');
    const unsub = onSnapshot(mq, (snapshot) => {
      const mets: Meeting[] = [];
      snapshot.forEach(d => mets.push({ id: d.id, ...d.data() } as Meeting));
      // Sort client-side: date desc, then createdAt desc
      mets.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        const getMillis = (ts: any) => {
          if (!ts) return Date.now() + 1000;
          if (typeof ts.toMillis === 'function') return ts.toMillis();
          if (ts instanceof Date) return ts.getTime();
          if (typeof ts.seconds === 'number') return ts.seconds * 1000;
          const d = new Date(ts);
          return isNaN(d.getTime()) ? Date.now() : d.getTime();
        };
        return getMillis(b.createdAt) - getMillis(a.createdAt);
      });

      // 신규 모임 감지 후 알림 발송
      const currentIds = new Set(mets.map(m => m.id));
      if (knownMeetingIds.current === null) {
        // 최초 로드 - 기존 목록만 저장, 알림 없음
        knownMeetingIds.current = currentIds;
      } else {
        mets.forEach(m => {
          if (!knownMeetingIds.current!.has(m.id)) {
            notify('🍽️ 새 런치클럽 모임 등록!', `${m.title} — ${m.date}`);
          }
        });
        knownMeetingIds.current = currentIds;
      }

      setMeetings(mets);
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error("Meetings listener failed:", err);
      setLoading(false);
    });

    // 2. Listen to registrations
    const rQ = query(collection(db, 'meeting_registrations'));
    const rUnsub = onSnapshot(rQ, (snapshot) => {
      const myRegs = new Set<string>();
      const allRegs: any[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        if (data.userId === userId) {
          myRegs.add(data.meetingId);
        }
        allRegs.push({ id: d.id, ...data });
      });
      setMyRegistrations(myRegs);
      setAllRegistrations(allRegs);
      setLoading(false);
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error("Registrations listener failed:", err);
      setLoading(false);
    });

    return () => {
      unsub();
      rUnsub();
    };
  }, [userId]);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminRole !== 'manager') return;
    try {
      const meetingId = `mtg_${Date.now()}`;
      await setDoc(doc(db, 'meetings', meetingId), {
        title: newTitle,
        date: `${newDate} ${newTime}`,
        maxAttendees: Number(newMax),
        attendeesCount: 0,
        createdAt: serverTimestamp()
      });
      setNewTitle('');
      setNewDate('');
      setNewTime('12:00');
      setNewMax(8);
    } catch (err) {
      console.error(err);
      safeAlert("모임 생성 실패");
    }
  };

  const handleRegister = async (meeting: Meeting) => {
    try {
      await runTransaction(db, async (transaction) => {
        const meetingRef = doc(db, 'meetings', meeting.id);
        const registrationRef = doc(db, 'meeting_registrations', `${meeting.id}_${userId}`);
        const userRef = doc(db, 'users', userId);
        
        const sfDoc = await transaction.get(meetingRef);
        if (!sfDoc.exists()) throw "Meeting does not exist!";
        
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User profile not found";
        
        const currentCount = sfDoc.data().attendeesCount || 0;
        const max = sfDoc.data().maxAttendees || 0;
        const currentPoints = userDoc.data().totalPoints || 0;
        
        if (currentCount >= max) {
          throw "정원이 마감되었습니다.";
        }
        
        transaction.update(meetingRef, { attendeesCount: currentCount + 1 });
        transaction.set(registrationRef, {
          userId,
          userName: profile.name,
          meetingId: meeting.id,
          createdAt: serverTimestamp()
        });

        transaction.update(userRef, {
          totalPoints: currentPoints + 10,
          lastMeetingId: meeting.id
        });
      });
      safeAlert('신청이 완료되어 10pt가 지급되었습니다!');
    } catch (err: any) {
      safeAlert(err.toString());
      console.error(err);
    }
  };

  const handleCancel = async (meeting: Meeting) => {
    try {
      await runTransaction(db, async (transaction) => {
        const meetingRef = doc(db, 'meetings', meeting.id);
        const registrationRef = doc(db, 'meeting_registrations', `${meeting.id}_${userId}`);
        const userRef = doc(db, 'users', userId);
        
        const sfDoc = await transaction.get(meetingRef);
        if (!sfDoc.exists()) throw "Meeting does not exist!";
        
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User profile not found";
        
        const currentCount = sfDoc.data().attendeesCount || 0;
        const currentPoints = userDoc.data().totalPoints || 0;
        
        transaction.update(meetingRef, { attendeesCount: Math.max(0, currentCount - 1) });
        transaction.delete(registrationRef);

        transaction.update(userRef, {
          totalPoints: Math.max(0, currentPoints - 10),
          lastMeetingId: "" // Reset lastMeetingId to trigger point change rule
        });
      });
      setConfirmDeleteReg(null);
      safeAlert('신청이 취소되었습니다.');
    } catch (err: any) {
      safeAlert(err.toString());
      console.error(err);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const batch = writeBatch(db);
      
      // 1. Delete meeting
      batch.delete(doc(db, 'meetings', meetingId));
      
      // 2. Delete related registrations using client state (avoids index requirement)
      const relatedRegs = allRegistrations.filter(r => r.meetingId === meetingId);
      relatedRegs.forEach(r => {
        batch.delete(doc(db, 'meeting_registrations', r.id));
      });

      await batch.commit();
      setConfirmDeleteMtg(null);
      safeAlert('삭제되었습니다.');
    } catch (err) {
      console.error(err);
      safeAlert('삭제 실패');
    }
  };

  const handleStartEdit = (m: Meeting) => {
    setEditingMeetingId(m.id);
    setEditTitle(m.title);
    
    const parts = m.date.split(' ');
    setEditDate(parts[0] || '');
    setEditTime(parts[1] || '12:00');
    
    setEditMax(m.maxAttendees);
  };

  const handleUpdateMeeting = async (meetingId: string) => {
    try {
      await updateDoc(doc(db, 'meetings', meetingId), {
        title: editTitle,
        date: `${editDate} ${editTime}`,
        maxAttendees: Number(editMax)
      });
      setEditingMeetingId(null);
      safeAlert('수정되었습니다.');
    } catch (err) {
      console.error(err);
      safeAlert('수정 실패');
    }
  };

  if (loading) return <div>불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-500">
      {/* Manager Controls */}
      {adminRole === 'manager' && (
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <CalendarCheck size={14} className="text-indigo-400" /> 신규 모임 일정 생성
          </h3>
          <form onSubmit={handleCreateMeeting} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">식별자 (제목)</label>
              <input type="text" required value={newTitle} onChange={v => setNewTitle(v.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500 font-medium" placeholder="예: 첫 번째 세션" />
            </div>
            <div className="w-full sm:w-64 shrink-0 space-y-1.5 flex gap-2">
              <div className="flex-1 space-y-1.5 ">
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">날짜선택</label>
                <div className="relative group cursor-pointer" onClick={e => {
                  const input = e.currentTarget.querySelector('input');
                  if (input) try { input.showPicker(); } catch {}
                }}>
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500/70 group-hover:text-indigo-400 transition-colors pointer-events-none" />
                  <input type="date" required value={newDate} onChange={v => setNewDate(v.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 pl-9 text-xs text-white outline-none focus:border-indigo-500 font-mono [color-scheme:dark] cursor-pointer" />
                </div>
              </div>
              <div className="w-24 space-y-1.5">
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">시간</label>
                <input type="time" required value={newTime} onChange={v => setNewTime(v.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500 font-mono [color-scheme:dark] cursor-pointer" onClick={e => { try { (e.target as HTMLInputElement).showPicker(); } catch {} }} />
              </div>
            </div>
             <div className="w-24 shrink-0 space-y-1.5">
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">정원</label>
              <input type="number" required min="1" value={newMax} onChange={v => setNewMax(Number(v.target.value))}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500 font-mono" />
            </div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-8 py-2.5 rounded-lg shrink-0 h-[38px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">
              확정
            </button>
          </form>
        </div>
      )}

      {/* Meeting List */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
           <h3 className="text-[12px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 활성 오프라인 모임 명부
           </h3>
           <div className="flex items-center gap-3">
             <span className="text-[10px] font-mono text-slate-500">{meetings.length}개의 노드 발견됨</span>
             <button
               onClick={toggle}
               title={notifEnabled ? '알림 끄기' : (permission === 'denied' ? '브라우저 알림이 차단됨' : '알림 켜기')}
               className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                 notifEnabled
                   ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/30'
                   : permission === 'denied'
                   ? 'bg-slate-800/50 text-slate-600 border-slate-700/50 cursor-not-allowed'
                   : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-white hover:border-slate-500'
               }`}
             >
               {notifEnabled ? <Bell size={12} /> : <BellOff size={12} />}
               {notifEnabled ? '알림 ON' : '알림 OFF'}
             </button>
           </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {meetings.map(m => {
            const isRegistered = myRegistrations.has(m.id);
            const isFull = m.attendeesCount >= m.maxAttendees;
            const attendees = allRegistrations.filter(r => r.meetingId === m.id);

            return (
              <div key={m.id} className={`group bg-[#1e293b] rounded-xl border ${isRegistered ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-slate-800'} shadow-xl flex flex-col relative overflow-hidden transition-all hover:border-slate-700`}>
                {isRegistered && (
                   <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-lg shadow-sm uppercase tracking-tighter">
                     참여 확정됨
                   </div>
                )}
                
                <div className="p-6 flex flex-col gap-5">
                  {editingMeetingId === m.id ? (
                    <div className="flex flex-col gap-3 p-3 bg-[#0f172a] rounded-lg border border-slate-800 animate-in zoom-in duration-200">
                       <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-transparent text-[14px] font-bold p-2 border-b border-slate-700 outline-none focus:border-indigo-500 text-white w-full" />
                       <div className="flex gap-2">
                         <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="bg-transparent text-[11px] p-2 border-b border-slate-700 outline-none focus:border-indigo-500 text-slate-400 flex-1 font-mono" />
                         <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="bg-transparent text-[11px] p-2 border-b border-slate-700 outline-none focus:border-indigo-500 text-slate-400 w-24 font-mono" />
                         <input type="number" value={editMax} onChange={e => setEditMax(Number(e.target.value))} className="bg-transparent text-[11px] p-2 border-b border-slate-700 outline-none focus:border-indigo-500 text-slate-400 w-16 font-mono" />
                       </div>
                       <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setEditingMeetingId(null)} className="p-2 text-slate-500 hover:text-slate-300 transition-colors"><X size={16}/></button>
                          <button onClick={() => handleUpdateMeeting(m.id)} className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors"><Check size={16}/></button>
                       </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-[15px] font-bold text-white tracking-tight leading-tight group-hover:text-indigo-400 transition-colors">{m.title}</h4>
                        {adminRole === 'manager' && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleStartEdit(m)} className="p-1.5 text-slate-600 hover:text-indigo-400 transition-colors">
                                <Pencil size={12} />
                              </button>
                              {confirmDeleteMtg === m.id ? (
                                <button onClick={() => handleDeleteMeeting(m.id)} className="p-1.5 text-xs font-bold text-white bg-rose-600 rounded whitespace-nowrap">
                                  진짜 삭제?
                                </button>
                              ) : (
                                <button onClick={() => setConfirmDeleteMtg(m.id)} className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold font-mono flex items-center gap-1.5 uppercase tracking-widest mt-1">
                        <CalendarCheck size={12} className="text-slate-600" />
                        {m.date}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-[#0f172a] h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full transition-all duration-700 ${isFull ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                        style={{ width: `${(m.attendeesCount / m.maxAttendees) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-mono font-black text-slate-400 whitespace-nowrap">
                       {m.attendeesCount.toString().padStart(2, '0')} / {m.maxAttendees.toString().padStart(2, '0')} <span className="opacity-40 uppercase">점유율</span>
                    </span>
                  </div>

                  <div className="min-h-[32px] flex flex-wrap gap-1.5">
                    {attendees.map((reg) => (
                       <div key={reg.id} className="w-6 h-6 rounded bg-[#0f172a] border border-slate-700 flex items-center justify-center overflow-hidden hover:border-indigo-500 transition-colors cursor-help" title={reg.userName}>
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${reg.userId}`} alt="att" />
                       </div>
                    ))}
                    {attendees.length === 0 && <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest self-center italic">참여자를 기다리는 중...</span>}
                  </div>

                  <div className="pt-2">
                    {!isRegistered ? (
                      <button 
                        onClick={() => handleRegister(m)}
                        disabled={isFull}
                        className={`w-full text-[11px] font-bold px-5 py-2.5 rounded-lg transition-all shadow-lg uppercase tracking-widest active:scale-95 ${
                          isFull 
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        {isFull ? '정원 초과' : '참여 신청하기'}
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-400 bg-emerald-900/20 px-3 py-2.5 rounded-lg border border-emerald-500/30 uppercase tracking-tighter">
                          <Check size={14} strokeWidth={3} /> 참여 중
                        </div>
                        {confirmDeleteReg === m.id ? (
                          <button 
                            onClick={() => handleCancel(m)}
                            className="text-[10px] font-black text-white bg-rose-600 px-3 py-2.5 rounded-lg transition-all border border-rose-500 uppercase tracking-tighter"
                          >
                            정말 취소?
                          </button>
                        ) : (
                          <button 
                            onClick={() => setConfirmDeleteReg(m.id)}
                            className="text-[10px] font-black text-slate-400 hover:text-white hover:bg-rose-900/30 px-3 py-2.5 rounded-lg transition-all border border-slate-700 hover:border-rose-500/50 uppercase tracking-tighter"
                          >
                            참여 취소
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {(adminRole || isRegistered) && attendees.length > 0 && (
                  <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-800/50">
                    <h5 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">참여자 명단</h5>
                    <div className="flex flex-wrap gap-2">
                        {attendees.map((reg, idx) => (
                           <span key={reg.id} className="text-[10px] font-mono font-bold bg-[#1e293b] border border-slate-800 text-slate-400 px-2 py-0.5 rounded shadow-sm hover:text-white hover:border-slate-600 transition-colors">
                             {reg.userName}
                           </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
