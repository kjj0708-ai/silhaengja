import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const STORAGE_KEY = 'adminNotification';

export function useAdminNotifications(adminRole: 'manager' | 'treasurer' | null) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === 'on');
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if ('Notification' in window) return Notification.permission;
    return 'denied';
  });

  // Use ref so notify() inside effects always sees the latest enabled state
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const notify = useCallback((title: string, body: string, tag: string) => {
    if (!enabledRef.current) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: '/logo.png', badge: '/logo.png', tag });
  }, []);

  const toggle = async () => {
    if (!('Notification' in window)) {
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, 'off');
      setEnabled(false);
      return;
    }
    if (Notification.permission === 'denied') {
      alert('브라우저 설정에서 알림 차단을 해제한 후 다시 시도해주세요.');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      localStorage.setItem(STORAGE_KEY, 'on');
      setEnabled(true);
      new Notification('관리자 알림 활성화', {
        body: '게시글 등록 및 모임 신청 알림이 켜졌습니다.',
        icon: '/logo.png',
      });
    }
  };

  // ── 게시글 알림 ──────────────────────────────────────────
  const knownPostIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!adminRole) return;
    knownPostIds.current = null; // reset on re-mount

    const unsub = onSnapshot(collection(db, 'posts'), (snap) => {
      const ids = new Set(snap.docs.map(d => d.id));
      if (knownPostIds.current === null) {
        knownPostIds.current = ids;
        return;
      }
      snap.docs.forEach(d => {
        if (!knownPostIds.current!.has(d.id)) {
          const data = d.data();
          const preview = data.title
            ? data.title
            : (data.content || '').slice(0, 40);
          notify(
            `📢 새 게시글 — ${data.authorName || ''}`,
            preview,
            `post-${d.id}`
          );
        }
      });
      knownPostIds.current = ids;
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error('Admin post listener error:', err);
    });

    return () => unsub();
  }, [adminRole, notify]);

  // ── 모임 신청 알림 ───────────────────────────────────────
  const knownRegIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!adminRole) return;
    knownRegIds.current = null;

    const unsub = onSnapshot(collection(db, 'meeting_registrations'), (snap) => {
      const ids = new Set(snap.docs.map(d => d.id));
      if (knownRegIds.current === null) {
        knownRegIds.current = ids;
        return;
      }
      snap.docs.forEach(d => {
        if (!knownRegIds.current!.has(d.id)) {
          const data = d.data();
          notify(
            `🍽️ 모임 신청 — ${data.userName || ''}`,
            '모임 참여 신청이 접수되었습니다.',
            `reg-${d.id}`
          );
        }
      });
      knownRegIds.current = ids;
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error('Admin reg listener error:', err);
    });

    return () => unsub();
  }, [adminRole, notify]);

  return { enabled, permission, toggle };
}
