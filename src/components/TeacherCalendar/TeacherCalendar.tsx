import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTeachersStore } from "@/store/teachersStore";
import { useSubstitutionsStore } from "@/store/substitutionsStore";
import { useToastStore } from "@/store/toastStore";
import { DAY_KEYS, DAYS } from "@/constants";
import { getAreaColor, getTeacherAreas } from "@/utils/scheduleHelpers";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SubModal } from "@/components/SubModal/SubModal";
import type { Slot, SubModalTarget } from "@/types";

interface TeacherCalendarProps {
  weekLabel: string;
}

export function TeacherCalendar({ weekLabel }: TeacherCalendarProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { teachers, periods } = useTeachersStore();
  const { getActive, remove } = useSubstitutionsStore();
  const { push } = useToastStore();
  const [modalTarget, setModalTarget] = useState<SubModalTarget | null>(null);

  const teacher = teachers.find((t) => t.id === id);
  if (!teacher) {
    return (
      <div className="p-8">
        <p className="text-muted">Professor não encontrado.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>← Voltar</Button>
      </div>
    );
  }

  const scheduleMap: Record<string, Slot> = {};
  teacher.schedule.forEach((s) => {
    scheduleMap[`${s.day}-${s.periodId}`] = s;
  });

  const areas = getTeacherAreas(teacher);

  function handleRemoveSub(day: string, periodId: string) {
    remove(teacher.id, day as any, periodId, weekLabel);
    push("Substituição removida.", "warn");
  }

  return (
    <div className="p-8">
      {/* Header */}
      <button
        className="text-muted text-sm mb-4 hover:text-text transition-colors"
        onClick={() => navigate("/")}
      >
        ← Calendário Geral
      </button>

      <div className="flex items-center gap-4 mb-8">
        <Avatar name={teacher.name} subject={teacher.subjects[0]} size="lg" />
        <div>
          <h1 className="font-serif text-3xl mb-0.5">{teacher.name}</h1>
          <p className="text-muted text-sm">
            {teacher.subjects.join(" · ")}
            <span className="mx-2 text-border2">|</span>
            {areas.map((a, i) => (
              <span
                key={a}
                style={{ color: getAreaColor(teacher.subjects.find((s) => s) ?? "") }}
              >
                {a}{i < areas.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
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

        {periods.map((p) => (
          <div
            key={p.id}
            className="grid gap-1.5 mb-1.5 min-w-[700px]"
            style={{ gridTemplateColumns: "140px repeat(5, 1fr)" }}
          >
            <div className="flex flex-col justify-center px-2">
              <span className="text-xs font-bold text-text">{p.label}</span>
              <span className="font-mono text-[11px] text-muted">{p.time}</span>
            </div>

            {DAY_KEYS.map((d) => {
              const slot = scheduleMap[`${d}-${p.id}`];
              const sub = slot ? getActive(teacher.id, d, p.id) : undefined;
              const subTeacher = sub
                ? teachers.find((t) => t.id === sub.substituteTeacherId)
                : null;

              if (!slot) {
                return (
                  <div
                    key={d}
                    className="rounded-lg border border-dashed border-border min-h-[72px]
                               flex items-center justify-center text-[#2a2d3e] text-sm"
                  >
                    —
                  </div>
                );
              }

              const color = getAreaColor(slot.subject);
              return (
                <div key={d} className="flex flex-col gap-1">
                  <button
                    className="w-full text-left bg-surface2 rounded-md p-2.5
                               border hover:border-accent/40 transition-all group"
                    style={{ borderColor: color + "55", borderLeftColor: color, borderLeftWidth: 3 }}
                    onClick={() => setModalTarget({ teacher, slot })}
                  >
                    <div className="text-[11px] font-black" style={{ color }}>
                      {slot.subject}
                    </div>
                    <div className="font-mono text-[10px] text-muted">Sala {slot.room}</div>
                    <div className="mt-1.5 text-[10px] font-bold text-accent/70
                                    group-hover:text-accent transition-colors">
                      + Atribuir substituição
                    </div>
                  </button>

                  {subTeacher && (
                    <div
                      className="flex items-center gap-1.5 bg-ok/10 border border-ok/30
                                 rounded-md px-2 py-1.5"
                    >
                      <span className="text-[10px] font-black text-ok bg-ok/20
                                       rounded px-1 shrink-0">
                        SUB
                      </span>
                      <span className="text-[11px] font-semibold text-ok flex-1 truncate">
                        {subTeacher.name}
                      </span>
                      <button
                        className="text-muted hover:text-danger text-[11px] shrink-0
                                   transition-colors"
                        title="Remover substituição"
                        onClick={() => handleRemoveSub(d, p.id)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {modalTarget && (
        <SubModal
          target={modalTarget}
          weekLabel={weekLabel}
          onClose={() => setModalTarget(null)}
        />
      )}
    </div>
  );
}
