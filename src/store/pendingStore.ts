import { create } from "zustand";
import { firestoreAdapter } from "@/storage/firestoreAdapter";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Teacher } from "@/types";
import type { UserProfile } from "@/types/auth";
import { uid, formatISODate } from "@/utils/scheduleHelpers";

export interface PendingTeacher extends Teacher {
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  submittedBy: string;   // user UID
  reviewedAt?: string;
  reviewNote?: string;
}

interface PendingState {
  pending: PendingTeacher[];

  loadAll: () => Promise<void>;
  submit: (teacher: Omit<Teacher, "id" | "active">, userUid: string) => Promise<void>;
  approve: (id: string, profile: UserProfile) => Promise<void>;
  reject: (id: string, note?: string) => Promise<void>;
  getByUser: (uid: string) => PendingTeacher | undefined;
}

export const usePendingStore = create<PendingState>((set, get) => ({
  pending: [],

  async loadAll() {
    const pending = await firestoreAdapter.getCollection<PendingTeacher>("pendingTeachers");
    set({ pending });
  },

  async submit(teacherData, userUid) {
    // Check if user already has a pending submission — update it
    const existing = get().pending.find((p) => p.submittedBy === userUid);
    const id = existing?.id ?? uid();

    const pending: PendingTeacher = {
      ...teacherData,
      id,
      active: false,
      status: "pending",
      submittedAt: formatISODate(),
      submittedBy: userUid,
    };

    await firestoreAdapter.setDoc("pendingTeachers", pending);

    // Link teacherId to user profile
    await setDoc(doc(db, "users", userUid), { teacherId: id }, { merge: true });

    set((s) => ({
      pending: existing
        ? s.pending.map((p) => (p.id === id ? pending : p))
        : [...s.pending, pending],
    }));
  },

  async approve(id, approverProfile) {
    const item = get().pending.find((p) => p.id === id);
    if (!item) return;

    // Move to teachers collection as active
    const teacher: Teacher = {
      id: item.id,
      name: item.name,
      subjects: item.subjects,
      schedule: item.schedule,
      active: true,
    };
    await firestoreAdapter.setDoc("teachers", teacher);

    // Update pending status
    const updated: PendingTeacher = {
      ...item,
      status: "approved",
      reviewedAt: formatISODate(),
    };
    await firestoreAdapter.setDoc("pendingTeachers", updated);

    // Update user role to professor
    await setDoc(
      doc(db, "users", item.submittedBy),
      { role: "professor", teacherId: id },
      { merge: true }
    );

    set((s) => ({
      pending: s.pending.map((p) => (p.id === id ? updated : p)),
    }));
  },

  async reject(id, note) {
    const item = get().pending.find((p) => p.id === id);
    if (!item) return;

    const updated: PendingTeacher = {
      ...item,
      status: "rejected",
      reviewedAt: formatISODate(),
      reviewNote: note,
    };
    await firestoreAdapter.setDoc("pendingTeachers", updated);
    set((s) => ({
      pending: s.pending.map((p) => (p.id === id ? updated : p)),
    }));
  },

  getByUser(uid) {
    return get().pending.find((p) => p.submittedBy === uid);
  },
}));
