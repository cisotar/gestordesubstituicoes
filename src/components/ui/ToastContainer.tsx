import { useToastStore } from "@/store/toastStore";

const typeStyles = {
  ok: "border-ok text-ok",
  warn: "border-accent text-accent",
  error: "border-danger text-danger",
};

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter pointer-events-auto bg-surface border rounded-lg
                      px-4 py-3 text-sm font-semibold shadow-2xl max-w-xs
                      ${typeStyles[t.type]}`}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
