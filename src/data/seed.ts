/**
 * ─────────────────────────────────────────────────────────────
 *  ARQUIVO DE DADOS — edite aqui para cadastrar professores
 *  e tempos de aula em massa.
 *
 *  Depois de editar:
 *  1. Salve o arquivo
 *  2. Abra o sistema no navegador
 *  3. Vá em Configuração → clique em "Recarregar dados do código"
 * ─────────────────────────────────────────────────────────────
 */

import type { Teacher, Period } from "@/types";

export const SEED_PERIODS: Period[] = [
  { id: "1", label: "1º Tempo", time: "07:00–07:50", order: 1 },
  { id: "2", label: "2º Tempo", time: "07:50–08:40", order: 2 },
  { id: "3", label: "3º Tempo", time: "09:00–09:50", order: 3 },
  { id: "4", label: "4º Tempo", time: "09:50–10:40", order: 4 },
  { id: "5", label: "5º Tempo", time: "11:00–11:50", order: 5 },
];

export const SEED_TEACHERS: Teacher[] = [
  // ── EXEMPLO DE PROFESSOR ──────────────────────────────────
  // {
  //   id: "t1",               ← ID único, pode ser qualquer string
  //   active: true,
  //   name: "Nome Completo",
  //   subjects: ["Disciplina1", "Disciplina2"],
  //   schedule: [
  //     { day: "seg", periodId: "1", subject: "Disciplina1", room: "101" },
  //     { day: "ter", periodId: "2", subject: "Disciplina2", room: "102" },
  //   ],
  // },
  //
  // Dias disponíveis: "seg" | "ter" | "qua" | "qui" | "sex"
  // periodId: use os IDs definidos em SEED_PERIODS acima ("1" a "5")
  //
  // Disciplinas reconhecidas para mapeamento de área:
  //   Linguagens:           Português, Literatura, Inglês, Espanhol, Redação
  //   Matemática:           Matemática, Álgebra, Geometria, Cálculo
  //   Ciências da Natureza: Física, Química, Biologia
  //   Ciências Humanas:     História, Geografia, Filosofia, Sociologia
  //   Tecnologia:           Informática, Programação, Robótica
  //   Artes:                Artes, Música, Teatro
  // ─────────────────────────────────────────────────────────

  {
    id: "t1",
    active: true,
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
    id: "t2",
    active: true,
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
    id: "t3",
    active: true,
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
    id: "t4",
    active: true,
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
    id: "t5",
    active: true,
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
    id: "t6",
    active: true,
    name: "Marcos Vinicius",
    subjects: ["Biologia"],
    schedule: [
      { day: "seg", periodId: "1", subject: "Biologia", room: "Lab3" },
      { day: "ter", periodId: "4", subject: "Biologia", room: "Lab3" },
      { day: "qui", periodId: "2", subject: "Biologia", room: "Lab3" },
    ],
  },
];
