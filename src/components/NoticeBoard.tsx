import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, addDoc, deleteDoc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Megaphone, Plus, Trash2, Pin, MessageSquare, Image as ImageIcon, Link as LinkIcon, X, Check, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { UserProfile } from '../hooks/useUserRole';

interface Post {
  id: string;
  title?: string;
  content: string;
  category: 'notice' | 'free';
  isImportant?: boolean;
  image?: string;
  authorUid: string;
  authorName: string;
  createdAt: any;
  updatedAt?: any;
}

export default function NoticeBoard({ adminRole, profile }: { adminRole: 'manager' | 'treasurer' | null, profile: UserProfile }) {
  const [activeCategory, setActiveCategory] = useState<'notice' | 'free'>('notice');
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const safeAlert = (msg: string) => {
    try { window.alert(msg); } catch (e) { console.log(msg); }
  };

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Post[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Post));
      setPosts(list);
      setLoading(false);
    }, (err: any) => {
      console.warn("Board access error:", err.code);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Target roughly 300KB. 
          // Base64 overhead is ~33%. 300KB binary -> ~400KB base64.
          const TARGET_BASE64_LENGTH = 400000;
          const MAX_SIZE = 1200; 
          
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
          
          // Quality tuning loop
          let quality = 0.8;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // If still too large, step down quality aggressively
          if (dataUrl.length > TARGET_BASE64_LENGTH) {
            quality = 0.5;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length > TARGET_BASE64_LENGTH) {
            quality = 0.2;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          
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
    
    // Check if file is already small enough (300KB = 307200 bytes)
    if (file.size <= 307200) {
      const reader = new FileReader();
      reader.onload = (e) => setImage(e.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    setIsResizing(true);
    try {
      const resized = await resizeImage(file);
      setImage(resized);
    } catch (err) {
      console.error("Image resize error:", err);
    } finally {
      setIsResizing(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (activeCategory === 'notice' && !title.trim()) return;
    
    try {
      console.log("Attempting to create post with profile:", profile);
      const payload: any = {
        content: content.trim(),
        category: activeCategory,
        authorUid: profile?.uid || auth.currentUser?.uid,
        authorName: profile?.name || auth.currentUser?.displayName || '무명 실행자',
        createdAt: serverTimestamp(),
        title: activeCategory === 'notice' ? title.trim() : '',
        isImportant: activeCategory === 'notice' ? isImportant : false
      };

      if (!payload.authorUid) {
        throw new Error("사용자 인증 정보가 없습니다. 다시 로그인해 주세요.");
      }

      if (image) {
        payload.image = image;
      }

      await addDoc(collection(db, 'posts'), payload);
      setTitle('');
      setContent('');
      setIsImportant(false);
      setImage(null);
      safeAlert('게시글 등록 성공!');
    } catch (err: any) {
      console.error("Create Post Error:", err);
      safeAlert('등록 실패: ' + (err.message || '알 수 없는 오류'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      safeAlert('삭제 실패');
    }
  };

  const handleStartEdit = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'posts', id), {
        content: editContent,
        updatedAt: serverTimestamp()
      });
      setEditingPostId(null);
    } catch (e) {
      console.error(e);
      safeAlert('수정 실패');
    }
  };

  const renderText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all font-bold">
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (loading) return <div className="p-10 text-center text-slate-200 font-mono tracking-widest text-[16px]">데이터 연동 중...</div>;

  const filteredPosts = posts.filter(p => p.category === activeCategory);
  if (activeCategory === 'notice') {
    filteredPosts.sort((a, b) => {
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;
      return 0;
    });
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Category Tabs */}
      <div className="flex bg-[#1e293b] p-1 rounded-xl border border-slate-800 shadow-xl self-start">
        <button 
          onClick={() => { setActiveCategory('notice'); setImage(null); }}
          className={`px-6 py-2 rounded-lg text-[16px] font-black transition-all uppercase tracking-widest flex items-center gap-2 ${activeCategory === 'notice' ? 'bg-[#0f172a] text-indigo-400 shadow-2xl border border-slate-700' : 'text-slate-300 hover:text-slate-300'}`}
        >
          <Megaphone size={14} /> 공지사항
        </button>
        <button 
          onClick={() => { setActiveCategory('free'); setImage(null); }}
          className={`px-6 py-2 rounded-lg text-[16px] font-black transition-all uppercase tracking-widest flex items-center gap-2 ${activeCategory === 'free' ? 'bg-[#0f172a] text-emerald-400 shadow-2xl border border-slate-700' : 'text-slate-300 hover:text-slate-300'}`}
        >
          <MessageSquare size={14} /> 자유게시판
        </button>
      </div>

      {/* Post Creation (Restricted for notices, free for everyone) */}
      {(activeCategory === 'free' || (activeCategory === 'notice' && adminRole === 'manager')) && (
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <h3 className="text-[16px] font-bold mb-4 flex items-center gap-2 text-slate-200 uppercase tracking-widest">
            <Plus size={14} className={activeCategory === 'notice' ? 'text-indigo-500' : 'text-emerald-500'} /> {activeCategory === 'notice' ? '신규 공지 등록' : '새로운 게시글 작성'}
          </h3>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {activeCategory === 'notice' && (
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                placeholder="제목"
                className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-[19px] text-white outline-none focus:border-indigo-500 font-bold"
                required
              />
            )}
            <div className="relative">
              <textarea 
                value={content} 
                onChange={e => setContent(e.target.value)}
                placeholder={activeCategory === 'notice' ? "내용을 입력하세요..." : "자유롭게 이야기를 나누세요 (링크 지원)"}
                rows={4}
                className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-[19px] text-white outline-none focus:border-indigo-500 font-medium leading-relaxed resize-none"
                required
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-4">
                <input type="file" id="post-image" className="hidden" accept="image/*" onChange={handleFileChange} />
                <label htmlFor="post-image" className="cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <ImageIcon size={18} />
                </label>
              </div>
            </div>

            {image && (
              <div className="relative w-32 h-32 rounded-lg border border-slate-700 overflow-hidden group">
                <img src={image} className="w-full h-full object-cover" alt="preview" />
                <button 
                  type="button" 
                  onClick={() => setImage(null)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              {activeCategory === 'notice' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isImportant} 
                    onChange={e => setIsImportant(e.target.checked)}
                    className="rounded border-slate-700 bg-[#0f172a] text-indigo-600 focus:ring-indigo-500 h-4 w-4" 
                  />
                  <span className="text-[16px] text-slate-200 font-bold uppercase tracking-wide">중요 고정</span>
                </label>
              ) : <div></div>}
              <button 
                type="submit"
                disabled={isResizing}
                className={`${activeCategory === 'notice' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white text-[16px] font-black px-10 py-3 rounded-xl transition-all uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50`}
              >
                {isResizing ? '이미지 최적화 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts Feed */}
      <div className="flex flex-col gap-4">
        {filteredPosts.map(post => (
          <div key={post.id} className={`bg-[#1e293b] p-6 rounded-2xl border ${post.isImportant ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-slate-800'} shadow-lg relative group transition-all hover:border-slate-700`}>
            {post.isImportant && (
              <div className="absolute top-4 right-4 text-indigo-400">
                <Pin size={14} fill="currentColor" />
              </div>
            )}
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded bg-indigo-900/30 flex items-center justify-center text-[15px] font-black text-indigo-400">
                    {post.authorName.slice(0, 1)}
                  </div>
                  <span className="text-[16px] font-bold text-slate-300">{post.authorName}</span>
                  <span className="text-[15px] text-slate-300 italic font-mono truncate max-w-[100px]">({post.authorUid.slice(0, 8)})</span>
                </div>
                {post.title && (
                  <h4 className="text-[24px] font-black text-white tracking-tight">
                    {post.title}
                  </h4>
                )}
              </div>
              
              {(adminRole === 'manager' || post.authorUid === profile.uid) && (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleStartEdit(post)} className="text-slate-300 hover:text-amber-500 transition-colors p-1">
                    <Pencil size={14} />
                  </button>
                  {confirmDeleteId === post.id ? (
                    <button onClick={() => handleDelete(post.id)} className="text-[15px] font-black text-rose-500 hover:text-rose-400 bg-rose-500/10 px-2 py-1 rounded transition-colors">
                      삭제 확정
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(post.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {editingPostId === post.id ? (
              <div className="flex flex-col gap-3">
                <textarea 
                  value={editContent} 
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-[19px] text-white outline-none focus:border-indigo-500 font-medium resize-none"
                  rows={4}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingPostId(null)} className="p-2 text-slate-200 hover:bg-slate-800 rounded"><X size={16} /></button>
                  <button onClick={() => handleSaveEdit(post.id)} className="p-2 text-white bg-indigo-600 rounded hover:bg-indigo-500"><Check size={16} /></button>
                </div>
              </div>
            ) : (
              <div className="text-[19px] text-slate-300 whitespace-pre-wrap leading-relaxed mb-4 font-medium">
                {renderText(post.content)}
              </div>
            )}

            {post.image && (
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-800 shadow-2xl max-w-lg">
                <img 
                  src={post.image} 
                  alt="post content" 
                  className="w-full h-auto cursor-zoom-in brightness-90 hover:brightness-100 transition-all" 
                  onClick={() => window.open(post.image, '_blank')}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-[15px] text-slate-300 font-bold font-mono border-t border-slate-800/30 pt-4 uppercase tracking-widest">
              <span>{post.category === 'notice' ? '시스템 공지' : '자유 게시글'}</span>
              <span>{post.createdAt?.toDate ? format(post.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '동기화 중...'}</span>
            </div>
          </div>
        ))}
        {filteredPosts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center bg-[#1e293b] rounded-2xl border border-dashed border-slate-800">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mb-6 transition-transform">
              <Megaphone size={32} />
            </div>
            <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">게시글이 비어있습니다</h3>
            <p className="text-[16px] text-slate-300 font-mono tracking-widest uppercase mb-8">No transmissions detected in this frequency</p>
            {activeCategory === 'free' && (
              <p className="text-xs text-slate-200 max-w-xs font-medium">첫 번째 게시글을 작성하여 실행자들에게 메시지를 전송하세요.</p>
            )}
            {activeCategory === 'notice' && (
              <p className="text-xs text-slate-200 max-w-xs font-medium">현재 등록된 중요 공지사항이 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
