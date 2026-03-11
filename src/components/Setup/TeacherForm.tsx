import { useState } from "react";
import { useTeachersStore } from "@/store/teachersStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { DAY_KEYS, DAYS } from "@/constants";
import { uid } from "@/utils/scheduleHelpers";
import type { Teacher, Slot } from "@/types";

interface TeacherFormProps {
  initial: Teacher | null;
  onDone: () => void;
}

export function TeacherForm({ initial, onDone }: TeacherFormProps) {
  const { addTeacher, updateTeacher, periods } = useTeachersStore();
  const { push } = useToastStore();

  const [name, setName] = useState(initial?.name ?? "");
  const [subjectsRaw, setSubjectsRaw] = useState(initial?.subjects.join(", ") ?? "");
  const [schedule, setSchedule] = useState<Slot[]>(initial?.schedule ?? []);
  const [newSlot, setNewSlot] = useState<Slot>({
    day: "seg",
    periodId: periods[0]?.id ?? "1",
    subject: "",
    room: "",
  });
  const [error, setError] = useState("");

  function addSlot() {
    if (!newSlot.subject.trim()) { setError("Informe a disciplina/turma."); return; }
    if (!newSlot.room.trim()) { setError("Informe a sala."); return; }
    const dup = schedule.find((s) => s.day === newSlot.day && s.periodId === newSlot.periodId);
    if (dup) { setError("Já existe uma aula neste dia/horário."); return; }
    setSchedule([...schedule, { ...newSlot, subject: newSlot.subject.trim(), room: newSlot.room.trim() }]);
    setNewSlot((p) => ({ ...p, subject: "", room: "" }));
    setError("");
  }

  function removeSlot(idx: number) {
    setSchedule(schedule.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!name.trim()) { setError("Informe o nome do professor."); return; }
    const subjects = subjectsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!subjects.length) { setError("Informe ao menos uma disciplina."); return; }
    const teacher: Teacher = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      subjects,
      schedule,
      active: initial?.active ?? true,
    };
    initial ? updateTeacher(teacher) : addTeacher(teacher);
    push(`Professor ${name.trim()} salvo!`, "ok");
    onDone();
  }

  return (
    <div className="bg-surface border border-border2 rounded-xl p-6 mb-6">
      <h3 className="font-bold text-sm mb-4 text-textSoft uppercase tracking-wider">
        {initial ? "Editar Professor" : "Novo Professor"}
      </h3>

      <div className="grid gap-4 mb-4">
        <Field label="Nome completo">
          <input
            className="w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Maria da Silva"
          />
        </Field>

        <Field label="Disciplinas (separadas por vírgula)">
          <input
            className="w-full"
            value={subjectsRaw}
            onChange={(e) => setSubjectsRaw(e.target.value)}
            placeholder="Ex: Matemática, Álgebra"
          />
          <p className="text-[11px] text-muted mt-1">
            Use nomes mapeados para área: Português, Matemática, Física, História…
          </p>
        </Field>

        <Field label="Horários de Aula">
          {/* Slot list */}
          <div className="bg-bg rounded-lg p-2 mb-3 min-h-[40px]">
            {schedule.length === 0 ? (
              <p className="text-[11px] text-muted text-center py-2">Nenhuma aula adicionada.</p>
            ) : (
              schedule.map((s, i) => {
                const p = periods.find((x) => x.id === s.periodId);
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0 text-xs">
                    <span className="font-bold text-accent w-28 truncate">{s.subject}</span>
                    <span className="text-muted font-mono">
                      {DAYS[s.day]} · {p?.label ?? s.periodId}
                    </span>
                    <span className="text-muted font-mono">Sala {s.room}</span>
                    <button
                      className="ml-auto text-danger/60 hover:text-danger text-xs"
                      onClick={() => removeSlot(i)}
                    >✕</button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add slot row */}
          <div className="flex flex-wrap gap-2 items-end">
            <select
              value={newSlot.day}
              onChange={(e) => setNewSlot((p) => ({ ...p, day: e.target.value as any }))}
            >
              {DAY_KEYS.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
            </select>
            <select
              value={newSlot.periodId}
              onChange={(e) => setNewSlot((p) => ({ ...p, periodId: e.target.value }))}
            >
              {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input
              className="flex-1 min-w-[130px]"
              placeholder="Disciplina/Turma"
              value={newSlot.subject}
              onChange={(e) => setNewSlot((p) => ({ ...p, subject: e.target.value }))}
            />
            <input
              className="w-24"
              placeholder="Sala"
              value={newSlot.room}
              onChange={(e) => setNewSlot((p) => ({ ...p, room: e.target.value }))}
            />
            <Button variant="ghost" size="sm" onClick={addSlot}>+ Aula</Button>
          </div>
        </Field>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-xs
                        rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="primary" onClick={handleSave}>Salvar</Button>
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
