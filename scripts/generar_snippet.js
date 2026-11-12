// Genera workflows/code/preparar_peticion_ia.js a partir de prompts/clasificador.txt
// Uso: node scripts/generar_snippet.js
// Así el prompt vive en un solo sitio (el .txt) y el código que se pega en n8n siempre coincide.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const prompt = fs.readFileSync(path.join(raiz, 'prompts', 'clasificador.txt'), 'utf8').trim();
const esc = prompt.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const js = `// GENERADO a partir de prompts/clasificador.txt con scripts/generar_snippet.js. No edites el prompt aquí.
// Nodo Code "Preparar petición IA" · Mode: Run Once for Each Item

const SYSTEM_PROMPT = \`${esc}\`;

const inc = $json; // la incidencia que llega de "Normalizar incidencia"

// La incidencia va en un campo aparte del prompt de sistema y entre <<< >>>,
// para que el modelo la trate como un DATO y no como instrucciones.
// Quitamos ">>>" del texto del usuario para que no pueda "cerrar" el bloque por su cuenta.
const descripcion = String(inc.descripcion ?? '').replaceAll('>>>', '>');

const prompt = [
  \`Departamento del usuario: \${inc.departamento}\`,
  \`Bloqueante (le impide trabajar): \${inc.bloqueante}\`,
  'Incidencia:',
  '<<<',
  descripcion,
  '>>>',
].join('\\n');

return {
  json: {
    ...inc,                      // conservamos los datos de la incidencia
    peticion_ia: {
      model: 'llama3.2:3b',
      stream: false,             // respuesta completa de una vez, no a trozos
      format: 'json',            // obliga a Ollama a devolver JSON válido
      options: { temperature: 0 }, // sin aleatoriedad: misma incidencia -> misma clasificación
      system: SYSTEM_PROMPT,
      prompt,
    },
  },
};
`;
fs.writeFileSync(path.join(raiz, 'workflows', 'code', 'preparar_peticion_ia.js'), js, 'utf8');
console.log('Generado workflows/code/preparar_peticion_ia.js');
