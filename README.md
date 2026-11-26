# RunCoach

Plataforma web para gestão de atletas, planilhas de corrida/atletismo e preparação para TAF.
React + TypeScript + Vite + Tailwind CSS • Supabase (PostgreSQL + Auth + RLS) • Recharts • Lucide • PWA • GitHub Pages.

## O que o sistema faz

**Professor**
- Dashboard: atletas (total/ativos), treinos programados/concluídos/pendentes, próximos treinos, gráficos de evolução, atletas que precisam de acompanhamento, últimos resultados.
- Atletas: cadastro completo (inclui observações **privadas** que o atleta não consegue ler), categorias, grupos, situação ativo/inativo.
- Planilhas diárias/semanais/mensais/personalizadas, com todos os campos de treino pedidos; **copiar semana** (na planilha e na agenda de um atleta); atribuir a atletas individuais **ou grupos** (o atleta é notificado).
- Treinamentos: biblioteca de modelos reutilizáveis (aplicar a atletas/grupos em uma data).
- Calendário mensal e semanal (treinos, competições, avaliações, TAF, eventos).
- Resultados: treino planejado × realizado, marcas pessoais (PB) e competições; modalidades/provas extras cadastráveis.
- Relatórios individuais com filtros de período e modalidade, gráficos, comparação entre períodos, % de conclusão, metas — **exportação em PDF**.
- Módulo TAF: concursos/editais, testes, **índices mínimos informados por você** (nenhum índice oficial é embutido), metas individuais, painel por atleta e histórico.
- **Importar plano de treino em PDF**: envie uma planilha em PDF (ex.: preparação TAF de 12 semanas); o app lê o arquivo no navegador, mostra uma tela de conferência e salva o plano completo (dados do aluno, avaliação e meta, rotina, zonas de ritmo, todas as semanas, academia A/B, controle dos simulados, regras). Opcionalmente agenda todos os treinos no calendário do atleta (corrida e academia, nos dias certos).
- Mensagens: orientações, avisos, comentários; notificação automática de novas planilhas/treinos.

**Atleta**: **Meu plano** (o plano importado, completo), treinos do dia e da semana, registro do treino realizado (distância, tempo, ritmo calculado, esforço 1–10, observações, situação), histórico, gráficos de evolução, marcas, painel TAF (somente leitura), calendário próprio, mensagens.

## Início rápido

1. Configure o Supabase: **`docs/GUIA_SUPABASE.md`** (onde rodar cada script SQL, autorizar o seu e-mail de professor, URLs de redirecionamento).
2. Rode localmente ou publique: **`docs/PUBLICACAO.md`**.

```bash
npm install
cp .env.example .env      # VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## Estrutura

```
src/
  components/     UI reutilizável (ui/), formulários, gráficos, calendário, painel TAF, relatório, conversa
  pages/          auth/, professor/, athlete/
  layouts/        AppShell (menu lateral/gaveta/abas), ProfessorLayout, AthleteLayout
  contexts/       Auth, Theme (claro/escuro), Toast
  hooks/          useAsync, usePWA (instalação e atualização)
  services/       acesso a dados (athletes, training, results, taf, communication)
  integrations/supabase/client.ts
  types/  utils/ (formatação, TAF, relatórios, PDF)  styles/
