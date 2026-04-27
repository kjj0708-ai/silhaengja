import { useState, useEffect } from 'react';

const STORAGE_KEY = 'meetingNotification';

export function useMeetingNotifications() {
  const [notifEnabled, setNotifEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  });
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if ('Notification' in window) return Notification.permission;
    return 'denied';
  });

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);
    // If permission was revoked externally, sync state
    if (Notification.permission !== 'granted' && notifEnabled) {
      setNotifEnabled(false);
      localStorage.setItem(STORAGE_KEY, 'off');
    }
  }, []);

  const toggle = async () => {
    if (!('Notification' in window)) {
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }

    if (notifEnabled) {
      localStorage.setItem(STORAGE_KEY, 'off');
      setNotifEnabled(false);
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
      setNotifEnabled(true);
      new Notification('실행자들 알림 설정 완료', {
        body: '새로운 런치클럽 모임이 등록되면 알려드릴게요!',
        icon: '/logo.png',
      });
    }
  };

  const notify = (title: string, body: string) => {
    if (!notifEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'meeting-new',
    });
  };

  return { notifEnabled, permission, toggle, notify };
}
