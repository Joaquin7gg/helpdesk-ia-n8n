// Nodo Code "Validar clasificación" · Mode: Run Once for Each Item  (v5: hechos de la IA + reglas de seguridad + plantillas)
// La IA EXTRAE HECHOS y elige la categoría; este código VALIDA y DECIDE la prioridad y el escalado
// con reglas fijas. Así la prioridad es predecible, explicable y el texto no puede "pedirla".

const CATEGORIAS = ['Cuentas y accesos', 'Correo', 'Hardware', 'Software', 'Red y conexión', 'Seguridad', 'Otros'];
const ALCANCES = ['persona', 'grupo', 'empresa'];
const HECHOS_SI_NO = ['seguridad', 'interaccion', 'alternativa', 'peticion', 'sin_prisa', 'vaga'];

// Compara sin tildes ni mayúsculas: "red y conexion" vale como "Red y conexión"
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const buscar = (valor, lista) => lista.find((op) => normalizar(op) === normalizar(valor));
const aBooleano = (v) => (typeof v === 'boolean' ? v : ['true', 'false'].includes(normalizar(v)) ? normalizar(v) === 'true' : undefined);

const errores = [];  // la respuesta de la IA no cumple el formato -> revisar a mano
const ajustes = [];  // correcciones que hace el código sobre lo que propuso la IA

// 1) Convertir el texto de la IA en un objeto
let ia = {};
let jsonOk = true;
try {
  ia = JSON.parse($json.response);
} catch (e) {
  jsonOk = false;
  errores.push('La IA no devolvió JSON válido');
}
const error = (msg) => { if (jsonOk) errores.push(msg); };

// 2) Validar los hechos y los textos
const hechos = {};
for (const clave of HECHOS_SI_NO) {
  hechos[clave] = aBooleano(ia[clave]);
  if (hechos[clave] === undefined) error(`"${clave}" no es true/false: ${ia[clave]}`);
}
hechos.alcance = buscar(ia.alcance, ALCANCES);
if (!hechos.alcance) error(`Alcance no válido: ${ia.alcance}`);

let categoria = buscar(ia.categoria, CATEGORIAS);
if (!categoria) error(`Categoría no válida: ${ia.categoria}`);

const resumen = typeof ia.resumen === 'string' ? ia.resumen.trim() : '';
if (!resumen) error('Falta el resumen');
const respuesta = typeof ia.respuesta_sugerida === 'string' ? ia.respuesta_sugerida.trim() : '';
if (!respuesta) error('Falta la respuesta sugerida');

// 3) Recuperar la incidencia original (el nodo HTTP solo devuelve la respuesta de Ollama)
const { peticion_ia, ...incidencia } = $('Preparar petición IA').item.json;
const bloqueante = incidencia.bloqueante === true;

// 3b) Reglas de detección de seguridad sobre el TEXTO ORIGINAL (defensa en profundidad).
//     El modelo puede no ver un incidente; estas reglas no dependen de él. Ante la duda, seguridad.
const texto = normalizar(incidencia.descripcion);
const REGLAS_SEGURIDAD = [
  ['ejecutable', /\.(exe|scr|vbs|bat|cmd|msi|js|jar|ps1)\b/],
  ['phishing / fraude', /phishing|suplant|sospechos|fraude|estafa|falso|falsa/],
  ['malware', /malware|virus|ransom|troyano|hackead|hackeo|cifrad|otra extension/],
  ['piden credenciales', /(pide|piden|pedia|solicita|solicitan)\w* (que )?(confirmar |verificar |actualizar |introducir |poner )?(mis |mi |tus |tu |los |la |el |sus |su )?(contrasena|credenciales|datos|usuario|clave|pin)/],
  ['urgencia típica de phishing', /caduca hoy|verificar (tu|su) cuenta|(cuenta|buzon) (sera|va a ser|quedara) (bloquead|suspendid|eliminad)/],
  ['dispositivo perdido o robado', /(he perdido|perdi|me han robado|robaron|extravi)\w* (el |la |mi |un |una )?(movil|telefono|portatil|ordenador|tablet|pendrive|usb)/],
  ['USB desconocido', /usb (que )?(me )?(encontr|desconocid|del parking|de la calle)/],
  ['acceso no reconocido', /(acceso|inicio de sesion|login|conexion)\w* (que no reconozco|desconocid|raro|extran)/],
];
const REGLAS_INTERACCION = /(he |ya )?(pinchado|pinche|hecho clic|hice clic|clicado|abierto|abri|ejecutado|ejecute|descargado|descargue|instalado|instale|conectado|conecte|puesto mi|puse mi|metido mi|meti mi|introducido|introduje)/g;
// "no he abierto el enlace" NO es interacción: descartamos coincidencias con un "no" justo delante
const hayInteraccion = [...texto.matchAll(REGLAS_INTERACCION)]
  .some((m) => !/\bno (lo |la |le |he |ha )?$/.test(texto.slice(Math.max(0, m.index - 7), m.index)));
