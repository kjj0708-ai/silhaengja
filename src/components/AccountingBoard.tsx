import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  title: string;
  date: string;
  createdAt: any;
}

export default function AccountingBoard({ adminRole }: { adminRole: 'manager' | 'treasurer' | null }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const safeAlert = (msg: string) => {
    try { window.alert(msg); } catch (e) { console.log(msg); }
  };

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Transaction[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Transaction));
      setTransactions(list);
      setLoading(false);
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    try {
      const id = `tx_${Date.now()}`;
      await setDoc(doc(db, 'transactions', id), {
        title: title.trim(),
        amount: Number(amount),
        type,
        date,
        createdAt: serverTimestamp()
      });
      setTitle('');
      setAmount('');
      safeAlert('등록 성공!');
    } catch (e) {
      console.error(e);
      safeAlert('등록 실패');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setConfirmDeleteId(null);
      safeAlert('삭제 성공');
    } catch (err) {
      console.error(err);
      safeAlert('삭제 실패');
    }
  };

  const totals = transactions.reduce((acc, curr) => {
    if (curr.type === 'income') acc.income += curr.amount;
    else acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 });

  if (loading) return <div className="p-10 text-center text-slate-200">불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10">
             <Wallet size={40} className="text-slate-200" />
          </div>
          <span className="text-[13px] text-slate-300 font-bold uppercase tracking-widest">현재 잔고</span>
          <div className="text-2xl font-black text-white mt-1 font-mono tracking-tighter">{(totals.income - totals.expense).toLocaleString()} <span className="text-xs text-slate-300 italic">KRW</span></div>
        </div>
        <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-xl border-l-4 border-l-emerald-500">
          <span className="text-[13px] text-slate-300 font-bold uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12} className="text-emerald-500" /> 누적 수익</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono tracking-tighter">{totals.income.toLocaleString()} <span className="text-xs text-emerald-900/50">KRW</span></div>
        </div>
        <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-xl border-l-4 border-l-rose-500">
          <span className="text-[13px] text-slate-300 font-bold uppercase tracking-widest flex items-center gap-1.5"><TrendingDown size={12} className="text-rose-500" /> 누적 지출</span>
          <div className="text-2xl font-black text-rose-400 mt-1 font-mono tracking-tighter">{totals.expense.toLocaleString()} <span className="text-xs text-rose-900/50">KRW</span></div>
        </div>
      </div>

      {adminRole === 'treasurer' || adminRole === 'manager' ? (
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl">
          <h3 className="text-[15px] font-bold mb-5 flex items-center gap-2 text-slate-200 uppercase tracking-widest">
            <Plus size={14} className="text-indigo-500" /> 거래 내역 등록
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
             <div className="sm:col-span-1">
              <label className="block text-[13px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">일자</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 bg-[#0f172a] border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500 font-mono" required />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[13px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">유형</label>
              <select value={type} onChange={e => setType(e.target.value as 'income' | 'expense')} className="w-full p-2 bg-[#0f172a] border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500 font-bold uppercase tracking-widest">
                <option value="income">입금</option>
                <option value="expense">출금</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[13px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">금액</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 bg-[#0f172a] border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500 font-mono" placeholder="숫자만 입력" required />
            </div>
            <div className="flex-1">
               <label className="block text-[13px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">항목명</label>
               <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 bg-[#0f172a] border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500" placeholder="예: 월회비 입금" required />
            </div>
            <div className="sm:col-span-4 flex justify-end">
               <button type="submit" className="bg-indigo-600 text-white text-[15px] font-bold px-8 py-2.5 rounded-lg hover:bg-indigo-500 uppercase tracking-widest">기록 확정</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="bg-[#1e293b] rounded-xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-800/30 border-b border-slate-800">
           <span className="text-[13px] font-bold uppercase tracking-widest text-slate-300">회계 입출금 원장</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[16px] font-medium tracking-tight border-collapse">
            <thead className="bg-[#0f172a]/50 text-[13px] font-bold uppercase tracking-widest text-slate-300">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-center whitespace-nowrap w-4 sm:w-auto">날짜</th>
                <th className="px-3 sm:px-6 py-3">항목명</th>
                <th className="px-2 sm:px-6 py-3 w-4 sm:w-auto text-center">구분</th>
                <th className="px-3 sm:px-6 py-4 text-right font-bold font-mono">금액</th>
                {adminRole && <th className="px-3 sm:px-6 py-3 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-indigo-900/10 transition-colors">
                  <td className="px-3 sm:px-6 py-4 text-slate-300 font-mono text-center">
                    <span className="sm:hidden">{tx.date.substring(5).replace('-', '.')}</span>
                    <span className="hidden sm:inline">{tx.date}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-slate-200 min-w-[80px] sm:min-w-0">
                    <div className="sm:line-clamp-none line-clamp-1 break-all">{tx.title}</div>
                  </td>
                  <td className="px-2 sm:px-6 py-4 text-center">
                    <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded text-[12px] sm:text-[17px] font-bold uppercase tracking-tighter whitespace-nowrap ${tx.type === 'income' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-rose-900/30 text-rose-400 border border-rose-500/30'}`}>
                      {tx.type === 'income' ? '입금' : '출금'}
                    </span>
                  </td>
                  <td className={`px-3 sm:px-6 py-4 text-right font-bold font-mono whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} <span className="text-[17px] opacity-50 hidden sm:inline text-slate-300 ml-1">KRW</span>
                  </td>
                  {adminRole && (
                    <td className="px-3 sm:px-6 py-4">
                      {confirmDeleteId === tx.id ? (
                        <button onClick={() => handleDelete(tx.id)} className="text-[13px] font-black text-rose-500 hover:text-rose-400 bg-rose-500/10 px-2 py-1 rounded transition-colors whitespace-nowrap">
                          정말 삭제?
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(tx.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={adminRole ? 5 : 4} className="px-6 py-12 text-center text-slate-300 font-mono text-[13px] uppercase tracking-widest">원장에 기록된 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
