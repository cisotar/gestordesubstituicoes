import { create } from "zustand";
import { firestoreAdapter } from "@/storage/firestoreAdapter";
import { SEED_PERIODS, SEED_TEACHERS } from "@/data/seed";
import type { Teacher, Period } from "@/types";

interface TeachersState {
  teachers: Teacher[];
  periods: Period[];
  loaded: boolean;

  loadAll: () => Promise<void>;

  addTeacher: (t: Teacher) => Promise<void>;
  updateTeacher: (t: Teacher) => Promise<void>;
  removeTeacher: (id: string) => Promise<void>;
  toggleTeacherActive: (id: string) => Promise<void>;

  addPeriod: (p: Period) => Promise<void>;
  updatePeriod: (p: Period) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
  seedPeriods: () => Promise<void>;
  resetToSeed: () => Promise<void>;
}

export const useTeachersStore = create<TeachersState>((set, get) => ({
  teachers: [],
  periods: [],
  loaded: false,

  async loadAll() {
    const [teachers, periods] = await Promise.all([
      firestoreAdapter.getCollection<Teacher>("teachers"),
      firestoreAdapter.getCollection<Period>("periods"),
    ]);
    const sortedPeriods = periods.sort((a, b) => a.order - b.order);
    if (sortedPeriods.length === 0) {
      await get().seedPeriods();
    } else {
      set({ teachers, periods: sortedPeriods, loaded: true });
    }
  },

  async seedPeriods() {
    await Promise.all(SEED_PERIODS.map((p) => firestoreAdapter.setDoc("periods", p)));
    set({ periods: SEED_PERIODS, loaded: true });
  },

  async resetToSeed() {
    // Clear existing teachers and periods from Firestore
    const existingTeachers = get().teachers;
    const existingPeriods = get().periods;
    await Promise.all(existingTeachers.map((t) => firestoreAdapter.deleteDoc("teachers", t.id)));
    await Promise.all(existingPeriods.map((p) => firestoreAdapter.deleteDoc("periods", p.id)));

    // Write seed data
    await Promise.all(SEED_TEACHERS.map((t) => firestoreAdapter.setDoc("teachers", t)));
    await Promise.all(SEED_PERIODS.map((p) => firestoreAdapter.setDoc("periods", p)));

    set({ teachers: SEED_TEACHERS, periods: SEED_PERIODS });
  },

  async addTeacher(t) {
    await firestoreAdapter.setDoc("teachers", t);
    set((s) => ({ teachers: [...s.teachers, t] }));
  },

  async updateTeacher(t) {
    await firestoreAdapter.setDoc("teachers", t);
    set((s) => ({ teachers: s.teachers.map((x) => (x.id === t.id ? t : x)) }));
  },

  async removeTeacher(id) {
    await firestoreAdapter.deleteDoc("teachers", id);
    set((s) => ({ teachers: s.teachers.filter((t) => t.id !== id) }));
  },

  async toggleTeacherActive(id) {
    const teacher = get().teachers.find((t) => t.id === id);
    if (!teacher) return;
    const updated = { ...teacher, active: !teacher.active };
    await firestoreAdapter.setDoc("teachers", updated);
    set((s) => ({ teachers: s.teachers.map((t) => (t.id === id ? updated : t)) }));
  },

  async addPeriod(p) {
    await firestoreAdapter.setDoc("periods", p);
    const periods = [...get().periods, p].sort((a, b) => a.order - b.order);
    set({ periods });
  },

  async updatePeriod(p) {
    await firestoreAdapter.setDoc("periods", p);
    const periods = get().periods
      .map((x) => (x.id === p.id ? p : x))
      .sort((a, b) => a.order - b.order);
    set({ periods });
  },

  async removePeriod(id) {
    await firestoreAdapter.deleteDoc("periods", id);
    set((s) => ({ periods: s.periods.filter((p) => p.id !== id) }));
  },
}));
