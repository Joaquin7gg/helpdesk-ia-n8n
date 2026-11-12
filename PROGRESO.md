# PROGRESO

## Estado actual
- **Fase actual:** 7 · Documentación y publicación (Fases 0-6 práctica ✅)
- **Qué funciona:** formulario n8n → IA local → validador v5 → ticket en Odoo → Telegram + pantalla final + Gmail + Google Sheets → Apps Script de resumen diario (8:00).
- **Qué falta:** subir el repo público · tarjeta del portfolio · teoría de Workspace y simulación de entrevista.
- **Pendientes de seguridad:** revocar/regenerar clave API de Odoo, token del bot y secreto OAuth (pasaron por el chat) antes de la demo final.
- **Siguiente paso concreto:** crear el repo vacío `helpdesk-ia-n8n` en GitHub y hacer push del commit limpio.

## Entorno
| Componente | Versión / dato |
|---|---|
| Equipo | Portátil Windows, RTX 3050 (4 GB VRAM), 32 GB RAM |
| Docker | 29.4.2 · Compose v5.1.3 |
| WSL | 2 (Ubuntu-22.04) |
| Git | 2.55.0.windows.2 |
| Ollama | 0.40.16 |
| Modelo | llama3.2:3b |
| n8n | 2.47.4 (imagen fijada en `docker-compose.yml`) |

## Registro

### 2026-11-11 · Fase 0
- Comprobado Docker, Compose, Git y WSL2. Instalado Ollama.
- **Decisión:** usar Ollama y no LM Studio (ya instalado en el portátil). Motivo: corre como servicio en segundo plano, soporta `format: "json"` y es lo mismo que el agente SOC, así la evaluación es comparable. LM Studio se cierra mientras se trabaja para no competir por la VRAM de la 3050.
- **Decisión:** el repo vive en la subcarpeta `helpdesk-ia-n8n/`; la guía (`GUIA_HELPDESK_IA.md`) queda fuera del repo.
- `ollama run llama3.2:3b` responde "OK". `ollama ps`: 2,9 GB, **20%/80% CPU/GPU**. `nvidia-smi` confirma que la 3050 tiene 4 GB y que solo la usa Ollama.
- **Limitación conocida:** el modelo no cabe entero en la VRAM; se acepta el reparto CPU/GPU porque para clasificar incidencias unos segundos de más no importan.
- `git init -b main` hecho (sin commits todavía; el primero al cerrar la Fase 1).
- Creado el esqueleto: `docker-compose.yml`, `.env.example`, `.gitignore`, `prompts/`, `tests/`, `workflows/`, `docs/img/`.
- ✅ **Fase 0 completada.**

### 2026-11-11 · Fase 1
- `docker compose up -d` levanta n8n en http://localhost:5678. Cuenta de propietario local creada.
- **Decisión:** fijar la imagen a `n8nio/n8n:2.47.4` (versión comprobada con `docker compose exec n8n n8n --version`) para que el proyecto sea reproducible.
- **Decisión:** desactivado el *n8n Assistant* (IA en la nube de n8n); el proyecto usa solo IA local.
- Flujo de prueba `00 - Prueba`: disparador manual → Edit Fields (Set) con `nombre` e `incidencia`. Ejecuta OK (1 item).
- Persistencia comprobada: tras `docker compose restart` siguen la cuenta y el flujo (volumen `helpdesk-ia-n8n_n8n_data`).
- ✅ **Fase 1 completada.**
- Primer commit: "Fases 0-1: esqueleto del proyecto y n8n 2.47.4 en Docker". Git configurado con el correo *noreply* de GitHub (la cuenta bloquea pushes que expongan el correo personal).

