const B = 'http://127.0.0.1:4600/api/v1';
const j = (r) => r.json();
async function login(email, password){
  const r = await fetch(B+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const b = await j(r); return { token: b?.data?.tokens?.accessToken || b?.data?.accessToken, body: b };
}
const op = await login('pfop@example.com','Operator@123');
const H = { Authorization: `Bearer ${op.token}` };
const fmt = (r,label)=>console.log(label, r.status);
const checks = [];
async function call(path,label,expect){
  const r = await fetch(B+path,{headers:H});
  const t = r.status; let ok = expect==='400'? t===400 : (t>=200&&t<300);
  checks.push(`${ok?'OK':'FAIL'}  ${label}  -> ${t}` + (expect?` (expect ${expect})`:''));
  return r;
}
await call('/finance/payables?from=2026-01-01&to=2026-08-31&page=1&limit=5','payables period','200');
await call('/finance/payables?from=2026-01-01&to=2026-01-31','payables earnedAt window');
await call('/finance/settlements?from=2026-01-01&to=2026-08-31&page=1&limit=5','settlements period');
await call('/delivery/payouts/all?from=2026-01-01&to=2026-08-31&page=1&limit=5','courier payouts all period');
await call('/delivery/payouts/summary?from=2026-01-01&to=2026-08-31','courier summary period');
await call('/finance/report/totals?from=2026-01-01&to=2026-08-31','report totals period');
await call('/finance/payables?from=notadate','payables bad from','400');
await call('/finance/settlements?to=zzz','settlements bad to','400');
await call('/delivery/payouts/all?to=bad','courier bad to','400');
console.log(checks.join('\n'));
const fail = checks.filter(c=>c.startsWith('FAIL'));
console.log(fail.length? `\n${fail.length} FAILURES` : '\nALL OK');
