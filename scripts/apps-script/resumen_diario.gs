/**
 * Resumen diario de tickets · Google Apps Script
 * Va DENTRO de la hoja "Helpdesk IA · Registro de tickets" (Extensiones → Apps Script).
 * Cada mañana envía por correo los tickets creados en las últimas 24 h, agrupados por prioridad.
 *
 * @OnlyCurrentDoc  ← mínimo privilegio: el script solo puede abrir ESTA hoja, no todo tu Drive.
 */

const CONFIG = {
  HOJA: 'Tickets',        // pestaña donde n8n añade las filas
  HORAS: 24,              // ventana del resumen
  HORA_ENVIO: 8,          // hora del activador diario (Europe/Madrid)
};

const ORDEN = ['urgente', 'alta', 'media', 'baja'];
const ICONO = { urgente: '🔴', alta: '🟠', media: '🟡', baja: '🟢' };

/** Función principal: la ejecuta el activador cada día. */
function enviarResumenDiario() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName(CONFIG.HOJA);
  if (!hoja) throw new Error(`No existe la pestaña "${CONFIG.HOJA}"`);

  const [cabecera, ...filas] = hoja.getDataRange().getValues();
  const col = (nombre) => {
    const i = cabecera.indexOf(nombre);
    if (i === -1) throw new Error(`Falta la columna "${nombre}" en la fila 1`);
    return i;
  };
  const C = {
    fecha: col('Fecha'), ticket: col('Ticket'), categoria: col('Categoría'), prioridad: col('Prioridad'),
    escalar: col('Escalar'), departamento: col('Departamento'), resumen: col('Resumen'), enlace: col('Enlace'),
  };

  const desde = new Date(Date.now() - CONFIG.HORAS * 3600 * 1000);
  const tickets = filas
    .filter((f) => f[C.fecha] !== '' && new Date(f[C.fecha]) >= desde)
    .map((f) => ({
      fecha: new Date(f[C.fecha]),
      ticket: String(f[C.ticket]),
      categoria: String(f[C.categoria]),
      prioridad: String(f[C.prioridad]).toLowerCase(),
      escalar: f[C.escalar] === true || String(f[C.escalar]).toLowerCase() === 'sí' || String(f[C.escalar]).toLowerCase() === 'true',
      departamento: String(f[C.departamento]),
      resumen: String(f[C.resumen]),
      enlace: String(f[C.enlace]),
    }))
    .sort((a, b) => ORDEN.indexOf(a.prioridad) - ORDEN.indexOf(b.prioridad) || a.fecha - b.fecha);

  const destinatario = Session.getEffectiveUser().getEmail();
  const hoy = Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM/yyyy');
  const { asunto, html } = construirCorreo(tickets, hoy, libro.getUrl());
  MailApp.sendEmail({ to: destinatario, subject: asunto, htmlBody: html, name: 'Helpdesk IA' });
  console.log(`Resumen enviado a ${destinatario}: ${tickets.length} tickets`);
}

/** Construye el asunto y el HTML del correo (separado para poder probarlo). */
function construirCorreo(tickets, hoy, urlHoja) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cuenta = Object.fromEntries(ORDEN.map((p) => [p, tickets.filter((t) => t.prioridad === p).length]));
  const escalados = tickets.filter((t) => t.escalar).length;

  const asunto = tickets.length
    ? `Helpdesk · ${hoy} · ${tickets.length} tickets nuevos (${cuenta.urgente} urgentes, ${escalados} para escalar)`
    : `Helpdesk · ${hoy} · sin tickets nuevos`;

  if (!tickets.length) {
    return { asunto, html: `<p>No se ha creado ningún ticket en las últimas ${CONFIG.HORAS} h.</p><p><a href="${urlHoja}">Abrir el registro</a></p>` };
  }

  const resumen = ORDEN.map((p) => `${ICONO[p]} <b>${p}</b>: ${cuenta[p]}`).join(' &nbsp;·&nbsp; ');
  const filas = tickets.map((t) => `
    <tr>
      <td>${ICONO[t.prioridad] ?? '⚪'} ${esc(t.prioridad)}</td>
      <td><a href="${esc(t.enlace)}">#${esc(t.ticket)}</a></td>
      <td>${esc(t.categoria)}</td>
      <td>${esc(t.departamento)}</td>
      <td>${esc(t.resumen)}</td>
      <td>${t.escalar ? '⬆️ Sí' : 'No'}</td>
    </tr>`).join('');

  const html = `
    <p>Tickets creados en las últimas ${CONFIG.HORAS} h:</p>
    <p>${resumen} &nbsp;·&nbsp; ⬆️ <b>para escalar</b>: ${escalados}</p>
    <table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd;font-family:sans-serif;font-size:14px">
      <tr style="background:#f3f3f3"><th>Prioridad</th><th>Ticket</th><th>Categoría</th><th>Departamento</th><th>Resumen</th><th>Escalar</th></tr>
      ${filas}
    </table>
    <p style="color:#777;font-size:12px">El estado actualizado de cada ticket está en Odoo Helpdesk. <a href="${urlHoja}">Abrir el registro</a>.</p>`;
  return { asunto, html };
}

/** Ejecútala UNA vez a mano: crea el activador diario (y borra los anteriores para no duplicarlo). */
function crearActivadorDiario() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'enviarResumenDiario')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('enviarResumenDiario')
    .timeBased().everyDays(1).atHour(CONFIG.HORA_ENVIO).inTimezone('Europe/Madrid')
    .create();
  console.log(`Activador creado: cada día a las ${CONFIG.HORA_ENVIO}:00 (Europe/Madrid)`);
}
