import type { DayKey, Teacher, Period } from "@/types";

export const DAYS: Record<DayKey, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
};

export const DAY_KEYS: DayKey[] = ["seg", "ter", "qua", "qui", "sex"];

export const SUBJECT_AREA_MAP: Record<string, string> = {
  Português: "Linguagens",
  Literatura: "Linguagens",
  Inglês: "Linguagens",
  Espanhol: "Linguagens",
  Redação: "Linguagens",
  Matemática: "Matemática",
  Álgebra: "Matemática",
  Geometria: "Matemática",
  Cálculo: "Matemática",
  Física: "Ciências da Natureza",
  Química: "Ciências da Natureza",
  Biologia: "Ciências da Natureza",
  História: "Ciências Humanas",
  Geografia: "Ciências Humanas",
  Filosofia: "Ciências Humanas",
  Sociologia: "Ciências Humanas",
  Informática: "Tecnologia",
  Programação: "Tecnologia",
  Robótica: "Tecnologia",
  Artes: "Artes",
  Música: "Artes",
  Teatro: "Artes",
};

export const AREA_COLORS: Record<string, string> = {
  Linguagens: "#4f9cf9",
  Matemática: "#f0c040",
  "Ciências da Natureza": "#4ec9a0",
  "Ciências Humanas": "#e05a3a",
  Tecnologia: "#a78bfa",
  Artes: "#f472b6",
  Outras: "#94a3b8",
};

// ── Demo seed data ─────────────────────────────────────────────────────────

export const DEMO_PERIODS: Period[] = [
  { id: "1", label: "1º Tempo", time: "07:00–07:50", order: 1 },
  { id: "2", label: "2º Tempo", time: "07:50–08:40", order: 2 },
  { id: "3", label: "3º Tempo", time: "09:00–09:50", order: 3 },
  { id: "4", label: "4º Tempo", time: "09:50–10:40", order: 4 },
  { id: "5", label: "5º Tempo", time: "11:00–11:50", order: 5 },
];

export const DEMO_TEACHERS: Teacher[] = [
  {
    id: "t1", active: true,
    name: "Ana Beatriz Costa",
    subjects: ["Português", "Literatura"],
    schedule: [
      { day: "seg", periodId: "1", subject: "Português", room: "101" },
      { day: "seg", periodId: "3", subject: "Literatura", room: "101" },
      { day: "ter", periodId: "2", subject: "Português", room: "102" },
      { day: "qua", periodId: "4", subject: "Literatura", room: "101" },
      { day: "qui", periodId: "1", subject: "Português", room: "103" },
    ],
  },
  {
    id: "t2", active: true,
    name: "Carlos Eduardo Melo",
    subjects: ["Matemática", "Geometria"],
    schedule: [
      { day: "seg", periodId: "2", subject: "Matemática", room: "201" },
      { day: "ter", periodId: "1", subject: "Geometria", room: "201" },
      { day: "ter", periodId: "4", subject: "Matemática", room: "202" },
      { day: "qui", periodId: "2", subject: "Matemática", room: "201" },
      { day: "sex", periodId: "3", subject: "Geometria", room: "201" },
    ],
  },
  {
    id: "t3", active: true,
    name: "Fernanda Lima",
    subjects: ["Física", "Química"],
    schedule: [
      { day: "seg", periodId: "4", subject: "Física", room: "Lab1" },
      { day: "qua", periodId: "1", subject: "Química", room: "Lab2" },
      { day: "qua", periodId: "3", subject: "Física", room: "Lab1" },
      { day: "sex", periodId: "2", subject: "Química", room: "Lab2" },
    ],
  },
  {
    id: "t4", active: true,
    name: "Rodrigo Alves",
    subjects: ["História", "Filosofia"],
    schedule: [
      { day: "ter", periodId: "3", subject: "História", room: "301" },
      { day: "qua", periodId: "2", subject: "Filosofia", room: "301" },
      { day: "qui", periodId: "4", subject: "História", room: "302" },
      { day: "sex", periodId: "1", subject: "Filosofia", room: "301" },
    ],
  },
  {
    id: "t5", active: true,
    name: "Juliana Ferreira",
    subjects: ["Inglês", "Espanhol"],
    schedule: [
      { day: "seg", periodId: "3", subject: "Inglês", room: "104" },
      { day: "ter", periodId: "1", subject: "Espanhol", room: "104" },
      { day: "qui", periodId: "3", subject: "Inglês", room: "105" },
      { day: "sex", periodId: "4", subject: "Espanhol", room: "104" },
    ],
  },
  {
    id: "t6", active: true,
    name: "Marcos Vinicius",
    subjects: ["Biologia"],
    schedule: [
      { day: "seg", periodId: "1", subject: "Biologia", room: "Lab3" },
      { day: "ter", periodId: "4", subject: "Biologia", room: "Lab3" },
      { day: "qui", periodId: "2", subject: "Biologia", room: "Lab3" },
    ],
  },
];
