import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, addDoc, deleteDoc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Megaphone, Plus, Trash2, Pin, MessageSquare, Image as ImageIcon, X, Check, Pencil, ChevronDown, ChevronUp, CornerDownRight, Send } from 'lucide-react';
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

interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  authorUid: string;
  authorName: string;
  createdAt: any;
}

export default function NoticeBoard({ adminRole, profile }: { adminRole: 'manager' | 'treasurer' | null, profile: UserProfile }) {
  const [activeCategory, setActiveCategory] = useState<'notice' | 'free'>('notice');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Comment state
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<{[postId: string]: string}>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // comment ID
  const [replyInputs, setReplyInputs] = useState<{[commentId: string]: string}>({});
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);

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

    const cq = query(collection(db, 'post_comments'), orderBy('createdAt', 'asc'));
    const cUnsub = onSnapshot(cq, (snap) => {
      const list: Comment[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Comment));
      setComments(list);
    }, (err: any) => {
      console.warn("Comments access error:", err.code);
    });

    return () => { unsub(); cUnsub(); };
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
          const TARGET_BASE64_LENGTH = 400000;
          const MAX_SIZE = 1200;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          let quality = 0.8;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          if (dataUrl.length > TARGET_BASE64_LENGTH) { quality = 0.5; dataUrl = canvas.toDataURL('image/jpeg', quality); }
          if (dataUrl.length > TARGET_BASE64_LENGTH) { quality = 0.2; dataUrl = canvas.toDataURL('image/jpeg', quality); }
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
      const payload: any = {
        content: content.trim(),
        category: activeCategory,
        authorUid: profile?.uid || auth.currentUser?.uid,
        authorName: profile?.name || auth.currentUser?.displayName || '무명 실행자',
        createdAt: serverTimestamp(),
        title: activeCategory === 'notice' ? title.trim() : '',
        isImportant: activeCategory === 'notice' ? isImportant : false
      };
      if (!payload.authorUid) throw new Error("사용자 인증 정보가 없습니다. 다시 로그인해 주세요.");
      if (image) payload.image = image;
      await addDoc(collection(db, 'posts'), payload);
      setTitle(''); setContent(''); setIsImportant(false); setImage(null);
      safeAlert('게시글 등록 성공!');
    } catch (err: any) {
      safeAlert('등록 실패: ' + (err.message || '알 수 없는 오류'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id));
      setConfirmDeleteId(null);
    } catch (e) {
      safeAlert('삭제 실패');
    }
  };

  const handleStartEdit = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'posts', id), { content: editContent, updatedAt: serverTimestamp() });
      setEditingPostId(null);
    } catch (e) {
      safeAlert('수정 실패');
    }
  };

  // Comment handlers
  const toggleComments = (postId: string) => {
    setOpenComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;
    try {
      await addDoc(collection(db, 'post_comments'), {
        postId,
        parentId: null,
        content: text,
        authorUid: profile.uid,
        authorName: profile.name,
        createdAt: serverTimestamp()
      });
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      safeAlert('댓글 등록 실패: ' + err.message);
    }
  };

  const handleAddReply = async (postId: string, parentId: string) => {
    const text = (replyInputs[parentId] || '').trim();
    if (!text) return;
    try {
      await addDoc(collection(db, 'post_comments'), {
        postId,
        parentId,
        content: text,
        authorUid: profile.uid,
        authorName: profile.name,
        createdAt: serverTimestamp()
      });
      setReplyInputs(prev => ({ ...prev, [parentId]: '' }));
      setReplyingTo(null);
    } catch (err: any) {
      safeAlert('답글 등록 실패: ' + err.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'post_comments', commentId));
      setConfirmDeleteCommentId(null);
    } catch (e) {
      safeAlert('삭제 실패');
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

  if (loading) return <div className="p-10 text-center text-slate-200 font-mono tracking-widest text-[15px]">데이터 연동 중...</div>;

  const filteredPosts = posts.filter(p => p.category === activeCategory);
  if (activeCategory === 'notice') {
    filteredPosts.sort((a, b) => {
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;
      return 0;
    });
  }

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-500">
      {/* Category Tabs */}
      <div className="flex bg-[#1e293b] p-1 rounded-xl border border-slate-800 shadow-xl self-start">
        <button
          onClick={() => { setActiveCategory('notice'); setImage(null); }}
          className={`px-6 py-2 rounded-lg text-[15px] font-black transition-all uppercase tracking-widest flex items-center gap-2 ${activeCategory === 'notice' ? 'bg-[#0f172a] text-indigo-400 shadow-2xl border border-slate-700' : 'text-slate-300 hover:text-slate-300'}`}
        >
          <Megaphone size={14} /> 공지사항
        </button>
        <button
          onClick={() => { setActiveCategory('free'); setImage(null); }}
          className={`px-6 py-2 rounded-lg text-[15px] font-black transition-all uppercase tracking-widest flex items-center gap-2 ${activeCategory === 'free' ? 'bg-[#0f172a] text-emerald-400 shadow-2xl border border-slate-700' : 'text-slate-300 hover:text-slate-300'}`}
        >
          <MessageSquare size={14} /> 자유게시판
        </button>
      </div>

      {/* Post Creation */}
      {(activeCategory === 'free' || (activeCategory === 'notice' && adminRole === 'manager')) && (
        <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-2xl">
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            {activeCategory === 'notice' && (
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="제목"
                className="w-full p-2 bg-[#0f172a] border border-slate-700 rounded-lg text-[15px] text-white outline-none focus:border-indigo-500 font-bold"
                required
              />
            )}
            <div className="relative">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={activeCategory === 'notice' ? "내용을 입력하세요..." : "자유롭게 이야기를 나누세요 (링크 지원)"}
                rows={3}
                className="w-full p-2 bg-[#0f172a] border border-slate-700 rounded-lg text-[15px] text-white outline-none focus:border-indigo-500 font-medium leading-relaxed resize-none"
                required
              />
              <div className="absolute bottom-2 right-2">
                <input type="file" id="post-image" className="hidden" accept="image/*" onChange={handleFileChange} />
                <label htmlFor="post-image" className="cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <ImageIcon size={16} />
                </label>
              </div>
            </div>
            {image && (
              <div className="relative w-24 h-24 rounded-lg border border-slate-700 overflow-hidden group">
                <img src={image} className="w-full h-full object-cover" alt="preview" />
                <button type="button" onClick={() => setImage(null)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={10} />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              {activeCategory === 'notice' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="rounded border-slate-700 bg-[#0f172a] text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5" />
                  <span className="text-[13px] text-slate-200 font-bold uppercase tracking-wide">중요 고정</span>
                </label>
              ) : <div></div>}
              <button
                type="submit"
                disabled={isResizing}
                className={`${activeCategory === 'notice' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white text-[13px] font-black px-6 py-1.5 rounded-lg transition-all uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50`}
              >
                {isResizing ? '최적화 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts Feed */}
      <div className="flex flex-col gap-2">
        {filteredPosts.map(post => {
          const postComments = comments.filter(c => c.postId === post.id && !c.parentId);
          const totalCount = comments.filter(c => c.postId === post.id).length;
          const isOpen = openComments.has(post.id);

          return (
            <div key={post.id} className={`bg-[#1e293b] rounded-xl border ${post.isImportant ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-slate-800'} shadow-lg relative group transition-all hover:border-slate-700 overflow-hidden`}>
              {post.isImportant && (
                <div className="absolute top-3 right-3 text-indigo-400">
                  <Pin size={12} fill="currentColor" />
                </div>
              )}

              <div className="px-4 pt-3 pb-2">
                {/* 작성자 + 제목 + 수정/삭제 버튼 */}
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-indigo-900/30 flex items-center justify-center text-[11px] font-black text-indigo-400 shrink-0">
                        {post.authorName.slice(0, 1)}
                      </div>
                      <span className="text-[13px] font-bold text-slate-300">{post.authorName}</span>
                    </div>
                    {post.title && (
                      <h4 className="text-[17px] font-black text-white tracking-tight leading-snug">{post.title}</h4>
                    )}
                  </div>
                  {(adminRole === 'manager' || post.authorUid === profile.uid) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => handleStartEdit(post)} className="text-slate-300 hover:text-amber-500 transition-colors p-1">
                        <Pencil size={12} />
                      </button>
                      {confirmDeleteId === post.id ? (
                        <button onClick={() => handleDelete(post.id)} className="text-[12px] font-black text-rose-500 hover:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded transition-colors">
                          삭제확정
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(post.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 본문 */}
                {editingPostId === post.id ? (
                  <div className="flex flex-col gap-2 mb-2">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full p-2 bg-[#0f172a] border border-slate-700 rounded-lg text-[15px] text-white outline-none focus:border-indigo-500 font-medium resize-none"
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingPostId(null)} className="p-1.5 text-slate-200 hover:bg-slate-800 rounded"><X size={14} /></button>
                      <button onClick={() => handleSaveEdit(post.id)} className="p-1.5 text-white bg-indigo-600 rounded hover:bg-indigo-500"><Check size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[15px] text-slate-300 whitespace-pre-wrap leading-snug mb-2 font-medium">
                    {renderText(post.content)}
                  </div>
                )}

                {post.image && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-slate-800 shadow-xl max-w-sm">
                    <img
                      src={post.image}
                      alt="post content"
                      className="w-full h-auto cursor-zoom-in brightness-90 hover:brightness-100 transition-all"
                      onClick={() => window.open(post.image, '_blank')}
                    />
                  </div>
                )}

                {/* 하단: 일시 + 댓글 버튼 한 줄 */}
                <div className="flex items-center justify-between border-t border-slate-800/30 pt-1.5">
                  <span className="text-[12px] text-slate-300 font-mono">
                    {post.createdAt?.toDate ? format(post.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '동기화 중...'}
                  </span>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all text-[12px]"
                  >
                    <MessageSquare size={11} />
                    <span>{totalCount > 0 ? totalCount : ''} 댓글</span>
                    {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                </div>
              </div>

              {/* Comments Section */}
              {isOpen && (
                <div className="border-t border-slate-800 bg-[#0f172a]/50">
                  {/* Existing comments */}
                  {postComments.length > 0 && (
                    <div className="px-4 py-3 flex flex-col gap-3">
                      {postComments.map(comment => {
                        const replies = comments.filter(c => c.parentId === comment.id);
                        return (
                          <div key={comment.id}>
                            {/* Comment */}
                            <div className="flex gap-2 group/comment">
                              <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[12px] font-black text-slate-300 shrink-0 mt-0.5">
                                {comment.authorName.slice(0, 1)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[13px] font-bold text-slate-200">{comment.authorName}</span>
                                  <span className="text-[12px] text-slate-300 font-mono">
                                    {comment.createdAt?.toDate ? format(comment.createdAt.toDate(), 'MM.dd HH:mm') : ''}
                                  </span>
                                </div>
                                <p className="text-[14px] text-slate-300 leading-relaxed">{comment.content}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <button
                                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                    className="text-[12px] text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-1"
                                  >
                                    <CornerDownRight size={11} /> 답글
                                  </button>
                                  {(adminRole === 'manager' || comment.authorUid === profile.uid) && (
                                    confirmDeleteCommentId === comment.id ? (
                                      <button onClick={() => handleDeleteComment(comment.id)} className="text-[12px] text-rose-500 font-bold">삭제확정</button>
                                    ) : (
                                      <button onClick={() => setConfirmDeleteCommentId(comment.id)} className="text-[12px] text-slate-300 hover:text-rose-500 opacity-0 group-hover/comment:opacity-100 transition-all">
                                        <Trash2 size={11} />
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Replies */}
                            {replies.length > 0 && (
                              <div className="ml-8 mt-2 flex flex-col gap-2 border-l-2 border-slate-800 pl-3">
                                {replies.map(reply => (
                                  <div key={reply.id} className="flex gap-2 group/reply">
                                    <div className="w-5 h-5 rounded bg-indigo-900/30 flex items-center justify-center text-[11px] font-black text-indigo-400 shrink-0 mt-0.5">
                                      {reply.authorName.slice(0, 1)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[13px] font-bold text-slate-200">{reply.authorName}</span>
                                        <span className="text-[12px] text-slate-300 font-mono">
                                          {reply.createdAt?.toDate ? format(reply.createdAt.toDate(), 'MM.dd HH:mm') : ''}
                                        </span>
                                      </div>
                                      <p className="text-[14px] text-slate-300 leading-relaxed">{reply.content}</p>
                                      {(adminRole === 'manager' || reply.authorUid === profile.uid) && (
                                        <div className="mt-0.5">
                                          {confirmDeleteCommentId === reply.id ? (
                                            <button onClick={() => handleDeleteComment(reply.id)} className="text-[12px] text-rose-500 font-bold">삭제확정</button>
                                          ) : (
                                            <button onClick={() => setConfirmDeleteCommentId(reply.id)} className="text-[12px] text-slate-300 hover:text-rose-500 opacity-0 group-hover/reply:opacity-100 transition-all">
                                              <Trash2 size={11} />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply input */}
                            {replyingTo === comment.id && (
                              <div className="ml-8 mt-2 flex gap-2">
                                <input
                                  autoFocus
                                  type="text"
                                  value={replyInputs[comment.id] || ''}
                                  onChange={e => setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') handleAddReply(post.id, comment.id); if (e.key === 'Escape') setReplyingTo(null); }}
                                  placeholder="답글 입력..."
                                  className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-[14px] text-white outline-none focus:border-indigo-500"
                                />
                                <button onClick={() => handleAddReply(post.id, comment.id)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                                  <Send size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* New comment input */}
                  <div className="px-4 pb-3 flex gap-2">
                    <input
                      type="text"
                      value={commentInputs[post.id] || ''}
                      onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post.id); }}
                      placeholder="댓글을 입력하세요..."
                      className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-indigo-500"
                    />
                    <button onClick={() => handleAddComment(post.id)} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shrink-0">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredPosts.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center bg-[#1e293b] rounded-2xl border border-dashed border-slate-800">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mb-6 transition-transform">
              <Megaphone size={32} />
            </div>
            <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">게시글이 비어있습니다</h3>
            <p className="text-[15px] text-slate-300 font-mono tracking-widest uppercase mb-8">No transmissions detected in this frequency</p>
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
