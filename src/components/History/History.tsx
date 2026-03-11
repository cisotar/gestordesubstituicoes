import { useSubstitutionsStore } from "@/store/substitutionsStore";
import { useTeachersStore } from "@/store/teachersStore";
import { DAYS } from "@/constants";
import { getAreaColor, formatDisplayDate } from "@/utils/scheduleHelpers";

export function History() {
  const { getHistory } = useSubstitutionsStore();
  const { teachers, periods } = useTeachersStore();
  const history = getHistory();

  function getTeacher(id: string) {
    return teachers.find((t) => t.id === id);
  }

  function getPeriod(id: string) {
    return periods.find((p) => p.id === id);
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Histórico de Substituições</h1>
        <p className="text-muted text-sm">{history.length} registro(s)</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center text-muted py-16 text-sm">
          Nenhuma substituição registrada ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((s) => {
            const absent = getTeacher(s.absentTeacherId);
            const sub = getTeacher(s.substituteTeacherId);
            const period = getPeriod(s.periodId);
            const color = getAreaColor(s.subject);
            return (
              <div
                key={s.id}
                className="bg-surface border border-border rounded-xl p-4
                           flex items-start gap-4"
              >
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ background: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-black" style={{ color }}>
                      {s.subject}
                    </span>
                    <span className="text-muted text-xs font-mono">
                      {DAYS[s.day]} · {period?.label} · Sala {s.room}
                    </span>
                    <span className="text-xs text-muted bg-surface2 rounded px-2 py-0.5">
                      {s.weekLabel}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted">Ausente:</span>{" "}
                    <span className="font-semibold text-textSoft">{absent?.name ?? "—"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted">Substituto:</span>{" "}
                    <span className="font-bold text-ok">{sub?.name ?? "—"}</span>
                  </div>
                  {s.note && (
                    <div className="text-xs text-muted mt-1 italic">{s.note}</div>
                  )}
                </div>
                <div className="font-mono text-[11px] text-muted shrink-0 text-right">
                  {formatDisplayDate(s.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
