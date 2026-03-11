// ── Core domain types ──────────────────────────────────────────────────────

export type DayKey = "seg" | "ter" | "qua" | "qui" | "sex";

export interface Period {
  id: string;
  label: string;   // "1º Tempo"
  time: string;    // "07:00–07:50"
  order: number;   // for sorting
}

export interface Slot {
  day: DayKey;
  periodId: string;
  subject: string;
  room: string;
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];   // all subjects this teacher can teach
  schedule: Slot[];
  active: boolean;
}

export interface Substitution {
  id: string;
  absentTeacherId: string;
  substituteTeacherId: string;
  day: DayKey;
  periodId: string;
  subject: string;
  room: string;
  createdAt: string;   // ISO date string
  weekLabel: string;
  note?: string;
}

export interface SubstitutionHistory extends Substitution {
  absentTeacherName: string;
  substituteTeacherName: string;
}

// ── UI helpers ─────────────────────────────────────────────────────────────

export interface SubModalTarget {
  teacher: Teacher;
  slot: Slot;
}

export interface Toast {
  id: string;
  message: string;
  type: "ok" | "warn" | "error";
}
