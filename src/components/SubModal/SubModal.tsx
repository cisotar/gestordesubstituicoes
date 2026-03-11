import { useTeachersStore } from "@/store/teachersStore";
import { useSubstitutionsStore } from "@/store/substitutionsStore";
import { useToastStore } from "@/store/toastStore";
import { getSubstitutionCandidates, getAreaColor } from "@/utils/scheduleHelpers";
import { DAYS, AREA_COLORS } from "@/constants";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import type { SubModalTarget, Teacher } from "@/types";

interface SubModalProps {
  target: SubModalTarget;
  weekLabel: string;
  onClose: () => void;
}

export function SubModal({ target, weekLabel, onClose }: SubModalProps) {
  const { teacher, slot } = target;
  const { teachers, periods } = useTeachersStore();
  const { assign, getActive } = useSubstitutionsStore();
  const { push } = useToastStore();

  const period = periods.find((p) => p.id === slot.periodId);
  const dayName = DAYS[slot.day];
  const color = getAreaColor(slot.subject);
  const { sameArea, other } = getSubstitutionCandidates(teacher, slot.day, slot.periodId, teachers);
  const currentSub = getActive(teacher.id, slot.day, slot.periodId);
  const currentSubTeacher = currentSub
    ? teachers.find((t) => t.id === currentSub.substituteTeacherId)
    : null;

  function handleAssign(sub: Teacher) {
    assign({
      absentTeacherId: teacher.id,
      substituteTeacherId: sub.id,
      day: slot.day,
      periodId: slot.periodId,
      subject: slot.subject,
      room: slot.room,
      weekLabel,
    });
    push(`${sub.name} designado(a) como substituto(a).`, "ok");
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="flex justify-between items-start p-6 border-b border-border">
        <div>
          <h2 className="font-serif text-xl mb-1">Designar Substituição</h2>
          <p className="text-sm text-muted">
            <span style={{ color }}>{slot.subject}</span>
            {" · "}{dayName}{" · "}{period?.label} ({period?.time}){" · "}Sala {slot.room}
          </p>
          <p className="text-sm text-textSoft mt-1">
            Ausente: <strong>{teacher.name}</strong>
          </p>
        </div>
        <button
          className="text-muted hover:text-text text-lg ml-4 shrink-0"
          onClick={onClose}
        >✕</button>
      </div>

      {/* Current substitution banner */}
      {currentSubTeacher && (
        <div className="px-6 py-3 bg-ok/10 border-b border-ok/30 text-sm text-ok font-semibold">
          ✓ Substituição atual: {currentSubTeacher.name}
        </div>
      )}

      {/* Same area */}
      {sameArea.length > 0 && (
        <CandidateGroup
          label="Mesma área do conhecimento"
          accentColor={color}
          teachers={sameArea}
          currentSubId={currentSubTeacher?.id}
          onAssign={handleAssign}
        />
      )}

      {/* Other teachers */}
      {other.length > 0 && (
        <CandidateGroup
          label="Disponíveis — outras áreas"
          accentColor="#7a7f94"
          teachers={other}
          currentSubId={currentSubTeacher?.id}
          onAssign={handleAssign}
        />
      )}

      {sameArea.length === 0 && other.length === 0 && (
        <div className="p-8 text-center text-muted text-sm">
          Nenhum professor disponível neste horário.
        </div>
      )}
    </Modal>
  );
}

function CandidateGroup({
  label,
  accentColor,
  teachers,
  currentSubId,
  onAssign,
}: {
  label: string;
  accentColor: string;
  teachers: Teacher[];
  currentSubId?: string;
  onAssign: (t: Teacher) => void;
}) {
  return (
    <div className="px-6 py-4">
      <p
        className="text-[11px] font-black uppercase tracking-widest mb-3"
        style={{ color: accentColor }}
      >
        ● {label}
      </p>
      <div className="flex flex-col gap-2">
        {teachers.map((t) => {
          const isCurrent = t.id === currentSubId;
          return (
            <button
              key={t.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 w-full
                          text-left border transition-all duration-150
                          ${isCurrent
                  ? "bg-ok/10 border-ok/40"
                  : "bg-surface2 border-border hover:border-border2"
                }`}
              onClick={() => onAssign(t)}
            >
              <Avatar name={t.name} subject={t.subjects[0]} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text truncate">{t.name}</div>
                <div className="text-[11px] text-muted truncate">{t.subjects.join(", ")}</div>
              </div>
              {isCurrent ? (
                <span className="text-[11px] font-black text-ok bg-ok/20
                                 rounded px-2 py-0.5 shrink-0">
                  ✓ Designado
                </span>
              ) : (
                <span className="text-[11px] font-bold text-accent bg-accent/10
                                 rounded px-2 py-0.5 shrink-0">
                  Designar
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
