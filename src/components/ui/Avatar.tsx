import { getInitials, getAreaColor } from "@/utils/scheduleHelpers";

interface AvatarProps {
  name: string;
  subject?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export function Avatar({ name, subject, size = "md" }: AvatarProps) {
  const color = subject ? getAreaColor(subject) : "#f0c040";
  return (
    <div
      className={`${sizes[size]} rounded-full bg-surface2 flex items-center
                  justify-center font-bold shrink-0 border-2`}
      style={{ borderColor: color, color }}
    >
      {getInitials(name)}
    </div>
  );
}
