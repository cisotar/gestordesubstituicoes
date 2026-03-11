# GestãoDoc — Gestão de Faltas & Substituições

Painel para gestão de faltas de professores e substituições escolares.

## Stack

- **React 18 + TypeScript** — tipagem forte nas entidades (Teacher, Slot, Substitution…)
- **Vite** — build ultra rápido
- **Zustand** — estado global leve e preparado para migração ao Firestore
- **Tailwind CSS** — utilitários de estilo consistentes
- **React Router v6** — navegação real entre páginas

## Estrutura

```
src/
├── components/
│   ├── Dashboard/          ← calendário semanal geral
│   ├── TeacherCalendar/    ← horário individual + atribuição de subs
│   ├── SubModal/           ← modal de seleção de substituto
│   ├── Setup/              ← cadastro de professores e tempos de aula
│   ├── History/            ← histórico de substituições
│   └── ui/                 ← Button, Modal, Avatar, Nav, Toast (reutilizáveis)
├── store/
│   ├── teachersStore.ts    ← professores e tempos (Zustand + localStorage)
│   ├── substitutionsStore.ts ← substituições (Zustand + localStorage)
│   └── toastStore.ts       ← notificações globais
├── storage/
│   └── localAdapter.ts     ← abstração de storage (troca por firestoreAdapter.ts)
├── hooks/                  ← hooks customizados (a crescer)
├── types/index.ts          ← Teacher, Slot, Period, Substitution…
├── utils/scheduleHelpers.ts ← área, candidatos, formatações
├── constants/index.ts      ← DAYS, AREAS, demo data
└── routes/index.tsx        ← definição de rotas
```

## Como rodar

```bash
npm install
npm run dev
```

## Migração para Firestore

Quando estiver pronto:
1. Criar `src/storage/firestoreAdapter.ts` com a mesma interface `StorageAdapter`
2. Trocar o import em `teachersStore.ts` e `substitutionsStore.ts`
3. Nenhum componente precisa mudar.

## Próximas funcionalidades previstas

- [ ] Autenticação de usuários
- [ ] Exportação de relatórios (PDF)
- [ ] Notificações / alertas
- [ ] Navegação por semanas
