// Nodo Code "Preparar ticket Odoo" · Mode: Run Once for Each Item
// Traduce la incidencia clasificada a los campos reales de helpdesk.ticket (comprobados con fields_get).

const TEAM_ID = 2; // ← CONFIGURA: id del equipo de Helpdesk (lo muestra scripts/probar_odoo.js)

// priority en Odoo: '0' Low · '1' Medium · '2' High · '3' Urgent
const PRIORIDAD_ODOO = { baja: '0', media: '1', alta: '2', urgente: '3' };

// La descripción de Odoo es HTML: escapamos el texto del usuario para que no pueda meter etiquetas
// (por ejemplo <script> o enlaces disfrazados). Nunca se confía en la entrada del usuario.
const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const parrafos = (t) => esc(t).replace(/\r?\n/g, '<br>');

const i = $json;
const c = i.clasificacion;

const aviso = i.revisar_a_mano
  ? `<p><b>⚠️ REVISAR A MANO:</b> la respuesta de la IA no pasó la validación (${esc(i.errores_validacion.join('; '))}). Se han aplicado valores seguros.</p>`
  : '';

const descripcion = [
  aviso,
  '<h3>Incidencia</h3>',
  `<p>${parrafos(i.descripcion)}</p>`,
  `<p><b>Departamento:</b> ${esc(i.departamento)} · <b>Le impide trabajar:</b> ${i.bloqueante ? 'Sí' : 'No'} · <b>Recibida:</b> ${esc(i.fecha)}</p>`,
  '<h3>Clasificación automática (IA local)</h3>',
  '<ul>',
  `<li><b>Categoría:</b> ${esc(c.categoria)}</li>`,
  `<li><b>Prioridad:</b> ${esc(c.prioridad)} — ${esc(i.motivo_prioridad)}</li>`,
  `<li><b>Escalar a nivel 2:</b> ${c.escalar ? 'Sí' : 'No'}</li>`,
  i.ajustes?.length ? `<li><b>Ajustes del validador:</b> ${esc(i.ajustes.join('; '))}</li>` : '',
  '</ul>',
  '<h3>Respuesta sugerida (nivel 1)</h3>',
  `<p>${parrafos(c.respuesta_sugerida)}</p>`,
  `<p><i>Clasificado por ${esc(i.ia?.modelo)} en local (${i.ia?.duracion_ms} ms). Revisa la clasificación antes de cerrar el ticket.</i></p>`,
].filter(Boolean).join('\n');

return {
  json: {
    ...i,
    odoo: {
      name: `[${c.categoria}] ${c.resumen}`,
      description: descripcion,
      priority: PRIORIDAD_ODOO[c.prioridad] ?? '1',
      team_id: TEAM_ID,
      partner_name: i.nombre,
      partner_email: i.correo,
    },
  },
};
