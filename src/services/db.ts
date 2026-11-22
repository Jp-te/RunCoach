/** Tradução de erros do Supabase/Postgres para mensagens claras. */
export function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('row-level security') || m.includes('permission denied'))
    return 'Você não tem permissão para realizar esta ação.';
  if (m.includes('duplicate key') || m.includes('already exists') || m.includes('unique'))
    return 'Já existe um registro com esses dados (ex.: e-mail ou nome repetido).';
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed'))
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  if (m.includes('violates foreign key')) return 'Este registro está vinculado a outros dados.';
  if (m.includes('violates check constraint')) return 'Algum valor informado é inválido.';
  return message;
}

export interface DbResult {
  data: unknown;
  error: { message: string } | null;
}

/** Retorna os dados ou lança Error com mensagem amigável. */
export function unwrap<T>(res: DbResult): T {
  if (res.error) throw new Error(friendlyError(res.error.message));
  return res.data as T;
}

/** Busca todas as linhas de uma consulta paginando em blocos (limite padrão do Supabase = 1000). */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<DbResult>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const rows = unwrap<T[] | null>(await build(from, from + size - 1)) ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? friendlyError(e.message) : 'Ocorreu um erro inesperado.';
}
