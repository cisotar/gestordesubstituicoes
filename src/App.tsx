import { useEffect, useState } from "react";
import { useTeachersStore } from "@/store/teachersStore";
import { useSubstitutionsStore } from "@/store/substitutionsStore";
import { useAuthStore } from "@/store/authStore";
import { usePendingStore } from "@/store/pendingStore";
import { Nav } from "@/components/ui/Nav";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { LoginPage } from "@/components/Auth/LoginPage";
import { TeacherRegisterPage } from "@/components/Auth/TeacherRegisterPage";
import { AppRoutes } from "@/routes";

function getCurrentWeekLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(monday)} – ${fmt(friday)} ${friday.getFullYear()}`;
}

export default function App() {
  const { init, user, profile, loading } = useAuthStore();
  const { loadAll: loadTeachers } = useTeachersStore();
  const { loadAll: loadSubs } = useSubstitutionsStore();
  const { loadAll: loadPending } = usePendingStore();
  const [weekLabel] = useState(getCurrentWeekLabel);

  // Init Firebase auth listener
  useEffect(() => {
    const unsub = init();
    return unsub;
  }, []);

  // Load data once authenticated
  useEffect(() => {
    if (user) {
      loadTeachers();
      loadSubs();
      loadPending();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted text-sm font-mono animate-pulse">Carregando…</div>
      </div>
    );
  }

  // Not logged in
  if (!user) return <LoginPage />;

  // Logged in but not yet approved (pending or no profile role yet)
  if (profile && profile.role === "pending") {
    return <TeacherRegisterPage />;
  }

  // Logged in, no profile yet — show register
  if (!profile) return <TeacherRegisterPage />;

  // Professor with no schedule yet
  if (profile.role === "professor" && !profile.teacherId) {
    return <TeacherRegisterPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Nav weekLabel={weekLabel} />
      <main className="flex-1">
        <AppRoutes weekLabel={weekLabel} />
      </main>
      <ToastContainer />
    </div>
  );
}
