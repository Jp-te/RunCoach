// Gera o par de chaves VAPID para notificações push (usa só o Node, sem instalar nada).
//   node scripts/generate-vapid.mjs
// A chave PÚBLICA vai no app (VITE_VAPID_PUBLIC_KEY). A PRIVADA vai somente nos "secrets"
// da Edge Function do Supabase — nunca no frontend nem no GitHub.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const b64 = (s) => s; // JWK já usa base64url
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);
console.log('VAPID_PUBLIC_KEY  (frontend / VITE_VAPID_PUBLIC_KEY):');
console.log(raw.toString('base64url'));
console.log('\nVAPID_PRIVATE_KEY (SECRETO — só nos secrets da Edge Function):');
console.log(b64(priv.d));