### 2026-11-11 · Fase 2 (opción A: formulario de n8n)
- Flujo principal `01 - Helpdesk IA`. Trigger *n8n Form → On new n8n Form event*: "Nueva incidencia IT" con Nombre (Text), Correo (Email), Departamento (Dropdown: Ventas, Administración, Tecnología, Dirección), Descripción del problema (Textarea), ¿Te impide trabajar? (Radio: Sí/No). Todos obligatorios.
- **Decisión:** campo Correo de tipo *Email* → el propio formulario valida el formato (primera capa de validación).
- **Decisión:** autenticación del formulario en *None* porque n8n solo es accesible en local. Si se expusiera, *Basic Auth*.
- **Decisión:** nodo `Normalizar incidencia` (Edit Fields) justo después del formulario. El formulario solo tiene *Label* (no nombre interno), así que las claves salen como `"¿Te impide trabajar?"`. Se traducen a claves limpias: `nombre`, `correo`, `departamento`, `descripcion`, `bloqueante` (booleano), `fecha`, `origen`. Así el resto del flujo no depende de la fuente: con Google Forms solo cambia este nodo.
- Datos de prueba fijados (*pin*) en el trigger para no rellenar el formulario en cada prueba. **Quitar el pin antes de publicar.**
- ✅ **Fase 2 (opción A) completada.** Opción B (Google Forms) pendiente.

### 2026-11-11 · Fase 3 (clasificación con IA)
- Conectividad n8n → Ollama comprobada desde dentro del contenedor: `fetch('http://host.docker.internal:11434/api/version')` → `{"version":"0.40.16"}`.
- **Decisión de seguridad:** NO hace falta `OLLAMA_HOST=0.0.0.0`; Docker Desktop enruta `host.docker.internal` al anfitrión, así que Ollama sigue escuchando solo en local.
- Prompt v1 en `prompts/clasificador.txt`. Decisiones:
  - Cada categoría con ejemplos concretos (un modelo de 3B necesita pistas).
  - Prompt como `system` e incidencia como `prompt`, delimitada, + regla explícita anti-inyección de prompt.
  - `bloqueante: true` → nunca prioridad baja. Reglas fijas para `escalar`.
  - Nunca pedir contraseñas; ante phishing, no borrar el correo (evidencia).
- **Reglas de prioridad revisadas por Joaquín:** usuario sin alternativa → alta; con alternativa → media. Phishing con clic, credenciales introducidas o archivo ejecutado → **urgente** (credenciales comprometidas se explotan en minutos); phishing solo recibido → alta.
- Flujo en n8n: Formulario → Normalizar incidencia → **Preparar petición IA** (Code) → **Clasificar con Ollama** (HTTP POST `/api/generate`, `format: json`, `temperature: 0`) → **Validar clasificación** (Code).
- **Decisión:** el código de los nodos Code vive en `workflows/code/`. `preparar_peticion_ia.js` se GENERA desde `prompts/clasificador.txt` con `scripts/generar_snippet.js` → el prompt tiene una sola fuente de verdad.
- **Decisión (validación):** "la IA propone, el código valida". Comprueba valores permitidos (sin tildes/mayúsculas), aplica reglas fijas (bloqueante → nunca baja; Seguridad/Otros/urgente → escalar) y, si falla, `revisar_a_mano: true`. **Desviación de la guía:** si la IA dio una prioridad válida no se baja a "media" (no degradar un posible urgente por un fallo de formato).
- **Evaluación:** `tests/incidencias.csv` (20 casos ficticios: 7 categorías, 4 prioridades, casos trampa: phishing con/sin clic, caídas de departamento, incidencias vagas, inyección de prompt). `tests/evaluar.js` usa EL MISMO código que los nodos de n8n. Se ejecuta con `docker run ... node:22-alpine node tests/evaluar.js <versión>`.

