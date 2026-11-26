// Teste de SQL + RLS em um Postgres local (PGlite), simulando o schema "auth" do Supabase.
// Uso: node scripts/test-rls.mjs   (requer: npm i --no-save @electric-sql/pglite)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const db = new PGlite();

let failures = 0;
const ok = (name) => console.log('  ✓', name);
const fail = (name, extra = '') => {
  failures++;
  console.log('  ✗', name, extra);
};
async function expectRows(name, sql, n) {
  const r = await db.query(sql);
  r.rows.length === n ? ok(name) : fail(name, `(esperado ${n}, veio ${r.rows.length})`);
}
async function expectError(name, sql) {
  try {
    await db.exec(sql);
    fail(name, '(deveria ter falhado)');
  } catch {
    ok(name);
  }
}
async function expectOk(name, sql) {
  try {
    await db.exec(sql);
    ok(name);
  } catch (e) {
    fail(name, e.message);
  }
}
const as = async (uid) => {
  await db.exec('reset role');
  if (uid) {
    await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`);
    await db.exec('set role authenticated');
  } else {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec('set role anon');
  }
};

// ---- Mock mínimo do Supabase ----
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);

for (const f of ['001_schema.sql', '002_functions_triggers.sql', '003_rls.sql', '004_training_plans.sql', '005_acesso_e_push.sql']) {
  await db.exec(readFileSync(join(dir, f), 'utf8'));
  console.log('Aplicado', f);
}
// idempotência: reaplica tudo
for (const f of ['001_schema.sql', '002_functions_triggers.sql', '003_rls.sql', '004_training_plans.sql', '005_acesso_e_push.sql']) {
  await db.exec(readFileSync(join(dir, f), 'utf8'));
}
ok('migrations são idempotentes (rodaram 2x)');

console.log('\nCadastro controlado');
await db.exec(`insert into public.professor_allowlist(email) values ('prof1@x.com'), ('prof2@x.com')`);
await expectError('e-mail qualquer NÃO consegue se cadastrar', `insert into auth.users(email) values ('intruso@x.com')`);
await db.exec(`insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a1','prof1@x.com'), ('00000000-0000-0000-0000-0000000000a2','prof2@x.com')`);
const P1 = '00000000-0000-0000-0000-0000000000a1';
const P2 = '00000000-0000-0000-0000-0000000000a2';
await expectRows('professores viraram role=professor', `select 1 from public.profiles where role='professor'`, 2);
await expectRows('modalidades padrão criadas (11 por professor)', `select 1 from public.modalities where professor_id='${P1}'`, 11);

// Professor 1 cadastra 2 atletas; professor 2 cadastra 1
await as(P1);
await db.exec(`insert into public.athletes(id,professor_id,full_name,email) values
  ('00000000-0000-0000-0000-0000000000b1','${P1}','Atleta Um','a1@x.com'),
  ('00000000-0000-0000-0000-0000000000b2','${P1}','Atleta Dois','a2@x.com')`);
await as(P2);
await db.exec(`insert into public.athletes(id,professor_id,full_name,email) values
  ('00000000-0000-0000-0000-0000000000b3','${P2}','Atleta Três','a3@x.com')`);
await as(null);
await db.exec('reset role');
await db.exec(`insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-0000000000c1','a1@x.com'),
  ('00000000-0000-0000-0000-0000000000c2','a2@x.com')`);
const A1 = '00000000-0000-0000-0000-0000000000c1';
const A2 = '00000000-0000-0000-0000-0000000000c2';
const AT1 = '00000000-0000-0000-0000-0000000000b1';
const AT2 = '00000000-0000-0000-0000-0000000000b2';
const AT3 = '00000000-0000-0000-0000-0000000000b3';
await expectRows('atletas convidados viraram role=atleta e foram vinculados',
  `select 1 from public.athletes where user_id in ('${A1}','${A2}')`, 2);

console.log('\nIsolamento entre professores');
await as(P1);
await expectRows('P1 vê só seus 2 atletas', `select 1 from public.athletes`, 2);
await as(P2);
await expectRows('P2 vê só seu 1 atleta', `select 1 from public.athletes`, 1);
await as(P1);
await expectError('P1 não insere treino para atleta do P2',
  `insert into public.workouts(professor_id,athlete_id,scheduled_date,name) values ('${P1}','${AT3}',current_date,'x')`);
await expectOk('P1 insere treino para seu atleta',
  `insert into public.workouts(professor_id,athlete_id,scheduled_date,name) values ('${P1}','${AT1}',current_date,'Contínuo 5k'),
                                                                                 ('${P1}','${AT2}',current_date,'Tiros 400')`);

console.log('\nIsolamento entre atletas');
await as(A1);
await expectRows('A1 vê só o próprio registro de atleta', `select 1 from public.athletes`, 1);
await expectRows('A1 vê só o próprio treino', `select 1 from public.workouts`, 1);
await expectOk('A1 registra o próprio treino',
  `insert into public.workout_logs(athlete_id,professor_id,log_date,distance_m,time_s,rpe) values ('${AT1}','${P1}',current_date,5000,1500,6)`);
await expectError('A1 não registra treino em nome do A2',
  `insert into public.workout_logs(athlete_id,professor_id,log_date,distance_m) values ('${AT2}','${P1}',current_date,1000)`);
await as(P1);
const w2 = (await db.query(`select id from public.workouts where athlete_id='${AT2}' limit 1`)).rows[0].id;
await as(A1);
await expectError('A1 não vincula registro a treino do A2',
  `insert into public.workout_logs(athlete_id,professor_id,workout_id,log_date) values ('${AT1}','${P1}','${w2}',current_date)`);
await as(A2);
await expectRows('A2 não enxerga o registro do A1', `select 1 from public.workout_logs`, 0);
await as(A1);
await expectError('A1 não vira professor (update de role)', `update public.profiles set role='professor' where id='${A1}'`);
await expectRows('A1 não consegue trocar o dono de atleta (0 linhas afetadas)', `update public.athletes set professor_id='${A1}' returning 1`, 0);
await expectRows('A1 não consegue editar ficha do atleta (0 linhas afetadas)', `update public.athletes set goals='hack' returning 1`, 0);
await expectError('A1 não cria planilha', `insert into public.sheets(professor_id,name) values ('${A1}','x')`);
await expectError('A1 não cria evento como professor', `insert into public.calendar_events(professor_id,title,event_date) values ('${A1}','x',current_date)`);
await expectRows('A1 não vê allowlist', `select 1 from public.professor_allowlist`, 0).catch(() => ok('A1 sem acesso à allowlist'));

await as(P1);
await expectOk('P1 grava observação privada do atleta', `insert into public.athlete_notes(athlete_id,professor_id,notes) values ('${AT1}','${P1}','Cuidado com o joelho')`);
await as(A1);
await expectRows('A1 NÃO lê observações do professor', `select 1 from public.athlete_notes`, 0);
await expectError('A1 não grava observações', `insert into public.athlete_notes(athlete_id,professor_id,notes) values ('${AT1}','${A1}','x')`);

console.log('\nAnônimo');
await as(null);
await expectError('anon não lê athletes', `select * from public.athletes`);

console.log('\nTAF');
await as(P1);
await db.exec(`insert into public.taf_exams(id,professor_id,name) values ('00000000-0000-0000-0000-0000000000d1','${P1}','Concurso X')`);
await db.exec(`insert into public.taf_tests(id,exam_id,professor_id,name,kind,better,min_value) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1','${P1}','2400 m','tempo','menor',720)`);
await db.exec(`insert into public.taf_enrollments(exam_id,athlete_id,professor_id) values ('00000000-0000-0000-0000-0000000000d1','${AT1}','${P1}')`);
await as(A1);
await expectRows('A1 (inscrito) vê o concurso', `select 1 from public.taf_exams`, 1);
await expectRows('A1 vê os testes do concurso', `select 1 from public.taf_tests`, 1);
await as(A2);
await expectRows('A2 (não inscrito) não vê o concurso', `select 1 from public.taf_exams`, 0);
await expectRows('A2 não vê os testes', `select 1 from public.taf_tests`, 0);
await as(P2);
await expectError('P2 não cria teste em concurso do P1',
  `insert into public.taf_tests(exam_id,professor_id,name,kind,better) values ('00000000-0000-0000-0000-0000000000d1','${P2}','t','tempo','menor')`);

console.log('\nPlanilhas e funções');
await as(P1);
await db.exec(`insert into public.sheets(id,professor_id,name,kind) values ('00000000-0000-0000-0000-0000000000f1','${P1}','Base semanal','semanal')`);
await db.exec(`insert into public.sheet_items(sheet_id,professor_id,day_offset,name) values
  ('00000000-0000-0000-0000-0000000000f1','${P1}',0,'Seg'), ('00000000-0000-0000-0000-0000000000f1','${P1}',2,'Qua'), ('00000000-0000-0000-0000-0000000000f1','${P1}',5,'Sáb')`);
const r1 = await db.query(`select public.assign_sheet('00000000-0000-0000-0000-0000000000f1', array['${AT1}','${AT2}']::uuid[], date '2026-12-01') as n`);
r1.rows[0].n === 6 ? ok('assign_sheet criou 6 treinos (3 x 2 atletas)') : fail('assign_sheet', JSON.stringify(r1.rows));
await expectRows('notificações enviadas aos 2 atletas', `select 1 from public.messages where kind='notificacao'`, 2);
await expectError('assign_sheet recusa atleta de outro professor',
  `select public.assign_sheet('00000000-0000-0000-0000-0000000000f1', array['${AT3}']::uuid[], current_date)`);
const r2 = await db.query(`select public.copy_week('${AT1}', date '2026-12-01', date '2026-12-08') as n`);
r2.rows[0].n === 3 ? ok('copy_week copiou 3 treinos') : fail('copy_week', JSON.stringify(r2.rows));
await as(P2);
await expectError('P2 não atribui planilha do P1',
  `select public.assign_sheet('00000000-0000-0000-0000-0000000000f1', array['${AT3}']::uuid[], current_date)`);

console.log('\nMensagens');
await as(A1);
await expectOk('A1 envia comentário ao professor',
  `insert into public.messages(athlete_id,professor_id,sender_id,kind,body) values ('${AT1}','${P1}','${A1}','comentario','Treino difícil hoje')`);
await expectError('A1 não envia como "orientacao"',
  `insert into public.messages(athlete_id,professor_id,sender_id,kind,body) values ('${AT1}','${P1}','${A1}','orientacao','x')`);
await expectError('A1 não altera texto de mensagem',
  `update public.messages set body='alterado' where kind='notificacao'`);
await expectOk('A1 marca mensagem como lida', `update public.messages set read_at=now() where kind='notificacao'`);

console.log('\nPlanos de treino importados');
await as(P1);
await expectOk('P1 salva plano para seu atleta',
  `insert into public.training_plans(professor_id,athlete_id,title,data) values ('${P1}','${AT1}','Plano X','{"version":1}')`);
await expectError('P1 não salva plano para atleta do P2',
  `insert into public.training_plans(professor_id,athlete_id,title,data) values ('${P1}','${AT3}','Plano Y','{"version":1}')`);
await as(A1);
await expectRows('A1 lê o próprio plano', `select 1 from public.training_plans`, 1);
await expectError('A1 não cria plano', `insert into public.training_plans(professor_id,athlete_id,title,data) values ('${P1}','${AT1}','hack','{}')`);
await expectRows('A1 não altera plano (0 linhas)', `update public.training_plans set title='hack' returning 1`, 0);
await expectRows('A1 não apaga plano (0 linhas)', `delete from public.training_plans returning 1`, 0);
await as(A2);
await expectRows('A2 não vê plano do A1', `select 1 from public.training_plans`, 0);
await as(P2);
await expectRows('P2 não vê plano do P1', `select 1 from public.training_plans`, 0);

console.log('\nAtleta inativo, exclusão de conta e push');
await as(A1);
await expectOk('A1 (ativo) cria assinatura push própria',
  `insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values ('${A1}','https://push.example/1','k','a')`);
await expectError('A1 não cria assinatura para outro usuário',
  `insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values ('${A2}','https://push.example/2','k','a')`);
await as(A2);
await expectRows('A2 não vê a assinatura do A1', `select 1 from public.push_subscriptions`, 0);
await as(P1);
await expectOk('P1 marca atleta A1 como inativo', `update public.athletes set status='inativo' where id='${AT1}'`);
await as(A1);
await expectRows('A1 inativo não vê treinos', `select 1 from public.workouts`, 0);
await expectRows('A1 inativo não vê planos', `select 1 from public.training_plans`, 0);
await expectRows('A1 inativo ainda vê o próprio cadastro (para mostrar aviso)', `select 1 from public.athletes`, 1);
await as(P1);
await expectOk('P1 reativa A1', `update public.athletes set status='ativo' where id='${AT1}'`);
await as(P2);
await expectError('P2 não exclui atleta do P1', `select public.delete_athlete_account('${AT1}')`);
await as(A1);
await expectError('Atleta não chama exclusão de conta', `select public.delete_athlete_account('${AT1}')`);
await as(P1);
await expectOk('P1 exclui atleta A1 (dados + login)', `select public.delete_athlete_account('${AT1}')`);
await db.exec('reset role');
await expectRows('usuário de login do A1 foi removido', `select 1 from auth.users where id='${A1}'`, 0);
await expectRows('atleta A1 foi removido', `select 1 from public.athletes where id='${AT1}'`, 0);
await expectRows('assinaturas push do A1 removidas junto', `select 1 from public.push_subscriptions where user_id='${A1}'`, 0);
await expectRows('conta do professor P1 permanece', `select 1 from auth.users where id='${P1}'`, 1);

await db.exec('reset role');
console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
