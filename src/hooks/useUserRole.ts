import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  name: string;
  tier: string;
  affiliation?: string;
  role?: 'manager' | 'treasurer' | null;
  totalPoints: number;
  createdAt: any;
  lastMissionId?: string;
}

export function useUserRole(user: FirebaseUser | null) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [adminRole, setAdminRole] = useState<'manager' | 'treasurer' | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setAdminRole(null);
      return;
    }

    let isMounted = true;

    const unUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!isMounted) return;
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        // Always ensure uid is set (some legacy profiles may not have it stored)
        const profileWithUid = { ...data, uid: data.uid || user.uid };
        setProfile(prev => {
          if (JSON.stringify(prev) === JSON.stringify(profileWithUid)) return prev;
          return profileWithUid;
        });
        const profileRole = data.role || null;
        setAdminRole(prev => {
          // Managers detected from 'admins' collection or bootstrap should not be downgraded
          if (prev === 'manager') return 'manager';
          return profileRole;
        });
      } else {
        setProfile(null);
      }
    }, (err: any) => {
      if (err.code === 'permission-denied') return;
      console.error("Profile listen error:", err);
      if (isMounted) setProfile(null);
    });

    const fetchAdmin = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (!isMounted) return;

        if (adminDoc.exists()) {
          setAdminRole(adminDoc.data().role as 'manager' | 'treasurer');
        } else if (user.email === 'kjj0708@gmail.com') {
          try {
            await setDoc(doc(db, 'admins', user.uid), { role: 'manager', createdAt: serverTimestamp() });
            // Also update user profile for visibility in ranking
            await updateDoc(doc(db, 'users', user.uid), { role: 'manager' });
            if (isMounted) setAdminRole('manager');
          } catch(e) {
            if (isMounted) setAdminRole('manager');
          }
        }
      } catch (e) {
        console.error("Fetch admin error:", e);
      }
    };

    fetchAdmin();

    return () => {
      isMounted = false;
      unUser();
    };
  }, [user?.uid]); // Bind to uid for stability

  const createProfile = async (name: string, affiliation: string) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      name: name,
      affiliation: affiliation,
      tier: 'C-BRONZE',
      totalPoints: 0,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile({ ...newProfile, createdAt: Date.now() });
  };

  const updateProfileInfo = async (newName: string, newAffiliation: string) => {
    if (!user || !profile) return;
    await updateDoc(doc(db, 'users', user.uid), {
      name: newName,
      affiliation: newAffiliation
    });
  };

  return { profile, adminRole, createProfile, updateProfileInfo, loadingProfile: profile === undefined };
}
