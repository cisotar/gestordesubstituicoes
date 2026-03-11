import { Routes, Route } from "react-router-dom";
import { Dashboard } from "@/components/Dashboard/Dashboard";
import { TeacherCalendar } from "@/components/TeacherCalendar/TeacherCalendar";
import { Setup } from "@/components/Setup/Setup";
import { History } from "@/components/History/History";
import { ApprovalQueue } from "@/components/Admin/ApprovalQueue";
import { useAuthStore } from "@/store/authStore";

interface AppRoutesProps {
  weekLabel: string;
}

export function AppRoutes({ weekLabel }: AppRoutesProps) {
  const { isAdmin } = useAuthStore();
  const admin = isAdmin();

  return (
    <Routes>
      <Route path="/" element={<Dashboard weekLabel={weekLabel} />} />
      <Route path="/teacher/:id" element={<TeacherCalendar weekLabel={weekLabel} />} />
      {admin && <Route path="/setup" element={<Setup />} />}
      {admin && <Route path="/history" element={<History />} />}
      {admin && <Route path="/approvals" element={<ApprovalQueue />} />}
    </Routes>
  );
}
