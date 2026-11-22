# Publicação no GitHub Pages

O app é 100% estático (React + Vite) e usa **HashRouter**: as rotas ficam depois do `#` (ex.: `.../repo/#/professor/atletas`), então atualizar a página nunca gera 404. O `base` do Vite é `./`, por isso funciona em qualquer nome de repositório.

## Passo a passo

1. **Crie o repositório** no GitHub e envie o conteúdo desta pasta (a pasta `.github/workflows` precisa ir junto; `.env` **não** deve ir — já está no `.gitignore`).
   ```bash
   git init && git add . && git commit -m "RunCoach"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
   git push -u origin main
   ```
2. **Ative o Pages**: repositório → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Cadastre as variáveis** (não precisam ser secretas): **Settings → Secrets and variables → Actions → aba *Variables* → New repository variable**:
   - `VITE_SUPABASE_URL` = `https://sigfnhwheyyqprgimori.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = sua *Publishable key*
4. **Rode o deploy**: aba **Actions → Deploy RunCoach no GitHub Pages → Run workflow** (ou faça um novo push na `main`).
5. O endereço público aparece no final do job e em Settings → Pages: `https://SEU-USUARIO.github.io/SEU-REPO/`.
6. **Volte ao Supabase** e configure *Site URL* e *Redirect URLs* com esse endereço (`docs/GUIA_SUPABASE.md`, passo 3). Sem isso, o link de recuperação de senha não funciona.

> Em contas gratuitas do GitHub, o Pages só publica repositórios **públicos**. Isso é seguro aqui: o código não contém segredos e os dados são protegidos pelo RLS. Repositório privado exige plano pago.

O workflow roda os testes (`npm test`) e o build antes de publicar; se algo falhar, nada é publicado.

## Instalação como aplicativo (PWA)

- **Android (Chrome)**: menu ⋮ → *Instalar aplicativo*. O app também mostra o botão "Instalar agora" em *Configurações* / *Minha conta* e na tela `#/instalar`.
- **iPhone/iPad (Safari)**: Compartilhar → *Adicionar à Tela de Início* (somente no Safari).
- O Service Worker guarda apenas o "casco" do app (HTML/JS/CSS/ícones) para abrir rápido; **os dados sempre vêm da internet** (chamadas ao Supabase nunca são colocadas em cache).
- **Atualizações**: quando você publica uma versão nova, os usuários veem a faixa "Nova versão disponível — Atualizar agora". A troca só acontece quando a pessoa clica (nunca no meio de um treino sendo registrado).

> Isto é uma PWA instalável. Não há publicação nas lojas Google Play / App Store.

## Desenvolvimento local

```bash
npm install
cp .env.example .env     # preencha URL e Publishable key
npm run dev              # http://localhost:5173
npm test                 # testes unitários
npm run build            # typecheck + build de produção
npm run preview          # serve o build
```

Para regenerar os ícones: `npm run icons` (gera os PNG a partir de `public/icons/icon.svg`).
