import "./load-env.mjs";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const pollSecret = process.env.TELEGRAM_POLL_SECRET ?? "";
const intervalMs = Number(process.env.TELEGRAM_POLL_INTERVAL_MS ?? "2500");

async function tick() {
  const response = await fetch(`${appUrl}/api/telegram/poll`, {
    method: "POST",
    headers: {
      ...(pollSecret ? { "x-telegram-poll-secret": pollSecret } : {}),
    },
  });
  const payload = await response.json();
  const processed = payload.processed ?? 0;
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] polled Telegram: ${processed} update(s)`);
}

async function loop() {
  console.log(`Telegram polling -> ${appUrl}/api/telegram/poll`);
  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error("Telegram polling error:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

loop();
