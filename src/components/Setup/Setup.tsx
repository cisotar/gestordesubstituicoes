import { useState } from "react";
import { useTeachersStore } from "@/store/teachersStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { TeacherForm } from "./TeacherForm";
import { PeriodsSetup } from "./PeriodsSetup";
import type { Teacher } from "@/types";

type Tab = "teachers" | "periods";

export function Setup() {
  const [tab, setTab] = useState<Tab>("teachers");
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { teachers, removeTeacher, toggleTeacherActive, resetToSeed } = useTeachersStore();
  const { push } = useToastStore();

  function handleDelete(id: string) {
    removeTeacher(id);
    push("Professor removido.", "warn");
  }

  function handleEdit(t: Teacher) {
    setEditingTeacher(t);
    setShowForm(true);
  }

  function handleFormClose() {
    setEditingTeacher(null);
    setShowForm(false);
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Configuração</h1>
        <p className="text-muted text-sm">Gerencie professores, disciplinas e tempos de aula</p>
        <button
          className="mt-3 text-xs text-muted border border-border rounded-md px-3 py-1.5
                     hover:border-danger/50 hover:text-danger transition-all"
          onClick={() => {
            if (confirm("Substituir todos os dados pelos definidos em src/data/seed.ts?")) {
              resetToSeed();
              push("Dados recarregados do código.", "ok");
            }
          }}
        >
          ↺ Recarregar dados de src/data/seed.ts
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["teachers", "periods"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 rounded-md text-sm font-bold border transition-all
              ${tab === t
                ? "bg-surface2 border-accent/40 text-accent"
                : "bg-transparent border-border text-muted hover:text-text"
              }`}
            onClick={() => setTab(t)}
          >
            {t === "teachers" ? "Professores" : "Tempos de Aula"}
          </button>
        ))}
      </div>

      {tab === "teachers" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-muted">{teachers.length} professor(es)</span>
            <Button variant="primary" onClick={() => { setEditingTeacher(null); setShowForm(true); }}>
              + Novo Professor
            </Button>
          </div>

          {showForm && (
            <TeacherForm
              initial={editingTeacher}
              onDone={handleFormClose}
            />
          )}

          <div className="flex flex-col gap-3">
            {teachers.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-4 p-4 rounded-xl border
                  bg-surface transition-opacity
                  ${t.active ? "border-border opacity-100" : "border-border/50 opacity-60"}`}
              >
                <Avatar name={t.name} subject={t.subjects[0]} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className="text-muted text-xs">{t.subjects.join(" · ")}</div>
                  <div className="text-ok font-mono text-[11px] mt-0.5">
                    {t.schedule.length} aula(s) na semana
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => toggleTeacherActive(t.id)}>
                    {t.active ? "Inativar" : "Ativar"}
                  </Button>
                  <Button size="sm" onClick={() => handleEdit(t)}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(t.id)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "periods" && <PeriodsSetup />}
    </div>
  );
}
