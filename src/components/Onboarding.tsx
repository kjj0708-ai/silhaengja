import React, { useState } from 'react';

export default function Onboarding({
  userEmail,
  onSubmit
}: {
  userEmail: string | null;
  onSubmit: (name: string, affiliation: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !affiliation.trim()) return;
    setLoading(true);
    try {
      await onSubmit(name.trim(), affiliation.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0f172a] p-4 font-sans text-slate-200">
      <div className="bg-[#1e293b] p-8 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-sm relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
        <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter italic">아이덴티티 설정</h2>
        <p className="text-slate-300 mb-8 text-[15px] font-medium leading-relaxed">
          새로운 실행자의 초기 레코드가 감지되었습니다.<br/>
          활동에 사용할 실명과 소속을 입력하여 프로세스를 완료해 주세요.
        </p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-bold text-slate-200 mb-1 uppercase tracking-widest">
              사용자 성명 (실명)
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-2.5 px-3 text-[17px] text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700"
              placeholder="예: 홍길동"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-bold text-slate-200 mb-1 uppercase tracking-widest">
              소속 (과, 팀명)
            </label>
            <input 
              type="text" 
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg py-2.5 px-3 text-[17px] text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700"
              placeholder="예: 개발 1팀"
              required
            />
          </div>

          <div className="space-y-1.5">
             <label className="block text-[13px] font-bold text-slate-200 mb-1 uppercase tracking-widest">
              연동 계정 정보
            </label>
            <input 
              type="text" 
              value={userEmail || ''}
              disabled
              className="w-full bg-[#0f172a] border border-slate-800/50 text-slate-300 rounded-lg py-2.5 px-3 text-[17px] outline-none font-mono"
            />
          </div>
          <button 
            type="submit"
            disabled={loading || !name.trim() || !affiliation.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all mt-2 disabled:bg-slate-800 uppercase tracking-widest text-[16px] shadow-xl active:scale-95"
          >
            {loading ? '동기화 중...' : '등록하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
