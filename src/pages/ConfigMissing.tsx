export default function ConfigMissing() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-extrabold">
        Run<span className="text-brand-500">Coach</span> — configuração pendente
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        As variáveis de ambiente do Supabase não foram encontradas neste build. Defina:
      </p>
      <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100">{`VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-publishable-key`}</pre>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Em desenvolvimento, copie <code>.env.example</code> para <code>.env</code>. No GitHub Pages, cadastre-as em
        Settings → Secrets and variables → Actions → <b>Variables</b> e execute o deploy novamente. Veja o README.
      </p>
    </div>
  );
}
