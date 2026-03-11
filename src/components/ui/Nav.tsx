import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { usePendingStore } from "@/store/pendingStore";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-bold transition-all duration-150 border ${
    isActive
      ? "bg-surface2 border-border2 text-accent"
      : "bg-transparent border-transparent text-muted hover:text-text"
  }`;

export function Nav({ weekLabel }: { weekLabel: string }) {
  const navigate = useNavigate();
  const { profile, logout, isAdmin } = useAuthStore();
  const { pending } = usePendingStore();
  const pendingCount = pending.filter((p) => p.status === "pending").length;
  const admin = isAdmin();

  return (
    <nav className="sticky top-0 z-40 flex items-center gap-4 px-8 py-3
                    bg-surface border-b border-border">
      <button
        className="font-serif text-xl tracking-tight whitespace-nowrap mr-2"
        onClick={() => navigate("/")}
      >
        <span className="text-accent mr-1">●</span>GestãoDoc
      </button>

      <div className="flex items-center gap-1 flex-1">
        <NavLink to="/" end className={linkClass}>Calendário</NavLink>
        {admin && <NavLink to="/setup" className={linkClass}>Configuração</NavLink>}
        {admin && <NavLink to="/history" className={linkClass}>Histórico</NavLink>}
        {admin && (
          <NavLink to="/approvals" className={linkClass}>
            Aprovações
            {pendingCount > 0 && (
              <span className="ml-1.5 bg-accent text-bg text-[10px] font-black
                               rounded-full w-4 h-4 inline-flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </NavLink>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="font-mono text-xs text-muted bg-surface2 border border-border2
                        px-3 py-1.5 rounded-md whitespace-nowrap hidden md:block">
          {weekLabel}
        </div>
        {profile && (
          <div className="flex items-center gap-2">
            {profile.photoURL && (
              <img src={profile.photoURL} className="w-7 h-7 rounded-full" alt="" />
            )}
            <span className="text-xs text-muted hidden md:block">
              {profile.displayName.split(" ")[0]}
            </span>
            <button
              className="text-xs text-muted hover:text-danger transition-colors ml-1"
              onClick={logout}
              title="Sair"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
