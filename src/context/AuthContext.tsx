"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { auth, onAuthStateChanged, type User, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

interface UserProfile {
  rep: number;
  streak: number;
  lastActiveDate: string;
  badges: string[];
  joinedSubjects: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
}

const defaultProfile: UserProfile = {
  rep: 0,
  streak: 0,
  lastActiveDate: "",
  badges: [],
  joinedSubjects: [],
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profile: null,
  refreshProfile: async () => {},
});

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function computeBadges(profile: UserProfile, aiCount: number): string[] {
  const badges: string[] = [...(profile.badges ?? [])];
  if (aiCount >= 1 && !badges.includes("first_question")) badges.push("first_question");
  if ((profile.streak ?? 0) >= 10 && !badges.includes("streak_10")) badges.push("streak_10");
  if ((profile.rep ?? 0) >= 500 && !badges.includes("top_contributor")) badges.push("top_contributor");
  return badges;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  async function refreshProfile(uid?: string) {
    const id = uid ?? user?.uid;
    if (!id) return;
    const snap = await getDoc(doc(db, "users", id));
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
    }
  }

  async function initUserProfile(u: User) {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    const today = getTodayString();
    const yesterday = getYesterdayString();

    if (!snap.exists()) {
      // Brand new user
      const newProfile: UserProfile = {
        rep: 5,
        streak: 1,
        lastActiveDate: today,
        badges: [],
        joinedSubjects: [],
      };
      await setDoc(ref, {
        ...newProfile,
        displayName: u.displayName ?? "",
        email: u.email ?? "",
        photoURL: u.photoURL ?? "",
        createdAt: serverTimestamp(),
      });
      setProfile(newProfile);
    } else {
      const data = snap.data() as UserProfile;
      const updates: Record<string, any> = {};

      // Streak logic
      if (data.lastActiveDate === today) {
        // Already logged today, no change
      } else if (data.lastActiveDate === yesterday) {
        // Consecutive day
        updates.streak = (data.streak ?? 0) + 1;
        updates.rep = increment(5);
        updates.lastActiveDate = today;
      } else {
        // Streak broken
        updates.streak = 1;
        updates.lastActiveDate = today;
        updates.rep = increment(2);
      }

      // Badge checks
      const merged = { ...data, ...updates };
      const aiSnap = await getDoc(doc(db, "users", u.uid));
      const aiCount = aiSnap.data()?.aiQuestionCount ?? 0;
      const newBadges = computeBadges(merged as UserProfile, aiCount);
      if (newBadges.length !== (data.badges ?? []).length) {
        updates.badges = newBadges;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(ref, updates);
      }

      const updatedSnap = await getDoc(ref);
      setProfile(updatedSnap.data() as UserProfile);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await initUserProfile(u);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, profile, refreshProfile: () => refreshProfile() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
