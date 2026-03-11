import { useNavigate } from "react-router-dom";
import { useTeachersStore } from "@/store/teachersStore";
import { useSubstitutionsStore } from "@/store/substitutionsStore";
import { DAY_KEYS, DAYS } from "@/constants";
import { getAreaColor } from "@/utils/scheduleHelpers";
import type { Teacher, Slot } from "@/types";

interface DashboardProps {
  weekLabel: string;
}

export function Dashboard({ weekLabel }: DashboardProps) {
  const navigate = useNavigate();
  const { teachers, periods } = useTeachersStore();
  const { getActive } = useSubstitutionsStore();

  // Build grid: dayKey → periodId → slot entries
  const grid: Record<string, Record<string, { teacher: Teacher; slot: Slot }[]>> = {};
  DAY_KEYS.forEach((d) => {
    grid[d] = {};
    periods.forEach((p) => { grid[d][p.id] = []; });
  });
  teachers.forEach((t) => {
    t.schedule.forEach((s) => {
      if (grid[s.day]?.[s.periodId] !== undefined) {
        grid[s.day][s.periodId].push({ teacher: t, slot: s });
      }
    });
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Calendário Semanal</h1>
        <p className="text-muted text-sm">
          Todas as aulas · clique num professor para gerenciar substituições
        </p>
      </div>

      <div className="overflow-x-auto">
        {/* Day headers */}
        <div
          className="grid gap-1.5 mb-1.5 min-w-[700px]"
          style={{ gridTemplateColumns: "140px repeat(5, 1fr)" }}
        >
          <div />
          {DAY_KEYS.map((d) => (
            <div
              key={d}
              className="bg-surface2 rounded-lg py-2 text-center text-xs
                         font-bold tracking-widest text-textSoft uppercase"
            >
              {DAYS[d]}
            </div>
          ))}
        </div>

        {/* Period rows */}
        {periods.map((p) => (
          <div
            key={p.id}
            className="grid gap-1.5 mb-1.5 min-w-[700px]"
            style={{ gridTemplateColumns: "140px repeat(5, 1fr)" }}
          >
            {/* Period label */}
            <div className="flex flex-col justify-center px-2">
              <span className="text-xs font-bold text-text">{p.label}</span>
              <span className="font-mono text-[11px] text-muted">{p.time}</span>
            </div>

            {/* Day cells */}
            {DAY_KEYS.map((d) => {
              const entries = grid[d]?.[p.id] ?? [];
              return (
                <div
                  key={d}
                  className="bg-surface rounded-lg border border-border min-h-[72px]
                             p-1 flex flex-col gap-1"
                >
                  {entries.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center
                                    text-[#2a2d3e] text-sm">—</div>
                  ) : (
                    entries.map(({ teacher, slot }) => {
                      const sub = getActive(teacher.id, d, p.id);
                      const subTeacher = sub
                        ? teachers.find((t) => t.id === sub.substituteTeacherId)
                        : null;
                      const color = getAreaColor(slot.subject);
                      return (
                        <button
                          key={teacher.id + slot.subject}
                          className="w-full text-left bg-surface2 rounded-md p-2
                                     border border-transparent hover:border-border2
                                     transition-all duration-150 group"
                          style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                          onClick={() => navigate(`/teacher/${teacher.id}`)}
                        >
                          <div className="text-[11px] font-black" style={{ color }}>
                            {slot.subject}
                          </div>
                          <div className="text-[11px] font-semibold text-textSoft leading-tight">
                            {teacher.name}
                          </div>
                          <div className="font-mono text-[10px] text-muted">
                            Sala {slot.room}
                          </div>
                          {subTeacher && (
                            <div className="mt-1 text-[10px] font-bold text-ok
                                            bg-ok/10 rounded px-1 py-0.5">
                              SUB: {subTeacher.name.split(" ")[0]}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
