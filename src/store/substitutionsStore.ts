import { create } from "zustand";
import { firestoreAdapter } from "@/storage/firestoreAdapter";
import type { Substitution, DayKey } from "@/types";
import { uid, formatISODate } from "@/utils/scheduleHelpers";

interface SubstitutionsState {
  substitutions: Substitution[];

  loadAll: () => Promise<void>;
  getActive: (teacherId: string, day: DayKey, periodId: string) => Substitution | undefined;

  assign: (params: {
    absentTeacherId: string;
    substituteTeacherId: string;
    day: DayKey;
    periodId: string;
    subject: string;
    room: string;
    weekLabel: string;
    note?: string;
  }) => Promise<void>;

  remove: (absentTeacherId: string, day: DayKey, periodId: string, weekLabel: string) => Promise<void>;
  getHistory: () => Substitution[];
}

export const useSubstitutionsStore = create<SubstitutionsState>((set, get) => ({
  substitutions: [],

  async loadAll() {
    const substitutions = await firestoreAdapter.getCollection<Substitution>("substitutions");
    set({ substitutions });
  },

  getActive(teacherId, day, periodId) {
    return [...get().substitutions]
      .reverse()
      .find(
        (s) =>
          s.absentTeacherId === teacherId &&
          s.day === day &&
          s.periodId === periodId
      );
  },

  async assign({ absentTeacherId, substituteTeacherId, day, periodId, subject, room, weekLabel, note }) {
    const existing = get().substitutions.find(
      (s) =>
        s.absentTeacherId === absentTeacherId &&
        s.day === day &&
        s.periodId === periodId &&
        s.weekLabel === weekLabel
    );
    if (existing) {
      await firestoreAdapter.deleteDoc("substitutions", existing.id);
    }
    const newSub: Substitution = {
      id: uid(),
      absentTeacherId,
      substituteTeacherId,
      day,
      periodId,
      subject,
      room,
      createdAt: formatISODate(),
      weekLabel,
      note,
    };
    await firestoreAdapter.setDoc("substitutions", newSub);
    const filtered = get().substitutions.filter((s) => s.id !== existing?.id);
    set({ substitutions: [...filtered, newSub] });
  },

  async remove(absentTeacherId, day, periodId, weekLabel) {
    const existing = get().substitutions.find(
      (s) =>
        s.absentTeacherId === absentTeacherId &&
        s.day === day &&
        s.periodId === periodId &&
        s.weekLabel === weekLabel
    );
    if (existing) {
      await firestoreAdapter.deleteDoc("substitutions", existing.id);
      set((s) => ({ substitutions: s.substitutions.filter((x) => x.id !== existing.id) }));
    }
  },

  getHistory() {
    return [...get().substitutions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
}));