#### Prompt v1 → Categoría 13/20 (65 %) · Prioridad 7/20 (35 %) · Ambas 4/20 (20 %) · 2,5 s/incidencia · 1 revisar a mano
- Prioridad inflada: 8 "urgente" de más, nunca "baja"; problemas de una sola persona como urgentes.
- Categoría por canal y no por problema: Seguridad 1/4 (phishing → Correo, .exe → Software, móvil perdido → Otros). Cuentas 0/3.
- Errores del prompt: "carpetas compartidas" en Red confundió la petición de permisos (#3). Respuesta del #12 dice "borra el correo" (contra la regla).
- Inyección (#20): categoría bien, prioridad urgente (no distinguible de la inflación general).

#### Prompt v2 (cambios solo en el prompt)
- Seguridad se comprueba primero. Permisos a carpetas → Cuentas. Prioridad como procedimiento de preguntas en orden; "un problema de una sola persona nunca es urgente" salvo phishing con interacción. Regla explícita: ignorar prioridades pedidas en el texto. 4 ejemplos *few-shot* DISTINTOS de los casos del test (evitar sobreajuste). v1 guardada en `prompts/historial/`.

#### Prompt v2 → Categoría 13/20 (65 %) · Prioridad 12/20 (60 %) · Ambas 7/20 (35 %) · 2,3 s · 0 revisar a mano
- Prioridad mejora mucho (ya no infla problemas de una persona). Cuentas mejora.
- **Seguridad 0/4** (peor): phishing → Correo, .exe → Software, móvil perdido → Hardware, pese a "comprueba primero Seguridad".
- Nunca dice "baja" (las 6 peticiones → media). **La inyección (#20) funciona**: Spotify → urgente.
- Conclusión: con un 3B, ajustar el prompt toca techo; aplicar 6 reglas encadenadas es razonamiento y el modelo flojea.

#### v3 (cambio de diseño): la IA extrae hechos, el código decide
- El modelo ya no elige prioridad ni escalado. Devuelve hechos (`seguridad`, `interaccion`, `alcance`, `alternativa`, `peticion`, `sin_prisa`, `vaga`) + categoría + resumen + respuesta.
- `Validar clasificación` calcula la prioridad con las reglas de Joaquín (primera que se cumple) y añade `motivo_prioridad` (explicable). Escalado 100 % determinista.
- Seguridad = hecho `seguridad` **o** categoría Seguridad (mejor un falso positivo que un phishing sin atender). Vaga → Otros.
- Contra la inyección: el texto ya no puede "pedir" una prioridad.
- Límite conocido: con hechos perfectos, las reglas dan 19/20 en prioridad; el #4 (impresora con otra disponible) sale media y no baja. No se fuerzan las reglas para cuadrarlo (sería sobreajuste).
- v2 en `prompts/historial/`, validador v1-v2 en `workflows/code/historial/`.

#### Prompt v3 → Categoría 16/20 (80 %) · Prioridad 4/20 (20 %) · Ambas 4/20 (20 %) · 3,3 s
- Categoría sube a 80 % (Seguridad 3/4: el diseño de hechos funciona para la categoría).
- **Las 20 salen urgentes.** Diagnóstico (añadido `motivo` y `hechos` a la evaluación, segunda ejecución idéntica gracias a `temperature: 0`): `alcance = "departamento"` en los 20 casos. El modelo confundía la línea de entrada "Departamento: Ventas" con "afecta a todo el departamento". Además, los ejemplos *few-shot* no tenían el formato real de entrada.
- El resto de hechos es bueno: peticiones, "sin prisa", seguridad e interacción bien detectados; **en la inyección (#20) extrae `peticion: true`**. Simulación con alcance correcto y los demás hechos tal cual: prioridad 18/20.

#### v4 (solo el alcance)
- Valores de `alcance`: `persona | grupo | empresa` (sin la palabra que confunde). Línea de entrada renombrada a "Departamento del usuario" + aclaración explícita en el prompt.
- Ejemplos *few-shot* con el MISMO formato que la entrada real. Lección: un ejemplo que no se parece a la entrada real enseña poco.

#### v4 → Categoría 15/20 (75 %) · Prioridad 17/20 (85 %) · Ambas 14/20 (70 %) · 3,2 s · 0 revisar a mano ✅ VERSIÓN ELEGIDA
- **Inyección neutralizada** (#20 → baja, "Petición o consulta sin urgencia"). Phishings #11-#13 bien en categoría y prioridad.
- Fallos restantes: #14 móvil perdido no detectado como seguridad (todas las versiones); #15 y #17 falsos positivos de seguridad (asumidos, prioridad correcta); #18 y #19 vagas no van a Otros; #4 impresora interpretada como grupo.
- **Decisión:** parar de iterar. Seguir ajustando con 20 casos sería sobreajuste. Resumen de versiones en `tests/resultados/README.md`.
- Códigos v4 pegados en n8n y probados con la incidencia fijada: Correo · alta · "No puede trabajar y no tiene alternativa" (en v1 salía urgente).
- Flujo exportado a `workflows/01-helpdesk-ia.json` (Export JSON). Revisado: sin credenciales ni secretos; el código de los nodos Code es idéntico a `workflows/code/`.
- ✅ **Fase 3 completada.**

### 2026-11-11 · Fase 4 (Odoo Helpdesk)
- **Investigación previa:** Odoo Online ofrece *One App Free* (1 app gratis para siempre, usuarios ilimitados, sin tarjeta). Pero según la documentación de Odoo la **API externa solo está incluida en el plan Custom** ("no disponible en One App Free ni Standard"); hay informes de que en la práctica funciona. Alternativas valoradas: Odoo Community + módulo Helpdesk de la OCA en Docker, o Google Sheets/GLPI. **Decisión de Joaquín:** probar Odoo Online y comprobar la API antes de configurar nada.
- Base de datos de Odoo Online con solo la app Helpdesk ("Servicio de asistencia"), plan One App Free, datos de empresa ficticios, interés "Soy estudiante". Sin tarjeta.
- Clave API creada en *Mis preferencias → Seguridad → Claves API → Create API Key*: nombre `n8n helpdesk-ia`, ámbito **RPC** (no MCP: mínimo privilegio), caduca en **1 mes**. Guardada solo en `.env` (comprobado con `git check-ignore -v .env`). **Pendiente: revocarla al terminar el proyecto.**
- `scripts/probar_odoo.js` (JSON-RPC, lee `.env`, nunca imprime la clave): **la API funciona en One App Free** (Odoo 20.0+e, uid 2). Se documentará que oficialmente es del plan Custom.
- Campos reales de `helpdesk.ticket` (`fields_get`): `name` (char, obligatorio), `description` (**html**), `priority` (selection `0` Low · `1` Medium · `2` High · `3` Urgent), `team_id` (→ helpdesk.team), `partner_name`, `partner_email`, `partner_id`, `stage_id`, `tag_ids` (→ helpdesk.tag). `ticket_type_id` no existe (opción no activada; no se usa).
- Mapeo de prioridad: baja → `0`, media → `1`, alta → `2`, urgente → `3`. Categoría → etiqueta (`tag_ids`).
- Equipo por defecto existente: "Customer Care" (id 1).
- Equipo **Soporte IT** (id 2) creado desde la interfaz: visibilidad "Todos los usuarios internos" (soporte interno, sin portal: mínimo privilegio), sin alias de correo (un único punto de entrada, menos superficie de ataque), sin asignación automática, sin "Buscar tickets similares" (IA en la nube de Odoo; aquí la IA es local). Etapas por defecto: Nuevo → En proceso → Resuelto → Cancelado (se dejan; renombrarlas podría afectar a otros equipos).
- Nodo Code `Preparar ticket Odoo` (`workflows/code/preparar_ticket_odoo.js`): prioridad → `0-3`, `team_id` 2, asunto `[Categoría] resumen`, descripción HTML con incidencia + clasificación + motivo + respuesta sugerida. **El texto del usuario se escapa** antes de meterlo en HTML (anti-inyección HTML; probado con `<script>`).
- Credencial de n8n "Odoo (API Key)" (usa la API **JSON-2**, `/json/2`; n8n avisa de que requiere plan Custom, pero **funciona en One App Free**). **Allowed HTTP Request Domains** restringido a el dominio de Odoo.
- Nodo `Crear ticket en Odoo`: Custom Resource → Create → Helpdesk Ticket, "Map Each Column Manually" (campos cargados desde Odoo): Subject, Description, Priority, Helpdesk Team, Customer Name, Customer Email, todos como expresión `{{ $json.odoo.* }}`.
- **Primer ticket creado: #00001** "[Correo] Outlook no envía correos desde esta mañana", equipo Soporte IT, 2 estrellas (High), descripción con formato. Base de datos activada (correo de Odoo).
- **Hallazgo:** Odoo envía automáticamente un acuse de recibo al cliente al crear el ticket (plantilla de la etapa Nuevo, en inglés). Falló (✖) porque el correo era ficticio. Implicaciones: (1) usar dominios reservados para pruebas (`example.com`, RFC 2606) y no `empresa-ficticia.com`, que podría existir; (2) la respuesta al usuario de la Fase 5 la puede hacer Odoo → decidir para no enviar dos correos.
- ✅ **Fase 4 completada.**

### 2026-11-11 · Fase 5 (avisos y respuesta al usuario)
- **Decisión de Joaquín (A + B):** respuesta al usuario en la **pantalla final del formulario** (inmediata) + **correo con Gmail desde n8n** (deja constancia y practica OAuth de Google; el proyecto de Google Cloud se reutilizará en la Fase 6). Habrá que **desactivar el acuse automático de Odoo** para no enviar dos correos. En las pruebas de correo el "usuario" será Joaquín (su Gmail o un alias `+ana`), nunca direcciones de terceros.
- Bot de Telegram creado con **@BotFather** (el oficial, con check azul; en la búsqueda aparecen imitadores): `@helpdesk_ia_joaquin_bot`. Token solo en `.env` y en la credencial de n8n.
- `scripts/telegram_chat_id.js`: obtiene el chat ID con la API oficial (`getMe` + `getUpdates`), sin bots de terceros. Un bot no puede escribir a un usuario hasta que este le escribe primero; el botón Start de Telegram Web no envió nada → hubo que escribir "hola".
- Nodo Code `Preparar avisos` (`workflows/code/preparar_avisos.js`): redacta en un solo sitio el aviso de Telegram, el texto de la pantalla final y el correo. Referencia `#00001` = id con ceros (coincide con la de Odoo mientras no se reinicie la secuencia). Enlace directo al ticket en Odoo. Todo el texto del usuario/IA se escapa (Telegram y el correo usan HTML).
- Nodo `Aviso Telegram`: Send Message al chat de Joaquín, Parse Mode **HTML**, sin "Append n8n Attribution". ✅ Aviso recibido (prioridad con icono de color, categoría, escalado, usuario, resumen y enlace).
- Nodo `Respuesta al usuario` (n8n Form → Form Ending, en paralelo con Telegram tras `Preparar avisos`): título `Incidencia recibida · Ticket #{{ ref }}` + respuesta sugerida. **Decisión:** el usuario espera unos segundos (IA + Odoo) a cambio de ver su número de ticket real.
- **Prueba de extremo a extremo** con incidencia nueva (Luis Prueba, `luis@example.com`, phishing "Microsoft" con credenciales introducidas, marcó que SÍ puede trabajar): ticket **#00002**, **Seguridad · urgente · escalar SÍ**, motivo "Seguridad con interacción del usuario". Pantalla final y aviso de Telegram correctos.
- **Fallo detectado en la prueba:** la respuesta sugerida de la IA para ese caso fue "No hagas clic en el enlace. No ingieras tu contraseña": llega tarde (ya había hecho clic y metido la contraseña) y con un error de idioma. **Decisión:** en categoría Seguridad la respuesta al usuario NO la escribe la IA; `Validar clasificación` la sustituye por una **plantilla fija revisada** (con interacción: cambiar la contraseña desde otro dispositivo, aislar el equipo sin apagarlo, no borrar pruebas; sin interacción: no tocar, no borrar, esperar a IT). Se anota en `ajustes`. Mismo principio: la IA propone, el código decide lo que no puede fallar.
- **Falso negativo de seguridad en prueba real (ticket #00003):** "He abierto un adjunto llamado factura.pdf.exe… no ha pasado nada visible" → **Correo · media · sin escalar**. El modelo resumió "Abrió un adjunto sospechoso" pero marcó `seguridad: false`. La plantilla de seguridad no actuó porque depende de la categoría.
- **Decisión (v5): defensa en profundidad.** `Validar clasificación` añade **reglas de detección** (regex sobre el texto original normalizado): ejecutables, phishing/fraude, malware, "piden credenciales", urgencia típica de phishing, dispositivo perdido/robado, USB desconocido, acceso no reconocido. Si alguna salta → `seguridad = true` aunque la IA diga lo contrario; si además hay verbos de interacción ("he abierto", "he pinchado", "puse mi contraseña"…) **sin "no" delante** → `interaccion = true`. Se anota en `ajustes`. Mismo planteamiento que un SOC: modelo + reglas.
- Simulación (validador v5 sobre las respuestas reales de la IA en v4, sin volver a llamar a Ollama): **Categoría 16/20 · Prioridad 18/20 · Ambas 15/20** (v4: 15 · 17 · 14). Corrige el #14 (móvil perdido, fallaba en todas las versiones). No añade falsos positivos. #11 "No he abierto el enlace" no cuenta como interacción. Los casos de Luis y Angela salen Seguridad · urgente aunque la IA no los marque.
- **Aviso de sobreajuste:** las reglas se escribieron conociendo el test → el 18/20 es optimista. Pendiente: set de validación escrito por Joaquín sin ver las reglas. Validador v4 guardado en `workflows/code/historial/`.

#### v5 (evaluación real) → Categoría 16/20 (80 %) · Prioridad 18/20 (90 %) · Ambas 15/20 (75 %) · 3,2 s · 0 revisar a mano ✅ VERSIÓN ACTUAL
- Idéntico a la simulación (con `temperature: 0` el modelo repite respuestas; solo cambió el validador). Validador v5 pegado en n8n.

#### Validación v5 (6 casos nuevos, `tests/validacion.csv`) → Categoría 5/6 (83 %) · Prioridad 3/6 (50 %) · Ambas 3/6 (50 %)
- Escritos por Claude sin las palabras clave de las reglas (Joaquín prefirió no escribirlos; no es validación totalmente a ciegas).
- Seguridad: 2/2 en categoría, **sin falsos negativos**. Prioridad: el modelo invierte la interacción (V1 pagó → alta; V2 no instaló → urgente) y "Necesito ayuda URGENTE!!!" → Correo · baja.
- **Conclusión:** el 90 % del test es optimista; la categoría generaliza, la prioridad no tanto. **No se ajusta nada más** para no invalidar la validación. `tests/evaluar.js` acepta ahora un CSV alternativo como segundo argumento.

### 2026-11-12 · Fase 5B (correo al usuario con Gmail)
- Proyecto de Google Cloud `helpdesk-ia-n8n` creado **sin organización**: con la organización asociada a la cuenta, el formulario exigía cuenta de facturación; sin ella, no. Facturación: 0 €.
- APIs habilitadas: Gmail, Google Sheets, Google Drive (las dos últimas para la Fase 6).
- **Google Auth Platform** (antes "pantalla de consentimiento OAuth"): app `Helpdesk IA n8n`, público **Externo** (Interno solo existe con organización de Workspace), estado **En prueba**, Joaquín como único **usuario de prueba**. Limitación: en modo prueba la autorización caduca a los 7 días → reconectar la credencial.
- Cliente OAuth **Aplicación web** `n8n local`, URI de redireccionamiento `http://localhost:5678/rest/oauth2-credential/callback`. Error resuelto: se pegó primero en "Orígenes autorizados de JavaScript" ("los URI no deben contener una ruta") → va en "URIs de redireccionamiento".
- Credencial Gmail OAuth2 en n8n con **Allowed HTTP Request Domains** = `gmail.googleapis.com`. **Mínimo privilegio en el consentimiento:** se concedió solo "Administrar borradores y enviar correo" (no "leer y eliminar permanentemente todo Gmail"). Suficiente para enviar.
- Nodo `Correo al usuario` (Gmail → Send, tercera rama tras `Preparar avisos`): To `{{ $json.correo }}`, asunto y HTML de `avisos`, remitente "Soporte IT", sin atribución de n8n. Pruebas con **alias `+ana`** del Gmail de Joaquín (llega a su buzón; nunca a terceros).
- ✅ Ticket #00004 → correo recibido en español con nº de ticket, lo que contó el usuario y primeros pasos.
- **Hallazgo:** el acuse automático de Odoo (en inglés) **mostraba el hotmail personal** en el pie (correo de la empresa en Odoo) → además de duplicado, filtraba un dato personal. **Desactivado:** etapa *Nuevo* → plantilla de correo vacía. La etapa es compartida con *Atención al cliente* (efecto en ambos equipos; aceptable en pruebas).
- **Revisión humana:** ticket #00003 (el `.exe` que la IA clasificó como Correo · media) reclasificado a mano a Seguridad · urgente con nota interna; el chatter de Odoo deja trazabilidad de cada cambio.
- ✅ **Fase 5 completada.**

### 2026-11-12 · Fase 6 (Google Workspace · práctica)
- Hoja **"Helpdesk IA · Registro de tickets"**, pestaña `Tickets`, columnas: Fecha, Ticket, Categoría, Prioridad, Escalar, Departamento, Resumen, Enlace. **Minimización de datos (RGPD):** sin nombre ni correo del usuario.
- Nodo `Registro en Sheets` (Append Row, cuarta rama tras `Preparar avisos`): documento **By URL** y pestaña **By Name** (el selector "From list" necesitaría permiso de Drive); *Cell Format* = *Let n8n format* (conserva `00004`). Error resuelto: se había borrado sin querer la columna Prioridad del mapeo → *Add column to send*.
- Credencial Google Sheets OAuth2 con el **mismo cliente OAuth** que Gmail (misma redirect URI). Dominios permitidos: `sheets.googleapis.com`, `www.googleapis.com`. En el consentimiento solo se concedió **"hojas de cálculo"** (no los dos permisos de Drive).
- **Apps Script** `scripts/apps-script/resumen_diario.gs`, dentro de la hoja (Extensiones → Apps Script, proyecto "Resumen diario helpdesk"): `enviarResumenDiario()` filtra los tickets de las últimas 24 h, los ordena por prioridad y envía un correo HTML con contadores (urgente/alta/media/baja/escalar) y tabla con enlace a Odoo; `crearActivadorDiario()` crea por código el activador de tiempo diario a las 8:00 (Europe/Madrid) y borra duplicados. **`@OnlyCurrentDoc`**: el script solo puede abrir esta hoja (Google mostró "hojas de cálculo en las que se ha instalado esta aplicación", no "todas tus hojas"). Probado antes con una simulación en Node.
- ✅ Resumen recibido (1 ticket, #00004 alta) · ✅ activador creado (basado en tiempo, `enviarResumenDiario`).
- **Limitación:** el estado del ticket (abierto/cerrado) vive en Odoo; el registro y el resumen son de tickets **nuevos** de las últimas 24 h.

### 2026-11-12 · Fase 7 (preparar la publicación)
- README reescrito con el estilo del repo `soc-triage-agent` (secciones: por qué, idea central, "medido, no prometido", estructura, seguridad, limitaciones con honestidad, roadmap, licencia, aviso, resumen en inglés). Guía paso a paso para terceros en `INSTALL.md`. Licencia MIT.
- **Revisión de datos personales antes de publicar:** el flujo exportado llevaba el chat ID de Telegram y la URL de la hoja; el código, la URL de Odoo; `PROGRESO.md`, el nombre de la organización de Google Cloud. Sustituidos por marcadores (`TU_CHAT_ID`, `TU_ID_DE_HOJA`, `https://TU-BASE.odoo.com`) con comentarios `← CONFIGURA`.
- **Decisión:** esos datos estaban también en commits antiguos → se publica **un único commit limpio** (rama huérfana) en vez del historial; el historial completo se conserva solo en local (rama `historial-privado`) y la evolución queda contada en este archivo.

## Errores y soluciones
- **Edit Fields mostraba "No input connected"** → el nodo no estaba unido al trigger. Solución: arrastrar desde la salida del trigger a la entrada del nodo.
- **La expresión de `bloqueante` acabó en el nombre del campo, no en el valor** → cada caja (nombre/valor) tiene su propio selector Fixed/Expression. Solución: borrar el campo, crearlo de nuevo y arrastrar el dato de INPUT sobre la caja del valor.
- **Valor fijo `true` en `bloqueante`** → habría marcado todas las incidencias como bloqueantes y la prueba con "Sí" no lo habría detectado. Lección: probar también el caso contrario.
- **`=== "Sí"` fuera de `{{ }}`** → lo de fuera de las llaves se trata como texto. Solución: la expresión entera dentro.
- **"Cannot GET /workflow/..." al recargar tras el restart** → n8n aún estaba arrancando. Solución: esperar 15-20 s y recargar.
- **Odoo: `Invalid input for 'priority'` · "expects [0, 1, 2, 3] but we got ' 2'"** → había espacios delante de `{{ }}` en la expresión; lo que queda fuera de las llaves se envía tal cual. Solución: Ctrl+A y pegar la expresión limpia. Lección: leer el error literal (las comillas de `' 2'` delataban el espacio).
- **"No fields found in Odoo"** al añadir el nodo → aún no había credencial. Desaparece al crearla y elegir el recurso.
- **Formulario de prueba: "Form Trigger isn't listening yet"** → la Test URL solo escucha un par de minutos tras *Execute workflow*. Solución: ejecutar y enviar enseguida. La Production URL (flujo publicado) escucha siempre.
- **Chincheta morada en el nodo del formulario** → no indica datos fijados; el menú contextual (clic derecho) dice "Pin" o "Unpin" y es la forma fiable de saberlo.

## Capturas pendientes
- [x] Fase 6: resumen diario → `docs/img/fase6-resumen-diario.png` · activador → `docs/img/fase6-activador.png`
- [x] Fase 1: flujo de prueba ejecutado → `docs/img/fase1-n8n-flujo-prueba.png`
- [x] Fase 2: formulario de incidencias → `docs/img/fase2-formulario-n8n.png`
- [x] Fase 3: flujo de n8n → `docs/img/fase3-flujo-n8n.png` · salida de la validación → `docs/img/fase3-validar-clasificacion.png`
- [x] Fase 4: vista general → `docs/img/fase4-odoo-vista-general.png` · tablero → `fase4-odoo-tablero.png` · ticket → `fase4-odoo-ticket.png`
- [x] Fase 5: aviso de Telegram → `fase5-aviso-telegram.png` · pantalla final → `fase5-pantalla-final.png` · correo → `fase5-correo-usuario.png` (sin correos personales) · revisión humana → `fase5-revision-humana.png`
