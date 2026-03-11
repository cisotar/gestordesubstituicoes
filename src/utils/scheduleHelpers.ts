import { SUBJECT_AREA_MAP, AREA_COLORS } from "@/constants";
import type { Teacher, DayKey } from "@/types";

export function getArea(subject: string): string {
  return SUBJECT_AREA_MAP[subject] ?? "Outras";
}

export function getAreaColor(subject: string): string {
  return AREA_COLORS[getArea(subject)] ?? AREA_COLORS["Outras"];
}

export function getTeacherAreas(teacher: Teacher): string[] {
  return [...new Set(teacher.subjects.map(getArea))];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export function isTeacherBusy(teacher: Teacher, day: DayKey, periodId: string): boolean {
  return teacher.schedule.some((s) => s.day === day && s.periodId === periodId);
}

export function getSubstitutionCandidates(
  absentTeacher: Teacher,
  day: DayKey,
  periodId: string,
  allTeachers: Teacher[]
): { sameArea: Teacher[]; other: Teacher[] } {
  const available = allTeachers.filter(
    (t) => t.id !== absentTeacher.id && t.active && !isTeacherBusy(t, day, periodId)
  );

  const absentAreas = new Set(absentTeacher.subjects.map(getArea));

  const sameArea = available.filter((t) =>
    t.subjects.some((s) => absentAreas.has(getArea(s)))
  );
  const sameAreaIds = new Set(sameArea.map((t) => t.id));
  const other = available.filter((t) => !sameAreaIds.has(t.id));

  return { sameArea, other };
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function formatISODate(date: Date = new Date()): string {
  return date.toISOString();
}

export function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
