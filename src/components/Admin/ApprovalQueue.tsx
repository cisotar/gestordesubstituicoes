import { usePendingStore, type PendingTeacher } from "@/store/pendingStore";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { DAY_KEYS, DAYS } from "@/constants";
import { useTeachersStore } from "@/store/teachersStore";

export function ApprovalQueue() {
  const { pending, approve, reject } = usePendingStore();
  const { profile } = useAuthStore();
  const { periods } = useTeachersStore();
  const { push } = useToastStore();

  const queue = pending.filter((p) => p.status === "pending");
  const reviewed = pending.filter((p) => p.status !== "pending");

  async function handleApprove(item: PendingTeacher) {
    if (!profile) return;
    await approve(item.id, profile);
    push(`${item.name} aprovado(a)!`, "ok");
  }

  async function handleReject(item: PendingTeacher) {
    await reject(item.id);
    push(`${item.name} rejeitado(a).`, "warn");
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Aprovações</h1>
        <p className="text-muted text-sm">Cadastros de professores aguardando aprovação</p>
      </div>

      {queue.length === 0 ? (
        <div className="text-center text-muted py-12 text-sm bg-surface border border-border rounded-xl">
          Nenhum cadastro pendente.
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-10">
          {queue.map((item) => (
            <PendingCard
              key={item.id}
              item={item}
              periods={periods}
              onApprove={() => handleApprove(item)}
              onReject={() => handleReject(item)}
            />
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <h2 className="font-bold text-sm text-muted uppercase tracking-wider mb-3">
            Revisados
          </h2>
          <div className="flex flex-col gap-3">
            {reviewed.map((item) => (
              <div key={item.id}
                className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl">
                <div className="flex-1">
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-muted text-xs">{item.subjects.join(", ")}</div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  item.status === "approved"
                    ? "bg-ok/10 text-ok"
                    : "bg-danger/10 text-danger"
                }`}>
                  {item.status === "approved" ? "Aprovado" : "Rejeitado"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingCard({
  item, periods, onApprove, onReject,
}: {
  item: PendingTeacher;
  periods: any[];
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-surface border border-accent/30 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-bold text-base">{item.name}</div>
          <div className="text-muted text-sm">{item.subjects.join(", ")}</div>
          <div className="font-mono text-xs text-muted mt-1">
            Enviado em {new Date(item.submittedAt).toLocaleString("pt-BR")}
          </div>
        </div>
        <span className="text-xs font-bold bg-accent/10 text-accent px-2 py-1 rounded shrink-0">
          Pendente
        </span>
      </div>

      {/* Schedule preview */}
      <div className="bg-bg rounded-lg p-3 mb-4">
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Horários</p>
        <div className="flex flex-col gap-1">
          {item.schedule.map((s, i) => {
            const p = periods.find((x: any) => x.id === s.periodId);
            return (
              <div key={i} className="flex gap-3 text-xs text-textSoft">
                <span className="font-bold text-accent w-28 truncate">{s.subject}</span>
                <span className="text-muted">{DAYS[s.day]} · {p?.label} · {p?.time}</span>
                <span className="text-muted">Sala {s.room}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 bg-ok/10 border border-ok/40 text-ok font-bold text-sm
                     rounded-lg py-2.5 hover:bg-ok/20 transition-colors"
          onClick={onApprove}
        >
          ✓ Aprovar
        </button>
        <button
          className="flex-1 bg-danger/10 border border-danger/40 text-danger font-bold text-sm
                     rounded-lg py-2.5 hover:bg-danger/20 transition-colors"
          onClick={onReject}
        >
          ✕ Rejeitar
        </button>
      </div>
    </div>
  );
}
