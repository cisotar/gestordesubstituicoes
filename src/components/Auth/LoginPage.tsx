import { useAuthStore } from "@/store/authStore";

export function LoginPage() {
  const { login } = useAuthStore();

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="font-serif text-4xl mb-2">
            <span className="text-accent">●</span> GestãoDoc
          </div>
          <p className="text-muted text-sm">Gestão de Faltas & Substituições</p>
        </div>

        <div className="bg-surface border border-border2 rounded-2xl p-8">
          <h2 className="font-bold text-lg mb-1">Entrar</h2>
          <p className="text-muted text-sm mb-6">
            Use sua conta Google institucional para acessar o sistema.
          </p>

          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3
                       bg-white text-gray-800 font-semibold text-sm
                       rounded-lg py-3 px-4 hover:bg-gray-100
                       transition-colors duration-150"
          >
            <GoogleIcon />
            Entrar com Google
          </button>
        </div>

        <p className="text-center text-muted text-xs mt-6">
          Após o login, seu cadastro aguardará aprovação do administrador.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
