// Nodo Code "Validar clasificación" · Mode: Run Once for Each Item
// La IA PROPONE; este código COMPRUEBA y aplica las reglas que no pueden fallar.

const CATEGORIAS = ['Cuentas y accesos', 'Correo', 'Hardware', 'Software', 'Red y conexión', 'Seguridad', 'Otros'];
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];

// Compara sin tildes ni mayúsculas: "red y conexion" vale como "Red y conexión"
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const buscar = (valor, lista) => lista.find((op) => normalizar(op) === normalizar(valor));

const errores = [];  // la respuesta de la IA no cumple el formato -> revisar a mano
const ajustes = [];  // el formato es correcto, pero corregimos algo por una regla de negocio

// 1) Convertir el texto de la IA en un objeto
let ia = {};
let jsonOk = true;
try {
  ia = JSON.parse($json.response);
} catch (e) {
  jsonOk = false;
  errores.push('La IA no devolvió JSON válido');
}
// Solo apuntamos errores de campo si el JSON se pudo leer (si no, ya sabemos por qué falla todo)
const error = (msg) => { if (jsonOk) errores.push(msg); };

// 2) Comprobar cada campo contra los valores permitidos
const categoria = buscar(ia.categoria, CATEGORIAS);
if (!categoria) error(`Categoría no válida: ${ia.categoria}`);

let prioridad = buscar(ia.prioridad, PRIORIDADES);
if (!prioridad) error(`Prioridad no válida: ${ia.prioridad}`);

const resumen = typeof ia.resumen === 'string' ? ia.resumen.trim() : '';
if (!resumen) error('Falta el resumen');

const respuesta = typeof ia.respuesta_sugerida === 'string' ? ia.respuesta_sugerida.trim() : '';
if (!respuesta) error('Falta la respuesta sugerida');

let escalar = ia.escalar;
if (typeof escalar === 'string') escalar = normalizar(escalar) === 'true';
if (typeof escalar !== 'boolean') error(`"escalar" no es true/false: ${ia.escalar}`);

// 3) Recuperar la incidencia original (el nodo HTTP solo devuelve la respuesta de Ollama)
const { peticion_ia, ...incidencia } = $('Preparar petición IA').item.json;

// 4) Reglas de negocio que se cumplen SIEMPRE, diga lo que diga la IA
if (incidencia.bloqueante && prioridad === 'baja') {
  prioridad = 'media';
  ajustes.push('Bloqueante: prioridad baja subida a media');
}
const debeEscalar = categoria === 'Seguridad' || categoria === 'Otros' || prioridad === 'urgente';
if (debeEscalar && escalar !== true) {
  escalar = true;
  ajustes.push('Escalado forzado por categoría o prioridad');
}

// 5) Si algo falla: valores seguros y revisión humana.
//    Si la IA dio una prioridad válida no la bajamos; si no, "media".
const revisar = errores.length > 0;

return {
  json: {
    ...incidencia,
    clasificacion: {
      categoria: categoria ?? 'Otros',
      prioridad: prioridad ?? 'media',
      resumen: resumen || String(incidencia.descripcion).slice(0, 80),
      respuesta_sugerida: respuesta || 'Hemos recibido tu incidencia. Un técnico la revisará y te contactará.',
      escalar: revisar ? true : escalar,
    },
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
