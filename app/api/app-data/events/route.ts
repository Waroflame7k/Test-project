import { getCollectionSyncReference } from "@/services/collection-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const encoder = new TextEncoder();

function eventPayload(event: string, value: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
}

export async function GET(request: Request) {
  const reference = await getCollectionSyncReference();
  if (!reference) {
    return new Response(eventPayload("unavailable", { reason: "firebase_not_configured" }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // The browser may already have closed the stream.
        }
      };

      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      unsubscribe = reference.onSnapshot(
        (snapshot) => {
          if (closed) return;
          controller.enqueue(
            eventPayload("revision", {
              revision: snapshot.data()?.revision ?? "",
              updatedAt: snapshot.data()?.updatedAt ?? "",
            })
          );
        },
        () => {
          if (!closed) controller.enqueue(eventPayload("sync-error", { retry: true }));
          close();
        }
      );
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 20_000);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
