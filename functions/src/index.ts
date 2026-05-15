import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

initializeApp();

// 커스텀 Firestore 데이터베이스 ID (반드시 v2 트리거에 명시해야 함)
const DB_ID = 'ai-studio-77216921-7d28-4c63-aaef-162b0f493f51';
const db = getFirestore(DB_ID);
const messaging = getMessaging();

// 배포 리전
const REGION = 'asia-northeast1';

// 부트스트랩 관리자 이메일
const BOOTSTRAP_ADMIN_EMAIL = 'kjj0708@gmail.com';

// ── FCM 전송 (500개 단위 청크) ────────────────────────────────────────
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

  // 무효 토큰 정리
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

// ── 관리자 FCM 토큰 조회 (다층 탐색) ────────────────────────────────
async function getAdminTokens(): Promise<string[]> {
  const tokens: string[] = [];

  // 1. users 컬렉션에서 role 필드 기준 조회
  const snap = await db.collection('users')
    .where('role', 'in', ['manager', 'treasurer'])
    .get();
  snap.docs.forEach(d => {
    const t = d.data().fcmToken as string | undefined;
    if (t) tokens.push(t);
  });

  // 2. admins 컬렉션 기반 조회 (users 문서에 role 없는 경우 보완)
  const adminsSnap = await db.collection('admins').get();
  await Promise.all(adminsSnap.docs.map(async (adminDoc) => {
    const userDoc = await db.collection('users').doc(adminDoc.id).get();
    const t = userDoc.data()?.fcmToken as string | undefined;
    if (t && !tokens.includes(t)) tokens.push(t);
  }));

  // 3. 부트스트랩 관리자 (이메일 기반, 위 두 방법으로 못 찾은 경우 보완)
  try {
    const authUser = await getAuth().getUserByEmail(BOOTSTRAP_ADMIN_EMAIL);
    const userDoc = await db.collection('users').doc(authUser.uid).get();
    const t = userDoc.data()?.fcmToken as string | undefined;
    if (t && !tokens.includes(t)) tokens.push(t);
  } catch (_) {
    // 이메일 조회 실패 시 무시
  }

  return [...new Set(tokens)];
}

// ── 전체 회원 FCM 토큰 조회 ──────────────────────────────────────────
async function getAllTokens(): Promise<string[]> {
  const snap = await db.collection('users').get();
  return snap.docs
    .map(d => d.data().fcmToken as string | undefined)
    .filter((t): t is string => Boolean(t));
}

// ─────────────────────────────────────────────────────────────────────
// 1) 새 게시글 → 관리자·총무 알림
// ─────────────────────────────────────────────────────────────────────
export const notifyAdminOnPost = onDocumentCreated(
  { document: 'posts/{postId}', database: DB_ID, region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const tokens = await getAdminTokens();
    const title = `📢 새 게시글 — ${data.authorName ?? ''}`;
    const body  = (data.content as string ?? '').slice(0, 80);
    await sendPush(tokens, title, body);
  }
);

// ─────────────────────────────────────────────────────────────────────
// 2) 모임 신청 → 관리자·총무 알림
// ─────────────────────────────────────────────────────────────────────
export const notifyAdminOnRegistration = onDocumentCreated(
  { document: 'meeting_registrations/{regId}', database: DB_ID, region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const tokens = await getAdminTokens();
    await sendPush(
      tokens,
      `🍽️ 모임 신청 — ${data.userName ?? ''}`,
      '새 모임 참여 신청이 접수되었습니다.'
    );
  }
);

// ─────────────────────────────────────────────────────────────────────
// 3) 새 모임 등록 → 전체 회원 알림
// ─────────────────────────────────────────────────────────────────────
export const notifyAllOnMeeting = onDocumentCreated(
  { document: 'meetings/{meetingId}', database: DB_ID, region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const tokens = await getAllTokens();
    await sendPush(
      tokens,
      `🗓️ 새 모임 공지 — ${data.title ?? ''}`,
      `일시: ${data.date ?? ''}`
    );
  }
);
