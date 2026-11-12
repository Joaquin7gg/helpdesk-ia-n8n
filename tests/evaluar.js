// Evaluación del clasificador: pasa tests/incidencias.csv por el MISMO código que usa n8n
// (workflows/code/preparar_peticion_ia.js y validar_clasificacion.js) y mide los aciertos.
//
// Uso:  node tests/evaluar.js v1                                   (set principal: tests/incidencias.csv)
//       node tests/evaluar.js v5-validacion tests/validacion.csv   (otro set de casos)
// Variable opcional: OLLAMA_URL (por defecto http://localhost:11434)
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const version = process.argv[2] || 'sin-version';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// --- Cargar el código de los nodos de n8n como funciones ---
const leer = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const preparar = new Function('$json', leer('workflows/code/preparar_peticion_ia.js'));
const validar = new Function('$json', '$', leer('workflows/code/validar_clasificacion.js'));

// Aviso si el código pegado en n8n no está generado desde el prompt actual
const promptTxt = leer('prompts/clasificador.txt').trim();
const generado = preparar({ departamento: '', bloqueante: false, descripcion: '' }).json.peticion_ia.system;
if (generado !== promptTxt) {
  console.error('AVISO: preparar_peticion_ia.js no coincide con prompts/clasificador.txt. Ejecuta: node scripts/generar_snippet.js');
  process.exit(1);
}

// --- Leer el CSV (admite comas y comillas dentro de los campos) ---
function parseCSV(texto) {
  const filas = []; let fila = []; let campo = ''; let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((v) => v !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  const [cabecera, ...datos] = filas;
  return datos.map((f) => Object.fromEntries(cabecera.map((h, i) => [h.trim(), (f[i] ?? '').trim()])));
}

const archivoCasos = process.argv[3] || 'tests/incidencias.csv';
const casos = parseCSV(leer(archivoCasos).replace(/^\uFEFF/, ''));

async function main() {
  console.log(`Evaluando ${casos.length} incidencias de ${archivoCasos} · ${version} · ${OLLAMA_URL}\n`);
  const resultados = [];

  for (const caso of casos) {
    // Igual que el nodo "Normalizar incidencia"
    const incidencia = {
      nombre: 'Persona Ficticia', correo: 'prueba@empresa-ficticia.com',
      departamento: caso.departamento, descripcion: caso.descripcion,
      bloqueante: caso.bloqueante === 'Sí', fecha: new Date().toISOString(), origen: 'evaluacion',
    };
    const preparada = preparar(incidencia).json;

    let ollama;
    try {
      const r = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preparada.peticion_ia),
      });
      ollama = await r.json();
    } catch (e) {
      console.error(`No se pudo llamar a Ollama en ${OLLAMA_URL}: ${e.message}`);
      process.exit(1);
    }

    const salida = validar(ollama, () => ({ item: { json: preparada } })).json;
    const c = salida.clasificacion;
    const okCat = c.categoria === caso.categoria_esperada;
    const okPri = c.prioridad === caso.prioridad_esperada;
    resultados.push({ caso, c, okCat, okPri, salida });

    const marca = (ok) => (ok ? 'OK ' : 'MAL');
    console.log(`#${caso.id.padStart(2)}  cat ${marca(okCat)} ${c.categoria.padEnd(18)} (esperada ${caso.categoria_esperada})`
      + `  ·  pri ${marca(okPri)} ${c.prioridad.padEnd(7)} (esperada ${caso.prioridad_esperada})`
      + `  ·  ${salida.ia.duracion_ms} ms${salida.revisar_a_mano ? '  ·  REVISAR A MANO' : ''}`
      + (salida.motivo_prioridad ? `  ·  motivo: ${salida.motivo_prioridad}` : ''));
  }

  // --- Resumen ---
  const n = resultados.length;
  const cuenta = (f) => resultados.filter(f).length;
  const cat = cuenta((r) => r.okCat), pri = cuenta((r) => r.okPri), ambas = cuenta((r) => r.okCat && r.okPri);
  const revisar = cuenta((r) => r.salida.revisar_a_mano);
  const tiempos = resultados.map((r) => r.salida.ia.duracion_ms);
  const media = Math.round(tiempos.reduce((a, b) => a + b, 0) / n);
  const pct = (x) => `${Math.round((x / n) * 100)} %`;

  console.log(`\nCategoría: ${cat}/${n} (${pct(cat)})  ·  Prioridad: ${pri}/${n} (${pct(pri)})  ·  Ambas: ${ambas}/${n} (${pct(ambas)})`);
  console.log(`JSON no válido / revisar a mano: ${revisar}/${n}  ·  Tiempo medio: ${media} ms`);

  // --- Guardar resultados para el README ---
  const fila = (r) => `| ${r.caso.id} | ${r.caso.descripcion.slice(0, 60).replace(/\|/g, '/')}${r.caso.descripcion.length > 60 ? '…' : ''} `
    + `| ${r.caso.categoria_esperada} | ${r.c.categoria} ${r.okCat ? '✅' : '❌'} `
    + `| ${r.caso.prioridad_esperada} | ${r.c.prioridad} ${r.okPri ? '✅' : '❌'} |`;
  const md = [
    `# Evaluación · prompt ${version}`,
    '',
    `- Fecha: ${new Date().toISOString().slice(0, 10)}`,
    `- Casos: \`${archivoCasos}\``,
    `- Modelo: ${resultados[0]?.salida.ia.modelo} · temperature 0`,
    `- **Categoría: ${cat}/${n} (${pct(cat)})** · **Prioridad: ${pri}/${n} (${pct(pri)})** · **Ambas: ${ambas}/${n} (${pct(ambas)})**`,
    `- Respuestas que no pasaron la validación (revisar a mano): ${revisar}/${n}`,
    `- Tiempo medio por incidencia: ${media} ms`,
    '',
    '| # | Incidencia | Categoría esperada | Categoría IA | Prioridad esperada | Prioridad IA |',
    '|---|---|---|---|---|---|',
    ...resultados.map(fila),
    '',
  ].join('\n');
  const destino = path.join(raiz, 'tests', 'resultados', `resultados_${version}.md`);
  fs.writeFileSync(destino, md, 'utf8');
  fs.writeFileSync(destino.replace(/\.md$/, '.json'), JSON.stringify(resultados.map((r) => ({
    id: r.caso.id, esperado: { categoria: r.caso.categoria_esperada, prioridad: r.caso.prioridad_esperada },
    obtenido: r.c, motivo_prioridad: r.salida.motivo_prioridad, hechos: r.salida.hechos, respuesta_ia: r.salida.ia.respuesta_original, revisar_a_mano: r.salida.revisar_a_mano, ajustes: r.salida.ajustes, duracion_ms: r.salida.ia.duracion_ms,
  })), null, 2), 'utf8');
  console.log(`\nGuardado en tests/resultados/resultados_${version}.md`);
}

main();
