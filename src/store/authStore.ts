import { create } from "zustand";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import { formatISODate } from "@/utils/scheduleHelpers";
import type { UserProfile, UserRole } from "@/types/auth";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;

  login: () => Promise<void>;
  logout: () => Promise<void>;
  init: () => () => void;  // returns unsubscribe
  isAdmin: () => boolean;
  updateRole: (uid: string, role: UserRole) => Promise<void>;
}

async function getOrCreateProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  // Check if this is the very first user — make them admin
  const allUsers = await getDocs(collection(db, "users"));
  const role: UserRole = allUsers.empty ? "admin" : "pending";

  const profile: UserProfile = {
    id: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "Sem nome",
    photoURL: user.photoURL ?? undefined,
    role,
    createdAt: formatISODate(),
  };

  await setDoc(ref, profile);
  return profile;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  async login() {
    await signInWithPopup(auth, googleProvider);
  },

  async logout() {
    await signOut(auth);
    set({ user: null, profile: null });
  },

  init() {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await getOrCreateProfile(user);
        set({ user, profile, loading: false });
      } else {
        set({ user: null, profile: null, loading: false });
      }
    });
    return unsub;
  },

  isAdmin() {
    return get().profile?.role === "admin";
  },

  async updateRole(uid, role) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { role }, { merge: true });
    // If updating own profile
    if (get().user?.uid === uid) {
      set((s) => ({
        profile: s.profile ? { ...s.profile, role } : null,
      }));
    }
  },
}));