supabase/migrations/   001 tabelas • 002 funções/triggers • 003 RLS • 004 planos de PDF • 005 acesso/exclusão/push
supabase/functions/    send-push (Edge Function de notificações)
supabase/seed_demo.sql dados fictícios opcionais (marcados como EXEMPLO)
public/                manifest.json, sw.js, ícones
.github/workflows/     deploy.yml (testes + build + Pages)
scripts/               test-rls.mjs (testa o SQL/RLS), generate-icons.mjs
```

## Segurança (como funciona de fato)

- **RLS em todas as tabelas.** Professor só acessa linhas com seu `professor_id`; atleta só lê o que é seu e só escreve seus registros de treino, marcas, comentários e "lida" nas mensagens. `anon` não tem acesso a nada.
- **Papéis definidos no banco**, nunca pelo navegador. O cadastro público só funciona para e-mails em `professor_allowlist` (professor) ou cadastrados por um professor (atleta); qualquer outro é recusado por um trigger.
- Triggers impedem alterar papel/e-mail do perfil, trocar o dono de um atleta e apontar registros para dados de outro professor.
- Observações do professor ficam em tabela separada (`athlete_notes`) sem política de leitura para atleta.
- Só a URL e a *Publishable key* vão para o frontend. Nunca use a *Secret/service_role key*.
- Validação de formulários (zod + regras próprias), tratamento de erros com mensagens claras, rotas protegidas por papel (a proteção real é o RLS).

## Testes e verificação

```bash
npm test          # 21 testes unitários (formatação, TAF, relatórios, leitor de PDF e de OCR)
npm run build     # typecheck + build
# RLS/SQL num Postgres local (não toca no seu Supabase):
npm i --no-save @electric-sql/pglite && node scripts/test-rls.mjs
```

O que foi verificado ao entregar: build e testes passando; 62 verificações de SQL/RLS num Postgres local (isolamento entre atletas e entre professores, cadastro bloqueado para e-mail não autorizado, escalada de privilégio bloqueada, funções `assign_sheet`/`copy_week`, TAF, mensagens, notas privadas, planos importados); o importador foi testado em navegador real com o PDF de exemplo, com ele escaneado (só imagem) e com uma foto levemente torta (todas as seções e os 60 treinos reconhecidos no PDF e no escaneado); todas as telas de professor e atleta abertas em navegador real (Chromium) sem erros de execução e sem rolagem horizontal em 390 px; recarregar a página em rota interna funciona (HashRouter).

## Limitações — leia

- **Conexão com o Supabase real não foi testada** por quem gerou o projeto (sem acesso à rede do seu projeto nem à Publishable key). A interface foi testada com o Supabase simulado e o SQL, num Postgres local. Faça o primeiro teste ponta a ponta: criar professor → cadastrar atleta → criar a conta do atleta em "Primeiro acesso" → atribuir uma planilha → registrar treino.
- **Recuperação de senha**: depende das URLs de redirecionamento do Supabase e (por usar PKCE) o link precisa ser aberto **no mesmo navegador** em que foi pedido. Teste uma vez após publicar.
- **Contas de atletas**: o professor cadastra o e-mail e o atleta define a própria senha em "Primeiro acesso" (o professor não vê nem define senhas).
- **Atleta inativo** perde o acesso de fato (o banco deixa de entregar qualquer dado e o app mostra "Acesso pausado"). **Excluir** um atleta apaga os dados e também o login dele (função `delete_athlete_account`, migração 005).
- **Importação de PDF**: o leitor foi construído e testado com o modelo de planilha enviado (cabeçalho, 4 cartões, tabela de zonas, tabelas Sem./Segunda/Quarta/Sexta, academia A/B, simulados, regras). PDFs com layout muito diferente podem ser lidos só em parte — por isso há sempre a tela de conferência e o texto bruto; seções não reconhecidas viram texto. **PDF escaneado e foto (JPG/PNG/WebP) funcionam por OCR** (Tesseract em português, rodando no navegador, arquivos servidos pelo próprio app): a leitura é menos exata (pode trocar 3'12" por 312", ou perder faixas coloridas de cabeçalho), por isso a tela de conferência avisa e **todos os textos são editáveis antes de salvar**. A 1ª leitura por OCR leva de ~10 a 60 s e baixa ~8 MB (depois fica em cache); fotos devem ser nítidas, bem iluminadas e de frente (fotos levemente tortas são endireitadas automaticamente). Máx. 12 páginas por OCR. Os treinos agendados são gerados a partir de colunas com dia da semana (Segunda, Quarta…) e de grupos de academia com dia entre parênteses (Terça, Quinta). O app avisa e pede confirmação antes de gerar os treinos de novo (duplicaria).
- **PDF (exportação)**: contém indicadores e tabelas (sem imagens dos gráficos).
- **Notificações**: dentro do app (atualizam a cada 30–60 s) e **push no celular** (Android e iPhone com o app instalado) — exige a configuração única de `docs/NOTIFICACOES.md` (chaves VAPID, Edge Function, webhook). O envio ponta a ponta não pôde ser testado por quem gerou o projeto. Não há e-mail.
- **Offline**: o app abre offline, mas todos os dados exigem internet.
- Escala: consultas paginam automaticamente (limite de 1.000 linhas do Supabase), mas não houve teste de carga com centenas de atletas.
- Calendário do professor mostra os treinos de todos os atletas em contagem por dia; use o filtro por atleta para ver o detalhe.
- Não há publicação nas lojas de aplicativos: o objetivo é uma PWA instalável.
