import * as functions from 'firebase-functions/v1';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

initializeApp();

// 커스텀 Firestore 데이터베이스 ID
const DB_ID = 'ai-studio-77216921-7d28-4c63-aaef-162b0f493f51';
const db = getFirestore(DB_ID);
const messaging = getMessaging();

// 배포 리전 (한국에서 가장 가까운 도쿄)
const REGION = 'asia-northeast1';

// ── 유틸: FCM 전송 (500개 단위 청크) ──────────────────────────────────
async function sendPush(tokens: string[], title: string, body: string): Promise<void> {
  const valid = tokens.filter(Boolean);
  if (!valid.length) return;

  const base: Omit<MulticastMessage, 'tokens'> = {
    notification: { title, body },
    webpush: {
      notification: {
        icon:  '/logo.png',
        badge: '/logo.png',
        requireInteraction: false,
      },
      fcmOptions: { link: 'https://shj.choshg.com' },
    },
  };

  const staleTokens: string[] = [];

  for (let i = 0; i < valid.length; i += 500) {
    const chunk = valid.slice(i, i + 500);
    try {
      const result = await messaging.sendEachForMulticast({ ...base, tokens: chunk });
      result.responses.forEach((res, idx) => {
        const code = res.error?.code ?? '';
        if (!res.success && (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        )) {
          staleTokens.push(chunk[idx]);
        }
      });
    } catch (err) {
      console.error('FCM sendEachForMulticast error:', err);
    }
  }

  // 무효 토큰 제거
  if (staleTokens.length > 0) {
    const snap = await db.collection('users').get();
    const batch = db.batch();
    snap.docs.forEach(d => {
      if (staleTokens.includes(d.data().fcmToken)) {
        batch.update(d.ref, { fcmToken: null });
      }
    });
    await batch.commit();
  }
}

// ── 유틸: 역할별 FCM 토큰 조회 ───────────────────────────────────────
async function getTokensByRole(...roles: string[]): Promise<string[]> {
  const tokens: string[] = [];
  for (const role of roles) {
    const snap = await db.collection('users').where('role', '==', role).get();
    snap.docs.forEach(d => {
      const t = d.data().fcmToken as string | undefined;
      if (t) tokens.push(t);
    });
  }
  return [...new Set(tokens)];
}

// ── 유틸: 전체 회원 FCM 토큰 조회 ───────────────────────────────────
async function getAllTokens(): Promise<string[]> {
  const snap = await db.collection('users').get();
  return snap.docs
    .map(d => d.data().fcmToken as string | undefined)
    .filter((t): t is string => Boolean(t));
}

// ─────────────────────────────────────────────────────────────────────
// 1) 새 게시글 → 관리자·총무 알림
// ─────────────────────────────────────────────────────────────────────
export const notifyAdminOnPost = functions
  .region(REGION)
  .firestore.document('posts/{postId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return;

    const tokens = await getTokensByRole('manager', 'treasurer');
    const title  = `📢 새 게시글 — ${data.authorName ?? ''}`;
    const body   = (data.title as string) || (data.content as string ?? '').slice(0, 60);
    await sendPush(tokens, title, body);
  });

// ─────────────────────────────────────────────────────────────────────
// 2) 모임 신청 → 관리자·총무 알림
// ─────────────────────────────────────────────────────────────────────
export const notifyAdminOnRegistration = functions
  .region(REGION)
  .firestore.document('meeting_registrations/{regId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return;

    const tokens = await getTokensByRole('manager', 'treasurer');
    await sendPush(
      tokens,
      `🍽️ 모임 신청 — ${data.userName ?? ''}`,
      '새 모임 참여 신청이 접수되었습니다.'
    );
  });

// ─────────────────────────────────────────────────────────────────────
// 3) 새 모임 등록 → 전체 회원 알림
// ─────────────────────────────────────────────────────────────────────
export const notifyAllOnMeeting = functions
  .region(REGION)
  .firestore.document('meetings/{meetingId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return;

    const tokens = await getAllTokens();
    await sendPush(
      tokens,
      `🗓️ 새 모임 공지 — ${data.title ?? ''}`,
      `일시: ${data.date ?? ''}`
    );
  });
