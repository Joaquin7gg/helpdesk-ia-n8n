// Comprueba la conexión con la API externa de Odoo y muestra los campos reales de helpdesk.ticket.
// Uso (PowerShell, desde la carpeta del proyecto):
//   docker run --rm -v "${PWD}:/app" -w /app --env-file .env node:22-alpine node scripts/probar_odoo.js
// Lee la configuración de .env (que NO se sube a Git). Nunca imprime la clave API.

const { ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY } = process.env;
for (const [k, v] of Object.entries({ ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY })) {
  if (!v) { console.error(`Falta ${k} en el archivo .env`); process.exit(1); }
}
const base = ODOO_URL.replace(/\/+$/, '');

// Llamada JSON-RPC a Odoo: es el mismo tipo de API que usa el nodo Odoo de n8n
async function rpc(service, method, args) {
  const r = await fetch(`${base}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Date.now(), params: { service, method, args } }),
  });
  const texto = await r.text();
  let d;
  try { d = JSON.parse(texto); } catch { throw new Error(`Respuesta no JSON (HTTP ${r.status}): ${texto.slice(0, 200)}`); }
  if (d.error) throw new Error(d.error.data?.message || d.error.message || JSON.stringify(d.error));
  return d.result;
}

async function main() {
  console.log(`1) Servidor: ${base}`);
  const v = await rpc('common', 'version', []);
  console.log(`   Odoo ${v.server_version}`);

  console.log(`2) Autenticación en la base "${ODOO_DB}" como ${ODOO_USER}`);
  const uid = await rpc('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}]);
  if (!uid) { console.error('   FALLO: usuario, base de datos o clave API incorrectos.'); process.exit(1); }
  console.log(`   OK, uid = ${uid}`);

  const kw = (model, method, args, kwargs = {}) => rpc('object', 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs]);

  console.log('3) Equipos de Helpdesk (helpdesk.team)');
  const equipos = await kw('helpdesk.team', 'search_read', [[]], { fields: ['id', 'name'] });
  for (const e of equipos) console.log(`   id ${e.id}: ${e.name}`);

  console.log('4) Campos de helpdesk.ticket que nos interesan (fields_get)');
  const campos = await kw('helpdesk.ticket', 'fields_get', [], { attributes: ['string', 'type', 'required', 'selection', 'relation'] });
  for (const c of ['name', 'description', 'priority', 'team_id', 'partner_name', 'partner_email', 'partner_id', 'stage_id', 'tag_ids', 'ticket_type_id']) {
    const f = campos[c];
    if (!f) { console.log(`   ${c}: NO EXISTE`); continue; }
    const extra = f.selection ? ` · valores: ${f.selection.map(([k, l]) => `${k}=${l}`).join(', ')}` : f.relation ? ` · relación: ${f.relation}` : '';
    console.log(`   ${c}: ${f.type}${f.required ? ' (obligatorio)' : ''} · "${f.string}"${extra}`);
  }
  console.log('\nLa API funciona.');
}

main().catch((e) => { console.error(`\nERROR: ${e.message}`); process.exit(1); });
