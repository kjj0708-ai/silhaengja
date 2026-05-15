import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp, writeBatch, getDocs, where, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../firebase';
import { UserProfile } from '../hooks/useUserRole';
import { CheckCircle2, Lock, Calendar, Plus, AlertCircle, Pencil, Trash2, X, Check } from 'lucide-react';

interface Mission {
  id: string;
  title: string;
  description: string;
  points: number;
  deadline?: any;
  createdAt: any;
}

interface MissionExecution {
  id: string;
  userId: string;
  userName: string;
  missionId: string;
  content: string;
  image?: string;
  submittedAt: any;
}

export default function MissionBoard({ 
  profile, 
  adminRole, 
}: { 
  profile: UserProfile; 
  adminRole: 'manager' | 'treasurer' | null; 
}) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [allExecutions, setAllExecutions] = useState<Map<string, MissionExecution[]>>(new Map()); // missionId -> executions[]
  const [loading, setLoading] = useState(true);
  const [showOngoing, setShowOngoing] = useState(true); // Toggle between Ongoing and Expired

  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPoints, setEditPoints] = useState(10);
  const [editDeadline, setEditDeadline] = useState('');

  const [editingExecId, setEditingExecId] = useState<string | null>(null);
  const [editExecContent, setEditExecContent] = useState('');

  const [confirmDeleteMissionId, setConfirmDeleteMissionId] = useState<string | null>(null);
  const [confirmDeleteExecId, setConfirmDeleteExecId] = useState<string | null>(null);

  const renderContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all">
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  useEffect(() => {
    // 1. Listen to all missions without orderBy to ensure local writes show up immediately
    const mq = collection(db, 'missions');
    const unMissions = onSnapshot(mq, (snapshot) => {
      const ms: Mission[] = [];
      snapshot.forEach(doc => ms.push({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) } as Mission));
      // Sort client-side: newest first, items with null createdAt (just created) at the top
      ms.sort((a, b) => {
        const getMillis = (ts: any) => {
          if (!ts) return Date.now() + 1000; // Local writes at the very top
          if (ts.toMillis) return ts.toMillis();
          if (ts.getTime) return ts.getTime();
          const d = new Date(ts);
          return isNaN(d.getTime()) ? Date.now() : d.getTime();
        };
        return getMillis(b.createdAt) - getMillis(a.createdAt);
      });
      setMissions(ms);
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error("Missions listener failed:", err);
      setLoading(false);
    });

    // 2. Listen to ALL executions for a shared feed
    const eq = collection(db, 'mission_executions');
    const unExecutions = onSnapshot(eq, (snapshot) => {
      const execs = new Map<string, MissionExecution[]>();
      snapshot.forEach(doc => {
        const data = doc.data({ serverTimestamps: 'estimate' }) as MissionExecution;
        const current = execs.get(data.missionId) || [];
        execs.set(data.missionId, [...current, { ...data, id: doc.id }]);
      });
      
      // Sort executions within each mission
      for (const [mId, list] of execs.entries()) {
        list.sort((a, b) => {
          const tA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : Date.now();
          const tB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : Date.now();
          return tB - tA;
        });
      }
      
      setAllExecutions(execs);
      setLoading(false);
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error("Executions listener failed:", err);
      setLoading(false);
    });

    return () => {
      unMissions();
      unExecutions();
    };
  }, [profile.uid]);

  // Manager form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(10); // Default 10
  const [deadline, setDeadline] = useState(''); // YYYY-MM-DD format
  const [isCreating, setIsCreating] = useState(false);

  const handlePointsChange = (val: number) => {
    // Ensure value is positive and rounded to nearest 5
    const stepped = Math.max(0, Math.round(val / 5) * 5);
    setPoints(stepped);
  };

  // Execution formulation state
  const [submittingMission, setSubmittingMission] = useState<string | null>(null);
  const [submitContent, setSubmitContent] = useState('');
  const [submitImage, setSubmitImage] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const lightboxScale = useRef(1);
  const lastTouchDist = useRef<number | null>(null);

  const safeAlert = (msg: string) => {
    try { window.alert(msg); } catch (e) { console.log(msg); }
  };

  const getSafeDate = (ts: any) => {
    if (!ts) return new Date();
    // 1. Firestore Timestamp
    if (typeof ts.toDate === 'function') return ts.toDate();
    // 2. JavaScript Date object
    if (ts instanceof Date) return ts;
    // 3. Serialized Firestore Timestamp or POJO with seconds/nanoseconds
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    // 4. Number (millis) or String (ISO)
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // Filter missions by deadline or 1 week (7 days)
  const ongoingMissions = missions.filter(m => {
    if (!m.createdAt) return true; // Newly created (null ts) are always ongoing
    
    // If deadline exists, use it
    if (m.deadline) {
      const deadlineDate = getSafeDate(m.deadline);
      // Set deadline to end of day
      deadlineDate.setHours(23, 59, 59, 999);
      return deadlineDate >= new Date();
    }

    // Fallback to 1 week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const createdAt = getSafeDate(m.createdAt);
    return createdAt > oneWeekAgo;
  });

  const expiredMissions = missions.filter(m => {
    if (!m.createdAt) return false;
    
    if (m.deadline) {
      const deadlineDate = getSafeDate(m.deadline);
      deadlineDate.setHours(23, 59, 59, 999);
      return deadlineDate < new Date();
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const createdAt = getSafeDate(m.createdAt);
    return createdAt <= oneWeekAgo;
  });

  const currentMissions = showOngoing ? ongoingMissions : expiredMissions;

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max size logic for roughly 100kb
          const MAX_SIZE = 800; 
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Start with high quality and reduce until < 100kb or min quality reached
          let quality = 0.7;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsResizing(true);
    try {
      const resized = await resizeImage(file);
      setSubmitImage(resized);
    } finally {
      setIsResizing(false);
    }
  };

  const handleStartEditMission = (m: Mission) => {
    setEditingMissionId(m.id);
    setEditTitle(m.title);
    setEditDescription(m.description);
    setEditPoints(m.points);
    if (m.deadline) {
      const d = getSafeDate(m.deadline);
      setEditDeadline(d.toISOString().split('T')[0]);
    } else {
      setEditDeadline('');
    }
  };

  const handleSaveEditMission = async (missionId: string) => {
    try {
      const payload: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        points: editPoints
      };

      if (editDeadline) {
        const d = new Date(editDeadline);
        d.setHours(23, 59, 59, 999);
        payload.deadline = d;
      } else {
        payload.deadline = null;
      }

      await updateDoc(doc(db, 'missions', missionId), payload);
      setEditingMissionId(null);
      safeAlert('미션이 수정되었습니다.');
    } catch (err: any) {
      console.error(err);
      safeAlert('수정 실패: ' + err.message);
    }
  };

  const handleDeleteMission = async (missionId: string) => {
    try {
      await deleteDoc(doc(db, 'missions', missionId));
      setConfirmDeleteMissionId(null);
      safeAlert('미션이 삭제되었습니다.');
    } catch (err: any) {
      console.error(err);
      safeAlert('삭제 실패: ' + err.message);
    }
  };

  const handleStartEditExec = (ex: MissionExecution) => {
    setEditingExecId(ex.id);
    setEditExecContent(ex.content);
  };

  const handleSaveEditExec = async (execId: string) => {
    try {
      if (!editExecContent.trim()) {
        alert("내용을 입력해주세요.");
        return;
      }
      await updateDoc(doc(db, 'mission_executions', execId), {
        content: editExecContent.trim()
      });
      setEditingExecId(null);
    } catch (err) {
      console.error(err);
      alert('수정 실패');
    }
  };

  const handleDeleteExec = async (exec: MissionExecution, missionPoints: number) => {
    try {
      // First delete the execution
      await deleteDoc(doc(db, 'mission_executions', exec.id));
      
      // Then try to deduct points (this might fail if rules are strict, but we prioritize deletion)
      try {
        const userRef = doc(db, 'users', exec.userId);
        const currentPoints = profile.uid === exec.userId ? profile.totalPoints : 0;
        
        if (currentPoints > 0) {
          await updateDoc(userRef, {
            totalPoints: Math.max(0, currentPoints - missionPoints)
          });
        }
      } catch (pointErr) {
        console.warn("Point deduction skipped or failed:", pointErr);
      }

      setConfirmDeleteExecId(null);
      safeAlert('인증이 삭제되었습니다.');
    } catch (err: any) {
      console.error("Delete execution error:", err);
      safeAlert('삭제 실패: ' + (err.message || '권한이 없거나 오류가 발생했습니다.'));
    }
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminRole !== 'manager' || isCreating) return;
    
    setIsCreating(true);
    try {
      const mId = `msn_${Date.now()}`;
      
      // Construct Payload dynamically
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        points: Number(points),
        createdAt: serverTimestamp()
      };
      
      if (deadline) {
        const d = new Date(deadline);
        d.setHours(23, 59, 59, 999); // End of day
        payload.deadline = d;
      }

      await setDoc(doc(db, 'missions', mId), payload);
      
      setTitle('');
      setDescription('');
      setPoints(10);
      setDeadline('');
      safeAlert('미션이 성공적으로 등록되었습니다! 🚀');
    } catch (err: any) {
      console.error(err);
      safeAlert("미션 등록 실패: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleExecutionSubmit = async (e: React.FormEvent, mission: Mission) => {
    e.preventDefault();
    if (!submitContent.trim() && !submitImage) return;

    try {
      const batch = writeBatch(db);
      
      const execId = `${mission.id}_${profile.uid}`;
      const execRef = doc(db, 'mission_executions', execId);
      batch.set(execRef, {
        userId: profile.uid,
        userName: profile.name, // denormalize for speed
        missionId: mission.id,
        content: submitContent,
        image: submitImage,
        submittedAt: serverTimestamp()
      });

      const userRef = doc(db, 'users', profile.uid);
      batch.update(userRef, {
        totalPoints: profile.totalPoints + mission.points,
        lastMissionId: mission.id
      });

      await batch.commit();

      setSubmittingMission(null);
      setSubmitContent('');
      setSubmitImage(null);
      safeAlert(`인증 완료! ${mission.points}pt 획득 ⚡️`);
    } catch (err: any) {
      safeAlert("제출 실패: " + err.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-300">데이터 동기화 중...</div>;

  return (
    <div className="flex flex-col gap-6 w-full pb-10 animate-in fade-in duration-500">
      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/60 rounded-full p-2 z-10"
            onClick={() => setLightboxImage(null)}
          >
            <X size={22} />
          </button>
          <div
            className="overflow-auto flex items-center justify-center"
            style={{ width: '100vw', height: '100vh', touchAction: 'none' }}
            onClick={e => e.stopPropagation()}
            onTouchMove={e => {
              if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (lastTouchDist.current !== null) {
                  const delta = dist / lastTouchDist.current;
                  lightboxScale.current = Math.min(5, Math.max(1, lightboxScale.current * delta));
                  const img = e.currentTarget.querySelector('img') as HTMLImageElement;
                  if (img) img.style.transform = `scale(${lightboxScale.current})`;
                }
                lastTouchDist.current = dist;
              }
            }}
            onTouchEnd={() => { lastTouchDist.current = null; }}
          >
            <img
              src={lightboxImage}
              alt="확대 이미지"
              style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', transition: 'transform 0.1s', transformOrigin: 'center center' }}
            />
          </div>
        </div>
      )}
      
      {/* Manager Tools */}
      {adminRole === 'manager' && (
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[15px] font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
              <Plus size={14} className="text-amber-500" /> 신규 미션 배포
            </h3>
            <span className="text-[17px] bg-amber-900/30 text-amber-500 px-2.5 py-1 rounded-full font-black border border-amber-500/20 uppercase tracking-widest">권한: 관리자</span>
          </div>
          
          <form onSubmit={handleCreateMission} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3 space-y-1.5">
                <label className="block text-[13px] font-bold text-slate-300 uppercase tracking-wider">제목</label>
                <input 
                  type="text" 
                  required 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#0f172a] border border-slate-700 rounded-lg outline-none focus:border-amber-500 text-white transition-all font-medium" 
                  placeholder="예: 코드브레이커 작전" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-bold text-slate-300 uppercase tracking-wider">보상 포인트</label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => handlePointsChange(points - 5)} className="w-8 h-9 bg-slate-800 border border-slate-700 rounded text-slate-200 hover:bg-slate-700 transition-colors">-</button>
                  <input 
                    type="number" 
                    required 
                    min="0" 
                    step="5" 
                    value={points} 
                    onChange={e => handlePointsChange(Number(e.target.value))}
                    className="flex-1 h-9 bg-[#0f172a] border border-slate-700 rounded text-xs text-white outline-none focus:border-amber-500 font-mono text-center" 
                  />
                  <button type="button" onClick={() => handlePointsChange(points + 5)} className="w-8 h-9 bg-slate-800 border border-slate-700 rounded text-slate-200 hover:bg-slate-700 transition-colors">+</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3 space-y-1.5">
                <label className="block text-[13px] font-bold text-slate-300 uppercase tracking-wider">설명</label>
                <input 
                  type="text" 
                  required 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#0f172a] border border-slate-700 rounded-lg outline-none focus:border-amber-500 text-white transition-all" 
                  placeholder="예: 리뷰를 위한 설계도면을 업로드하세요." 
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-bold text-slate-300 uppercase tracking-wider">
                  마감 종료일
                </label>
                <div className="relative group cursor-pointer" onClick={e => {
                  const input = e.currentTarget.querySelector('input');
                  if (input) try { input.showPicker(); } catch {}
                }}>
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/70 group-hover:text-amber-500 transition-colors z-10" />
                  <input 
                    type="date" 
                    value={deadline} 
                    onChange={e => setDeadline(e.target.value)}
                    className="w-full text-xs p-2.5 pl-9 bg-[#0f172a] border border-slate-700 rounded-lg outline-none focus:border-amber-500 text-white font-mono transition-all [color-scheme:dark] cursor-pointer" 
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isCreating}
              className="w-full bg-slate-100 hover:bg-white disabled:bg-slate-800 text-[#0f172a] font-black py-3 rounded-lg text-[15px] transition-all shadow-xl uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95"
            >
              {isCreating ? '네트워크 요청 처리 중...' : '신규미션 생성'}
            </button>
          </form>
        </div>
      )}

      {/* Mission List Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-6 border-b border-slate-800 pb-4">
        <h3 className="text-[16px] font-black text-white uppercase tracking-widest flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 미션 인증
        </h3>
        <div className="flex bg-[#0f172a] p-1 rounded-lg border border-slate-800">
          <button 
            onClick={() => setShowOngoing(true)}
            className={`px-4 py-1.5 rounded text-[13px] font-bold transition-all uppercase tracking-tight ${showOngoing ? 'bg-[#1e293b] text-indigo-400 shadow-xl border border-slate-700' : 'text-slate-300 hover:text-slate-300'}`}
          >
            진행 중인 미션 ({ongoingMissions.length})
          </button>
          <button 
            onClick={() => setShowOngoing(false)}
            className={`px-4 py-1.5 rounded text-[13px] font-bold transition-all uppercase tracking-tight ${!showOngoing ? 'bg-[#1e293b] text-white shadow-xl border border-slate-700' : 'text-slate-300 hover:text-slate-300'}`}
          >
            종료된 미션 ({expiredMissions.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {currentMissions.length === 0 && (
          <div className="md:col-span-2 py-24 text-center bg-[#1e293b] rounded-xl border border-dashed border-slate-800 flex flex-col items-center gap-3">
            <AlertCircle size={32} className="text-slate-700" />
            <p className="text-[13px] text-slate-300 font-bold uppercase tracking-widest">표시할 미션 데이터가 없습니다.</p>
          </div>
        )}
        
        {currentMissions.map(m => {
          const mExecutions = allExecutions.get(m.id) || [];
          const myExecution = mExecutions.find(e => e.userId === profile.uid);
          const isSubmitted = !!myExecution;
          const isSubmitting = submittingMission === m.id;
          const mDeadline = m.deadline ? getSafeDate(m.deadline) : null;

          return (
            <div key={m.id} className={`bg-[#1e293b] rounded-xl border ${isSubmitted ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' : 'border-slate-800'} overflow-hidden flex flex-col shadow-2xl transition-all hover:border-slate-700 group`}>
              <div className="p-6 border-b border-slate-800/50 bg-[#1e293b]">
                {editingMissionId === m.id ? (
                  <div className="flex flex-col gap-3 animate-in zoom-in duration-200">
                    <input 
                      type="text" 
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)}
                      className="bg-[#0f172a] text-[19px] font-bold p-2 border border-slate-700 rounded outline-none focus:border-amber-500 text-white w-full"
                    />
                    <textarea 
                      value={editDescription} 
                      onChange={e => setEditDescription(e.target.value)}
                      className="bg-[#0f172a] text-xs p-2 border border-slate-700 rounded outline-none focus:border-amber-500 text-slate-300 w-full min-h-[60px] resize-none"
                    />
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 flex items-center gap-1 bg-[#0f172a] border border-slate-700 rounded px-2">
                        <span className="text-[13px] text-slate-300 font-bold">PT</span>
                        <input 
                          type="number" 
                          step="5"
                          value={editPoints} 
                          onChange={e => setEditPoints(Number(e.target.value))}
                          className="bg-transparent text-[15px] p-2 outline-none text-white w-full font-mono text-center"
                        />
                      </div>
                      <input 
                        type="date" 
                        value={editDeadline} 
                        onChange={e => setEditDeadline(e.target.value)}
                        className="bg-[#0f172a] text-[15px] p-2 border border-slate-700 rounded outline-none focus:border-amber-500 text-slate-300 font-mono [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                      <button onClick={() => setEditingMissionId(null)} className="p-2 text-slate-200 hover:bg-slate-800 rounded transition-colors"><X size={16}/></button>
                      <button onClick={() => handleSaveEditMission(m.id)} className="p-2 text-amber-500 hover:bg-amber-500/10 rounded transition-colors"><Check size={16}/></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-[20px] font-bold text-white tracking-tight leading-tight group-hover:text-indigo-400 transition-colors uppercase">{m.title}</h4>
                        {adminRole === 'manager' && (
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleStartEditMission(m)} className="p-1 text-slate-300 hover:text-amber-500 transition-colors"><Pencil size={12} /></button>
                            {confirmDeleteMissionId === m.id ? (
                               <button 
                                 onClick={() => handleDeleteMission(m.id)} 
                                 className="px-2 py-1 bg-red-600 text-white text-[17px] font-bold rounded animate-pulse"
                               >
                                 정말 삭제?
                               </button>
                            ) : (
                               <button onClick={() => setConfirmDeleteMissionId(m.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 bg-indigo-900/30 text-indigo-400 font-bold font-mono text-[15px] px-2.5 py-1 rounded border border-indigo-500/20 shadow-sm">
                        +{m.points}
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed mb-4">{m.description}</p>
                    <div className="flex items-center gap-4 text-[17px] text-slate-300 font-bold uppercase tracking-widest font-mono">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="opacity-50" />
                        {m.createdAt?.toDate ? format(m.createdAt.toDate(), 'yyyy.MM.dd') : '전송 중...'}
                      </div>
                      {mDeadline && (
                        <div className={`flex items-center gap-1 ${showOngoing ? 'text-amber-500' : 'text-rose-500'}`}>
                          <Lock size={12} className="opacity-50" />
                          기한: {format(mDeadline, 'yyyy.MM.dd')}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Feed of verifications */}
              <div className="flex-1 p-5 flex flex-col gap-4 max-h-[300px] overflow-y-auto bg-[#0f172a]">
                <div className="flex items-center justify-between sticky top-0 bg-[#0f172a]/90 backdrop-blur-md py-1 z-10">
                  <h5 className="text-[17px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    ({mExecutions.length})
                  </h5>
                </div>
                
                {mExecutions.length === 0 && (
                  <div className="py-12 text-center flex flex-col items-center gap-2">
                    <p className="text-[17px] text-slate-300 font-bold uppercase tracking-widest italic">인증 대기 중...</p>
                  </div>
                )}
                
                {mExecutions.map(ex => (
                  <div key={ex.id} className="flex gap-3 items-start py-2 group/item">
                    <div className="w-7 h-7 rounded bg-indigo-900/30 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-indigo-400">{ex.userName.slice(0, 1)}</span>
                    </div>
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[15px] font-bold text-slate-300">{ex.userName}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[17px] text-slate-300 font-mono">{ex.submittedAt?.toDate ? format(ex.submittedAt.toDate(), 'MM.dd HH:mm') : ''}</span>
                          {(ex.userId === profile.uid || adminRole === 'manager') && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              {ex.userId === profile.uid && (
                                <button onClick={() => handleStartEditExec(ex)} className="p-1 hover:text-indigo-400 text-slate-300"><Pencil size={10} /></button>
                              )}
                              
                              {confirmDeleteExecId === ex.id ? (
                                <button 
                                  onClick={() => handleDeleteExec(ex, m.points)} 
                                  className="px-1.5 py-0.5 bg-red-600 text-white text-[12px] font-bold rounded"
                                >
                                  삭제?
                                </button>
                              ) : (
                                <button onClick={() => setConfirmDeleteExecId(ex.id)} className="p-1 hover:text-red-400 text-slate-300"><Trash2 size={10} /></button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {editingExecId === ex.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea 
                            value={editExecContent} 
                            onChange={e => setEditExecContent(e.target.value)} 
                            className="w-full text-[16px] bg-[#0f172a] border border-indigo-500/50 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500 resize-none min-h-[60px]"
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingExecId(null)} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors"><X size={12} /></button>
                            <button onClick={() => handleSaveEditExec(ex.id)} className="p-1.5 hover:bg-indigo-500/20 rounded text-indigo-400 hover:text-indigo-300 transition-colors"><Check size={12} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[16px] text-slate-300 whitespace-pre-wrap break-words bg-[#1e293b]/50 p-2.5 rounded-lg border border-slate-800 group-hover/item:border-indigo-500/30 transition-all">
                          {renderContent(ex.content)}
                        </div>
                      )}
                      
                      {ex.image && (
                         <div className="mt-1 w-full max-w-[200px] overflow-hidden rounded-lg border border-slate-800 shadow-xl">
                           <img
                             src={ex.image}
                             alt="intel"
                             className="w-full h-auto cursor-zoom-in brightness-90 hover:brightness-100 transition-all opacity-80 hover:opacity-100"
                             onClick={() => { lightboxScale.current = 1; setLightboxImage(ex.image!); }}
                           />
                         </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Submission Area */}
              <div className="p-5 bg-[#1e293b] border-t border-slate-800">
                {!isSubmitted ? (
                  <>
                    {!showOngoing ? (
                      <div className="text-center py-2">
                        <span className="text-[13px] font-bold text-slate-300 bg-[#0f172a] px-6 py-2 rounded border border-slate-800 flex items-center justify-center gap-2 uppercase tracking-widest">
                           <Lock size={12} className="opacity-50" /> 프로토콜 종료됨
                        </span>
                      </div>
                    ) : (
                      <>
                        {isSubmitting ? (
                          <form onSubmit={(e) => handleExecutionSubmit(e, m)} className="flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
                             <textarea 
                                required={!submitImage}
                                rows={2}
                                value={submitContent}
                                onChange={(e) => setSubmitContent(e.target.value)}
                                className="w-full text-xs p-3 bg-[#0f172a] border border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-white resize-none shadow-inner transition-all placeholder:text-slate-300"
                                placeholder="..."
                             />
                             
                             <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileChange}
                                    className="hidden" 
                                    id={`file-${m.id}`}
                                  />
                                  <label 
                                    htmlFor={`file-${m.id}`}
                                    className={`text-[17px] font-black px-3 py-2 rounded cursor-pointer border uppercase tracking-widest transition-all ${
                                      submitImage ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#0f172a] border-slate-700 text-slate-200 hover:text-white'
                                    }`}
                                  >
                                    {isResizing ? '이미지 처리 중...' : submitImage ? '이미지 로드됨' : '이미지 첨부'}
                                  </label>
                                  {submitImage && (
                                    <button type="button" onClick={() => setSubmitImage(null)} className="text-[17px] text-rose-500 font-bold uppercase">삭제</button>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => {
                                    setSubmittingMission(null);
                                    setSubmitImage(null);
                                    setSubmitContent('');
                                  }} className="text-[13px] font-bold text-slate-300 px-3 py-2 hover:text-white transition-colors uppercase">취소</button>
                                  <button type="submit" disabled={isResizing} className="text-[13px] font-black bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded shadow-lg disabled:opacity-50 transition-all uppercase tracking-widest active:scale-95">
                                    등록하기
                                  </button>
                                </div>
                             </div>
                             {submitImage && (
                               <div className="w-16 h-16 rounded border border-slate-700 overflow-hidden shadow-2xl">
                                 <img src={submitImage} className="w-full h-full object-cover" alt="preview" />
                               </div>
                             )}
                          </form>
                        ) : (
                          <button 
                            onClick={() => setSubmittingMission(m.id)}
                            className="w-full py-3 bg-indigo-600 text-white font-black rounded-lg text-[15px] hover:bg-indigo-500 transition-all shadow-xl uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Plus size={14} /> 미션 실행 인증하기
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-3 bg-emerald-900/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-[13px] font-black uppercase tracking-widest">인증 상태: 완료됨</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
