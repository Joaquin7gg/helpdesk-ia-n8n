// Muestra el chat ID de quien haya escrito al bot. Hace falta para que n8n sepa a quién enviar los avisos.
// 1) Escribe cualquier mensaje a tu bot en Telegram.  2) Ejecuta (PowerShell, carpeta del proyecto):
//    docker run --rm -v "${PWD}:/app" -w /app --env-file .env node:22-alpine node scripts/telegram_chat_id.js
// Usa la API oficial de Telegram (getUpdates). Nunca imprime el token.
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('Falta TELEGRAM_BOT_TOKEN en el archivo .env'); process.exit(1); }

(async () => {
  const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
  if (!me.ok) { console.error(`Token no válido: ${me.description}`); process.exit(1); }
  console.log(`Bot: @${me.result.username}`);

  const upd = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json();
  const chats = new Map();
  for (const u of upd.result ?? []) {
    const m = u.message ?? u.edited_message ?? u.channel_post;
    if (m?.chat) chats.set(m.chat.id, m.chat.username ? `@${m.chat.username}` : (m.chat.first_name ?? m.chat.title ?? ''));
  }
  if (!chats.size) { console.log('No hay mensajes todavía. Escríbele algo al bot (por ejemplo /start) y vuelve a ejecutar.'); return; }
  for (const [id, quien] of chats) console.log(`Chat ID: ${id}  (${quien})`);
})().catch((e) => { console.error(`ERROR: ${e.message}`); process.exit(1); });
