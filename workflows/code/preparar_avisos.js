// Nodo Code "Preparar avisos" · Mode: Run Once for Each Item
// Va después de "Crear ticket en Odoo" (que solo devuelve { id }). Redacta en un único sitio:
//   - el aviso de Telegram para el técnico,
//   - el mensaje de la pantalla final del formulario para el usuario,
//   - el correo de confirmación para el usuario.

const ODOO_URL = 'https://TU-BASE.odoo.com'; // ← CONFIGURA: la dirección de tu Odoo
const TEAM_ID = 2; // ← CONFIGURA: id del equipo de Helpdesk (lo muestra scripts/probar_odoo.js)

const i = $('Preparar ticket Odoo').item.json; // incidencia + clasificación
const c = i.clasificacion;
const id = $json.id;
// Referencia visible en Odoo (#00001). Coincide con el id mientras no se reinicie la secuencia de tickets.
const ref = String(id).padStart(5, '0');
const enlace = `${ODOO_URL}/odoo/helpdesk/${TEAM_ID}/tickets/${id}`;

// Telegram y el correo usan HTML: escapamos todo lo que venga del usuario o de la IA
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ICONO = { urgente: '🔴', alta: '🟠', media: '🟡', baja: '🟢' };

const telegram = [
  `🎫 <b>Nuevo ticket #${ref}</b> · <a href="${enlace}">abrir en Odoo</a>`,
  i.revisar_a_mano ? '⚠️ <b>REVISAR A MANO:</b> la respuesta de la IA no pasó la validación' : '',
  `${ICONO[c.prioridad] ?? '⚪'} <b>Prioridad:</b> ${esc(c.prioridad)} · ${esc(i.motivo_prioridad)}`,
  `🗂 <b>Categoría:</b> ${esc(c.categoria)}`,
  `${c.escalar ? '⬆️ <b>Escalar a nivel 2: SÍ</b>' : '✅ Escalar a nivel 2: no'}`,
  `👤 ${esc(i.nombre)} · ${esc(i.departamento)}${i.bloqueante ? ' · no puede trabajar' : ''}`,
  `📝 ${esc(c.resumen)}`,
].filter(Boolean).join('\n');

// Pantalla final del formulario (texto plano)
const pantalla = `Hemos recibido tu incidencia. Tu número de ticket es el ${ref}.\n\nMientras la revisamos, puedes probar esto:\n${c.respuesta_sugerida}`;

// Correo al usuario
const asunto = `[Ticket #${ref}] Hemos recibido tu incidencia`;
const correo = [
  `<p>Hola, ${esc(i.nombre)}:</p>`,
  `<p>Hemos recibido tu incidencia y hemos abierto el <b>ticket #${ref}</b>. El equipo de Soporte IT ya la tiene.</p>`,
  `<p><b>Lo que nos has contado:</b><br>${esc(i.descripcion).replace(/\r?\n/g, '<br>')}</p>`,
  `<p><b>Mientras tanto, puedes probar esto:</b><br>${esc(c.respuesta_sugerida).replace(/\r?\n/g, '<br>')}</p>`,
  c.categoria === 'Seguridad' ? '<p><b>Importante:</b> no borres el correo o el archivo sospechoso y no hagas clic en nada más hasta que te escribamos.</p>' : '',
  '<p>Si necesitas añadir algo, responde a este correo indicando el número de ticket.</p>',
  '<p>Un saludo,<br>Soporte IT</p>',
].filter(Boolean).join('\n');

return {
  json: {
    ...i,
    ticket: { id, ref, enlace },
    avisos: { telegram, pantalla, correo_asunto: asunto, correo_html: correo },
  },
};
