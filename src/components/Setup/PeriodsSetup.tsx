import { useState } from "react";
import { useTeachersStore } from "@/store/teachersStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { uid } from "@/utils/scheduleHelpers";
import type { Period } from "@/types";

export function PeriodsSetup() {
  const { periods, addPeriod, updatePeriod, removePeriod } = useTeachersStore();
  const { push } = useToastStore();
  const [editing, setEditing] = useState<Period | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Omit<Period, "id">>({ label: "", time: "", order: 0 });

  function handleSaveNew() {
    if (!draft.label.trim()) return;
    addPeriod({ ...draft, id: uid(), order: draft.order || periods.length + 1 });
    setDraft({ label: "", time: "", order: 0 });
    setShowNew(false);
    push("Tempo adicionado!", "ok");
  }

  function handleUpdate() {
    if (!editing) return;
    updatePeriod(editing);
    setEditing(null);
    push("Tempo atualizado!", "ok");
  }

  function handleDelete(id: string) {
    removePeriod(id);
    push("Tempo removido.", "warn");
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted">{periods.length} tempo(s)</span>
        <Button variant="primary" onClick={() => setShowNew(true)}>+ Novo Tempo</Button>
      </div>

      {showNew && (
        <PeriodForm
          value={draft}
          onChange={(v) => setDraft(v)}
          onSave={handleSaveNew}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="flex flex-col gap-3">
        {periods.map((p) =>
          editing?.id === p.id ? (
            <PeriodForm
              key={p.id}
              value={editing}
              onChange={(v) => setEditing(v as Period)}
              onSave={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              key={p.id}
              className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl"
            >
              <div className="flex-1">
                <div className="font-bold text-sm font-mono">{p.label}</div>
                <div className="text-muted text-xs font-mono">{p.time}</div>
              </div>
              <div className="text-muted text-xs font-mono">ordem {p.order}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setEditing({ ...p })}>Editar</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>
                  Remover
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function PeriodForm({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: Omit<Period, "id"> | Period;
  onChange: (v: Omit<Period, "id"> | Period) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-surface border border-border2 rounded-xl p-5 mb-4">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
            Rótulo
          </label>
          <input
            className="w-full"
            placeholder="Ex: 1º Tempo"
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
            Horário
          </label>
          <input
            className="w-full"
            placeholder="Ex: 07:00–07:50"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
            Ordem
          </label>
          <input
            className="w-full"
            type="number"
            placeholder="1"
            value={value.order}
            onChange={(e) => onChange({ ...value, order: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onSave}>Salvar</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
