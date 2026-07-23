import "./load-env.mjs";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const pollSecret = process.env.TELEGRAM_POLL_SECRET ?? "";

async function main() {
  const response = await fetch(`${appUrl}/api/telegram/dispatch-notifications`, {
    method: "POST",
    headers: {
      ...(pollSecret ? { "x-telegram-poll-secret": pollSecret } : {}),
    },
  });
  const payload = await response.json();
  console.log(`Telegram notifications sent: ${payload.sent ?? 0}`);
}

main().catch((error) => {
  console.error("Telegram notification dispatch failed:", error);
  process.exitCode = 1;
});
