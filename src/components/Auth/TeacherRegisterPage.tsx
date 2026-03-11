import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { usePendingStore } from "@/store/pendingStore";
import { useTeachersStore } from "@/store/teachersStore";
import { useToastStore } from "@/store/toastStore";
import { DAY_KEYS, DAYS } from "@/constants";
import { Button } from "@/components/ui/Button";
import type { Slot } from "@/types";

export function TeacherRegisterPage() {
  const { user, profile, logout } = useAuthStore();
  const { submit, getByUser } = usePendingStore();
  const { periods } = useTeachersStore();
  const { push } = useToastStore();

  const existing = user ? getByUser(user.uid) : undefined;

  const [name, setName] = useState(existing?.name ?? profile?.displayName ?? "");
  const [subjectsRaw, setSubjectsRaw] = useState(existing?.subjects.join(", ") ?? "");
  const [schedule, setSchedule] = useState<Slot[]>(existing?.schedule ?? []);
  const [newSlot, setNewSlot] = useState<Slot>({
    day: "seg",
    periodId: periods[0]?.id ?? "1",
    subject: "",
    room: "",
  });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(
    existing?.status === "pending" || existing?.status === "approved"
  );

  function addSlot() {
    if (!newSlot.subject.trim()) { setError("Informe a disciplina/turma."); return; }
    if (!newSlot.room.trim()) { setError("Informe a sala."); return; }
    const dup = schedule.find((s) => s.day === newSlot.day && s.periodId === newSlot.periodId);
    if (dup) { setError("Você já tem uma aula neste dia/horário."); return; }
    setSchedule([...schedule, { ...newSlot }]);
    setNewSlot((p) => ({ ...p, subject: "", room: "" }));
    setError("");
  }

  function removeSlot(idx: number) {
    setSchedule(schedule.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!name.trim()) { setError("Informe seu nome completo."); return; }
    const subjects = subjectsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!subjects.length) { setError("Informe ao menos uma disciplina."); return; }
    if (!schedule.length) { setError("Adicione ao menos um horário de aula."); return; }
    if (!user) return;

    await submit({ name: name.trim(), subjects, schedule }, user.uid);
    push("Cadastro enviado! Aguarde a aprovação do administrador.", "ok");
    setSubmitted(true);
  }

  // Already submitted
  if (submitted && existing?.status === "approved") {
    return (
      <StatusScreen
        title="Cadastro aprovado! ✓"
        message="Seu cadastro foi aprovado pelo administrador. Você já pode visualizar o calendário."
        color="text-ok"
        onLogout={logout}
      />
    );
  }

  if (submitted) {
    return (
      <StatusScreen
        title="Cadastro enviado!"
        message="Seu cadastro está aguardando aprovação do administrador. Você receberá acesso assim que for aprovado."
        color="text-accent"
        onLogout={logout}
        onEdit={() => setSubmitted(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="font-serif text-3xl mb-1">
              <span className="text-accent">●</span> GestãoDoc
            </div>
            <p className="text-muted text-sm">Olá, {profile?.displayName} · Cadastro de Professor</p>
          </div>
          <button className="text-muted text-sm hover:text-text" onClick={logout}>
            Sair
          </button>
        </div>

        <div className="bg-surface border border-border2 rounded-2xl p-8">
          <h2 className="font-serif text-2xl mb-1">Seus dados</h2>
          <p className="text-muted text-sm mb-6">
            Preencha suas informações. Após enviar, o administrador irá aprovar seu cadastro.
          </p>

          {/* Name */}
          <Field label="Seu nome completo">
            <input
              className="w-full"
              placeholder="Ex: Tarciso Oliveira"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          {/* Subjects */}
          <Field label="Disciplinas que você leciona (separadas por vírgula)">
            <input
              className="w-full"
              placeholder="Ex: Sociologia, História"
              value={subjectsRaw}
              onChange={(e) => setSubjectsRaw(e.target.value)}
            />
          </Field>

          {/* Schedule */}
          <Field label="Seus horários de aula">
            {/* Slot list */}
            <div className="bg-bg rounded-lg p-3 mb-3 min-h-[48px]">
              {schedule.length === 0 ? (
                <p className="text-muted text-xs text-center py-1">
                  Nenhum horário adicionado ainda.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {schedule.map((s, i) => {
                    const p = periods.find((x) => x.id === s.periodId);
                    return (
                      <div key={i}
                        className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
                        <span className="font-bold text-accent w-32 truncate">{s.subject}</span>
                        <span className="text-muted font-mono text-xs">
                          {DAYS[s.day]} · {p?.label ?? s.periodId} · {p?.time}
                        </span>
                        <span className="text-muted font-mono text-xs">Sala {s.room}</span>
                        <button
                          className="ml-auto text-danger/50 hover:text-danger text-xs"
                          onClick={() => removeSlot(i)}
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add slot */}
            <div className="bg-surface2 border border-border rounded-xl p-4">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Adicionar horário
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Dia da semana</label>
                  <select
                    className="w-full"
                    value={newSlot.day}
                    onChange={(e) => setNewSlot((p) => ({ ...p, day: e.target.value as any }))}
                  >
                    {DAY_KEYS.map((d) => (
                      <option key={d} value={d}>{DAYS[d]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Horário (tempo)</label>
                  <select
                    className="w-full"
                    value={newSlot.periodId}
                    onChange={(e) => setNewSlot((p) => ({ ...p, periodId: e.target.value }))}
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>{p.label} — {p.time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Disciplina / Turma</label>
                  <input
                    className="w-full"
                    placeholder="Ex: Sociologia — 3ºA"
                    value={newSlot.subject}
                    onChange={(e) => setNewSlot((p) => ({ ...p, subject: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Sala</label>
                  <input
                    className="w-full"
                    placeholder="Ex: 201"
                    value={newSlot.room}
                    onChange={(e) => setNewSlot((p) => ({ ...p, room: e.target.value }))}
                  />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={addSlot}>
                + Adicionar este horário
              </Button>
            </div>
          </Field>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm
                            rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <Button variant="primary" className="w-full justify-center py-3 mt-2" onClick={handleSubmit}>
            Enviar cadastro para aprovação
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusScreen({
  title, message, color, onLogout, onEdit,
}: {
  title: string;
  message: string;
  color: string;
  onLogout: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="font-serif text-4xl mb-8">
          <span className="text-accent">●</span> GestãoDoc
        </div>
        <div className="bg-surface border border-border2 rounded-2xl p-8">
          <div className={`font-serif text-2xl mb-3 ${color}`}>{title}</div>
          <p className="text-muted text-sm mb-6">{message}</p>
          <div className="flex flex-col gap-2">
            {onEdit && (
              <Button variant="ghost" className="w-full justify-center" onClick={onEdit}>
                Editar cadastro
              </Button>
            )}
            <Button variant="ghost" className="w-full justify-center" onClick={onLogout}>
              Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