const reglasActivadas = REGLAS_SEGURIDAD.filter(([, re]) => re.test(texto)).map(([nombre]) => nombre);
if (reglasActivadas.length) {
  if (hechos.seguridad !== true) ajustes.push(`Seguridad detectada por reglas (${reglasActivadas.join(', ')}); la IA no la marcó`);
  hechos.seguridad = true;
  if (hayInteraccion && hechos.interaccion !== true) {
    hechos.interaccion = true;
    ajustes.push('Interacción del usuario detectada por reglas');
  }
}

// 4) Coherencia de la categoría con los hechos.
//    Ante la duda, seguridad: es mejor un falso positivo que un phishing sin atender.
const esSeguridad = hechos.seguridad === true || categoria === 'Seguridad';
if (esSeguridad && categoria !== 'Seguridad') {
  ajustes.push(`Categoría "${categoria}" cambiada a Seguridad (hecho seguridad = true)`);
  categoria = 'Seguridad';
}
if (hechos.vaga === true && categoria !== 'Otros' && !esSeguridad) {
  ajustes.push(`Categoría "${categoria}" cambiada a Otros (descripción vaga)`);
  categoria = 'Otros';
}

// 5) Prioridad: la primera regla que se cumple gana
function calcularPrioridad() {
  if (hechos.alcance === 'grupo') return ['urgente', 'Afecta a un departamento o grupo de personas'];
  if (hechos.alcance === 'empresa') return ['urgente', 'Afecta a toda la empresa'];
  if (esSeguridad && hechos.interaccion) return ['urgente', 'Seguridad con interacción del usuario'];
  if (esSeguridad) return ['alta', 'Posible incidente de seguridad'];
  if (hechos.vaga) return ['media', 'Descripción vaga'];
  if (bloqueante && !hechos.alternativa) return ['alta', 'No puede trabajar y no tiene alternativa'];
  if ((hechos.peticion || hechos.sin_prisa) && !bloqueante) return ['baja', 'Petición o consulta sin urgencia'];
  return ['media', 'Problema de un usuario con alternativa o que no le bloquea'];
}

// 6) Si la respuesta no es válida: valores seguros y revisión humana
const revisar = errores.length > 0;
const [prioridad, motivo] = revisar
  ? (esSeguridad ? ['alta', 'Respuesta de la IA no válida y posible seguridad'] : ['media', 'Respuesta de la IA no válida'])
  : calcularPrioridad();
if (!categoria) categoria = 'Otros';

const escalar = revisar || categoria === 'Seguridad' || categoria === 'Otros' || prioridad === 'urgente';

// 7) En seguridad, la respuesta al usuario NO la escribe la IA: usamos un texto fijo revisado por una persona.
//    Una mala instrucción aquí (p. ej. "no hagas clic" a quien ya metió su contraseña) tiene consecuencias reales.
const RESPUESTA_SEGURIDAD = {
  conInteraccion: 'Cambia ahora la contraseña de tu cuenta del trabajo desde otro dispositivo de confianza (por ejemplo, tu móvil), no desde este ordenador. Si has abierto o ejecutado un archivo, desconecta este equipo de la red (cable o wifi) pero no lo apagues. No borres el correo ni el archivo: son la prueba. IT se pondrá en contacto contigo enseguida.',
  sinInteraccion: 'No hagas clic en enlaces ni abras adjuntos del mensaje sospechoso, y no respondas al remitente. No lo borres: es la prueba. Si has perdido un dispositivo de la empresa, no hace falta que hagas nada más: IT lo bloqueará. Espera instrucciones de IT.',
};
let respuestaFinal = respuesta;
if (categoria === 'Seguridad') {
  respuestaFinal = hechos.interaccion ? RESPUESTA_SEGURIDAD.conInteraccion : RESPUESTA_SEGURIDAD.sinInteraccion;
  ajustes.push('Respuesta al usuario sustituida por la plantilla fija de seguridad');
}

return {
  json: {
    ...incidencia,
    clasificacion: {
      categoria,
      prioridad,
      resumen: resumen || String(incidencia.descripcion).slice(0, 80),
      respuesta_sugerida: respuestaFinal || 'Hemos recibido tu incidencia. Un técnico la revisará y te contactará.',
      escalar,
    },
    motivo_prioridad: motivo,
    hechos,
    revisar_a_mano: revisar,
    errores_validacion: errores,
    ajustes,
    ia: {
      modelo: $json.model,
      duracion_ms: Math.round(($json.total_duration ?? 0) / 1e6),
      respuesta_original: $json.response,
    },
  },
};
