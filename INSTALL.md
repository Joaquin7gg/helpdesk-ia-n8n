# Guía de instalación

Esta guía te lleva de cero a tener el helpdesk funcionando en tu ordenador. No hace falta saber programar: solo copiar comandos y seguir los pasos. Todo es **gratis** y ningún paso pide tarjeta.

> Las interfaces de n8n, Odoo y Google cambian a menudo. Si un botón no se llama exactamente como aquí, busca uno parecido: la idea es la misma.

## Índice

0. [Antes de empezar](#0-antes-de-empezar)
1. [Instalar las herramientas](#1-instalar-las-herramientas)
2. [Descargar el proyecto y la IA](#2-descargar-el-proyecto-y-la-ia)
3. [Arrancar n8n e importar el flujo](#3-arrancar-n8n-e-importar-el-flujo)
4. [Odoo Helpdesk](#4-odoo-helpdesk)
5. [Telegram](#5-telegram)
6. [Google: Gmail y Sheets](#6-google-gmail-y-sheets)
7. [Configurar el flujo](#7-configurar-el-flujo)
8. [Probarlo](#8-probarlo)
9. [Resumen diario con Apps Script](#9-resumen-diario-con-apps-script)
10. [Evaluar la IA](#10-evaluar-la-ia)
11. [Problemas frecuentes](#11-problemas-frecuentes)
12. [Seguridad: lo que no debes hacer](#12-seguridad-lo-que-no-debes-hacer)

---

## 0. Antes de empezar

**Qué necesitas**

| | Mínimo | Recomendado |
|---|---|---|
| Sistema | Windows 10/11, macOS o Linux | |
| RAM | 8 GB | 16 GB o más |
| Disco libre | 10 GB | |
| Tarjeta gráfica | No es obligatoria (la IA irá más lenta) | NVIDIA o AMD con 4 GB o más |

**Cuentas (todas gratuitas)**: una cuenta de Google, una de Telegram y una base de datos de prueba de Odoo (la creamos en el paso 4).

**Tiempo**: entre 1 y 2 horas la primera vez.

**¿Lo quieres más sencillo?** El corazón del proyecto es *formulario → IA → clasificación*. Si solo quieres ver eso, haz los pasos 1, 2, 3 y 8, y desactiva los nodos de Odoo, Telegram, Gmail y Sheets (selecciónalos en n8n y pulsa la tecla **D**). Luego puedes ir añadiendo el resto.

---

## 1. Instalar las herramientas

Necesitas tres programas. Para comprobar si ya los tienes, abre una terminal (en Windows, **PowerShell**) y escribe:

```bash
docker --version
ollama --version
git --version
```

Si alguno responde "no se reconoce como comando", instálalo:

- **Docker Desktop**: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/). Sirve para ejecutar n8n sin instalarlo en el sistema. En Windows necesita **WSL2**; el propio instalador te lo pide. Después de instalarlo, **ábrelo** y déjalo abierto: Docker tiene que estar en marcha.
- **Ollama**: [ollama.com/download](https://ollama.com/download). Es el programa que ejecuta la IA en tu ordenador. En Windows también puedes usar `winget install Ollama.Ollama`.
- **Git**: [git-scm.com](https://git-scm.com/downloads). Sirve para descargar el proyecto.

Después de instalar, **cierra y vuelve a abrir la terminal** para que reconozca los comandos nuevos.

---

## 2. Descargar el proyecto y la IA

```bash
git clone https://github.com/Joaquin7gg/helpdesk-ia-n8n.git
cd helpdesk-ia-n8n
ollama pull llama3.2:3b
ollama run llama3.2:3b "Responde solo con la palabra OK"
```

- `git clone` descarga el proyecto en una carpeta nueva.
- `ollama pull` descarga el modelo de IA (unos 2 GB).
- Si el último comando contesta **OK**, la IA funciona.

---

## 3. Arrancar n8n e importar el flujo

n8n es la herramienta que conecta todas las piezas. Desde la carpeta del proyecto:

```bash
docker compose up -d
```

La primera vez tarda un poco (descarga n8n). Cuando acabe, abre **http://localhost:5678** en el navegador.

1. **Crea la cuenta de propietario.** Es solo local: no se registra en ningún sitio. Apunta la contraseña.
2. Las encuestas y ofertas que aparezcan después son opcionales: puedes saltarlas.
3. **Importa el flujo**: crea un workflow nuevo (botón `+` de la izquierda) → menú `...` de arriba → **Import from File** → elige `workflows/01-helpdesk-ia.json`.

Verás el flujo completo. Algunos nodos aparecerán con un aviso rojo: les faltan las credenciales, que creamos en los pasos siguientes.

**Comprobar que n8n llega a la IA** (n8n está dentro de Docker y Ollama fuera):

```bash
docker compose exec n8n node -e "fetch('http://host.docker.internal:11434/api/version').then(r=>r.text()).then(console.log).catch(e=>console.error('ERROR:', e.message))"
```

Si sale algo como `{"version":"..."}`, perfecto. Si sale `ERROR`, mira [Problemas frecuentes](#11-problemas-frecuentes).

---

## 4. Odoo Helpdesk

Odoo es donde se guardan los tickets.

**4.1 · Crear la base de datos**

1. Entra en la página de Helpdesk de Odoo ([odoo.com/es_ES/page/helpdesk](https://www.odoo.com/es_ES/page/helpdesk)) y pulsa el botón para empezar gratis.
2. Deja seleccionada **solo la aplicación de Servicio de asistencia** (Helpdesk). Con una sola app, Odoo es gratis y no caduca.
3. Usa una **empresa ficticia**. El correo sí debe ser el tuyo: es tu usuario.
4. Apunta la dirección que te asigna, del tipo `https://tu-base.odoo.com`. La parte `tu-base` es también el **nombre de la base de datos**.
5. Activa la base de datos con el enlace que te llega por correo.

**4.2 · Crear el equipo de soporte**

1. En **Servicio de asistencia → Configuración → Equipos**, crea un equipo llamado `Soporte IT`.
2. Visibilidad: **usuarios internos**. Desactiva el **alias de correo** (así los tickets solo entran por el formulario).
3. Las etapas (Nuevo, En proceso, Resuelto, Cancelado) ya vienen creadas.

**4.3 · Evitar el correo automático de Odoo**

Odoo envía su propio acuse de recibo (en inglés) cuando se crea un ticket. Como el flujo ya manda uno mejor, desactívalo: en el tablero de tickets, pasa el ratón por la columna **Nuevo** → engranaje → **Editar** → deja vacío **Plantilla de correo electrónico** → Guardar.

**4.4 · Crear la clave API**

1. Pulsa tu avatar (arriba a la derecha) → **Mis preferencias** → pestaña **Seguridad de la cuenta**.
2. **Claves API → Crear clave**. Nombre: `n8n helpdesk`. Ámbito: **RPC**. Caducidad: la más corta que te sirva.
3. **Cópiala ya**: solo se muestra una vez. Trátala como una contraseña.

**4.5 · Comprobar que la API funciona**

```bash
cp .env.example .env            # en PowerShell: Copy-Item .env.example .env
```

Abre `.env` con un editor de texto y rellena las líneas de Odoo (`ODOO_URL`, `ODOO_DB`, `ODOO_USER` y `ODOO_API_KEY`). Luego:

```bash
docker run --rm -v "$PWD:/app" -w /app --env-file .env node:22-alpine node scripts/probar_odoo.js
```

> En PowerShell, escribe `${PWD}` en lugar de `$PWD`.

Debe terminar con **"La API funciona"** y listar los equipos. **Apunta el id del equipo `Soporte IT`**: lo necesitas en el paso 7.

---

## 5. Telegram

El técnico recibe un aviso por Telegram con cada ticket nuevo.

1. En Telegram, busca **@BotFather**. Comprueba que tiene el **check azul** de verificado: hay imitadores.
2. Envíale `/newbot`, elige un nombre y un usuario que acabe en `bot`.
3. Te dará un **token**. Es la contraseña del bot: pégalo en `.env` en la línea `TELEGRAM_BOT_TOKEN=`.
4. Abre el chat con tu bot y **escríbele cualquier cosa** (por ejemplo, `hola`). Un bot no puede escribirte hasta que tú le escribas primero.
5. Obtén tu **chat ID**:

```bash
docker run --rm -v "$PWD:/app" -w /app --env-file .env node:22-alpine node scripts/telegram_chat_id.js
```

---

## 6. Google: Gmail y Sheets

El flujo manda un correo al usuario (Gmail) y guarda cada ticket en una hoja de cálculo (Sheets). Para que n8n pueda hacerlo **sin conocer tu contraseña** se usa OAuth: autorizas una vez y Google le da a n8n un permiso limitado.

**6.1 · Proyecto en Google Cloud**

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) y crea un proyecto (por ejemplo, `helpdesk-ia-n8n`).
2. **Si te pide una cuenta de facturación**, cambia *Organización* a **Sin organización**: así no hace falta. No pongas ninguna tarjeta.
3. En **APIs y servicios → Biblioteca**, habilita **Gmail API** y **Google Sheets API**.

**6.2 · Pantalla de consentimiento** (*Google Auth Platform*)

1. **Comenzar** → nombre de la app: `Helpdesk IA` → tu correo de asistencia.
2. Público: **Usuarios externos**. La app queda en **modo prueba**.
3. Contacto: tu correo → acepta la política → **Crear**.
4. En **Público → Usuarios de prueba → Add users**, añade **tu propio Gmail**.

**6.3 · Cliente OAuth**

1. En **Clientes → Crear cliente** → tipo **Aplicación web** → nombre `n8n local`.
2. En **URIs de redireccionamiento autorizados** (no en "Orígenes de JavaScript") añade:
   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```
3. **Crear**. Copia el **ID de cliente** y el **secreto**. El secreto no se vuelve a mostrar.

**6.4 · Credenciales en n8n**

En el nodo **Correo al usuario** → *Credential* → crear nueva (**Gmail OAuth2**):
- Pega el ID de cliente y el secreto.
- *Allowed HTTP Request Domains*: `gmail.googleapis.com`.
- **Sign in with Google** → aparecerá "Google no ha verificado esta aplicación": es normal, la app es tuya → *Continuar*.
- En la lista de permisos marca **solo "Administrar borradores y enviar correo electrónico"**. No hace falta dar acceso a leer tu buzón.

En el nodo **Registro en Sheets**, crea una credencial **Google Sheets OAuth2** con el **mismo** ID y secreto. *Allowed HTTP Request Domains*: `sheets.googleapis.com, www.googleapis.com`. Al conectar, marca **solo el permiso de hojas de cálculo**.

**6.5 · La hoja de registro**

1. Crea una hoja nueva en [sheets.new](https://sheets.new) y renombra la pestaña a `Tickets`.
2. En la fila 1, de la A a la H, escribe exactamente: `Fecha`, `Ticket`, `Categoría`, `Prioridad`, `Escalar`, `Departamento`, `Resumen`, `Enlace`.
3. Copia la URL de la hoja.

---

## 7. Configurar el flujo

Quedan cuatro datos tuyos por poner. En n8n, abre cada nodo:

| Nodo | Qué cambiar |
|---|---|
| **Preparar ticket Odoo** | `TEAM_ID` → el id del equipo del paso 4.5 |
| **Preparar avisos** | `ODOO_URL` → tu dirección de Odoo · `TEAM_ID` → el mismo id |
| **Crear ticket en Odoo** | Credencial: **Odoo (API Key)** con tu URL, base de datos y clave API. *Allowed domains*: tu dominio de Odoo |
| **Aviso Telegram** | Credencial: el token del bot · **Chat ID**: el del paso 5 |
| **Registro en Sheets** | **Document → By URL**: la URL de tu hoja · **Sheet → By Name**: `Tickets` |

Guarda con **Ctrl+S**.

---

## 8. Probarlo

1. Pulsa **Execute workflow** (abajo, en el centro). Se abre el formulario de prueba.
2. **Rellénalo enseguida**: la URL de prueba solo escucha un par de minutos.
3. Para el correo, usa **tu Gmail con un alias**, por ejemplo `tucorreo+prueba@gmail.com`. Gmail ignora lo que va tras el `+`, así que el correo te llega a ti y nunca a un desconocido.

Ejemplo de incidencia de seguridad:

> Me ha llegado un correo de "Microsoft" diciendo que mi contraseña caduca hoy. He pinchado el enlace y he puesto mi usuario y contraseña.

Deberías ver: la pantalla final con el número de ticket, el ticket en Odoo (*Seguridad*, 3 estrellas), el aviso en Telegram, el correo en tu Gmail y una fila nueva en la hoja.

Cuando todo funcione, pulsa **Publish** (arriba a la derecha) para usar la **Production URL**, que escucha siempre.

---

## 9. Resumen diario con Apps Script

1. En tu hoja: **Extensiones → Apps Script**.
2. Borra el código de ejemplo y pega el contenido de `scripts/apps-script/resumen_diario.gs`. Guarda.
3. Elige la función **`enviarResumenDiario`** → **Ejecutar**. La primera vez pide permisos: **Configuración avanzada → Ir a … (no seguro)** → acepta. Gracias a `@OnlyCurrentDoc`, el script solo puede leer esa hoja.
4. Mira tu correo: debe llegar el resumen.
5. Elige **`crearActivadorDiario`** → **Ejecutar**. En el icono del reloj (**Activadores**) aparecerá uno diario a las 8:00.

---

## 10. Evaluar la IA

```bash
docker run --rm -v "$PWD:/app" -w /app -e OLLAMA_URL=http://host.docker.internal:11434 node:22-alpine node tests/evaluar.js mi-prueba
docker run --rm -v "$PWD:/app" -w /app -e OLLAMA_URL=http://host.docker.internal:11434 node:22-alpine node tests/evaluar.js mi-validacion tests/validacion.csv
```

El resultado se guarda en `tests/resultados/`. Si cambias el prompt (`prompts/clasificador.txt`), regenera el código del nodo y vuelve a pegarlo en *Preparar petición IA*:

```bash
docker run --rm -v "$PWD:/app" -w /app node:22-alpine node scripts/generar_snippet.js
```

---

## 11. Problemas frecuentes

| Síntoma | Qué mirar |
|---|---|
| Docker no arranca en Windows | WSL2 instalado y actualizado (`wsl --update`); virtualización activada en la BIOS |
| `port 5678 is already allocated` | Otro programa usa ese puerto: `docker ps` o cambia `"5678:5678"` por `"5679:5678"` en `docker-compose.yml` |
| n8n no llega a Ollama (`ERROR` en el paso 3) | Comprueba que Ollama está abierto. **En Linux**, Ollama solo escucha en `127.0.0.1`: define `OLLAMA_HOST=0.0.0.0` y reinícialo (solo en la red de casa: así Ollama escucha en toda tu red local) |
| `Form Trigger isn't listening yet` | La URL de prueba caduca a los pocos minutos: pulsa otra vez *Execute workflow* y envía enseguida |
| Odoo: `Invalid input for 'priority'` | Hay un espacio delante de `{{` en la expresión: borra el campo y vuelve a escribirlo |
| Odoo: error de autenticación | Revisa el nombre de la base de datos, el usuario (tu correo) y la clave API |
| Google: `redirect_uri_mismatch` | La URI del cliente OAuth debe ser exactamente `http://localhost:5678/rest/oauth2-credential/callback` y estar en "URIs de redireccionamiento" |
| Google: "Los URI no deben contener una ruta" | La has pegado en "Orígenes de JavaScript": va en "URIs de redireccionamiento" |
| Google pide reconectar la credencial cada semana | Normal en modo prueba: la autorización caduca a los 7 días |
| El bot no te escribe | Escríbele tú primero (cualquier mensaje) y vuelve a obtener el chat ID |
| La IA va muy lenta | Sin tarjeta gráfica es normal. Comprueba con `ollama ps` si usa GPU o CPU y cierra otros programas de IA (por ejemplo, LM Studio) |

---

## 12. Seguridad: lo que no debes hacer

- **No subas el archivo `.env`** a ningún sitio: tiene tus claves. Ya está en `.gitignore`.
- **No expongas n8n a internet** (túneles, puertos abiertos en el router) sin autenticación.
- **No pegues claves ni tokens** en chats, capturas o issues. Si lo haces por error, revócalos y crea otros.
- **Usa datos ficticios** para las pruebas.
- Al terminar de probar, **revoca** la clave API de Odoo y el token del bot si ya no los usas.
