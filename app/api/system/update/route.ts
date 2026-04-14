import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { detectCapabilities, pullImage, scheduleSelfRecreate } from "@/lib/docker-update";

export const dynamic = "force-dynamic";

/**
 * GET — return update capabilities so the UI can render the right mode:
 *  - `socket`: docker.sock mounted, we can self-update in-place
 *  - `manual`: show copy-command modal with exact docker/compose commands
 */
export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const caps = await detectCapabilities();
  return NextResponse.json(caps);
}

/**
 * POST — trigger the update.
 *
 * Only supported in `socket` mode. In `manual` mode we reject with 409 so the
 * UI can redirect the user to the copy-command flow. Response body is an SSE
 * stream (`text/event-stream`) emitting JSON events:
 *   { stage: "pull", status, progress, total }
 *   { stage: "recreate" }
 *   { stage: "done" }
 *   { stage: "error", message }
 *
 * After "recreate" the container goes away — the client must detect the
 * dropped connection and start polling /api/system/version for revival.
 */
export async function POST(_req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const caps = await detectCapabilities();
  if (caps.mode !== "socket") {
    return NextResponse.json(
      {
        error: "Automatic update not available",
        reason: caps.reason,
        hint: "Mount /var/run/docker.sock or run the update command manually.",
      },
      { status: 409 }
    );
  }
  if (!caps.imageRef) {
    return NextResponse.json({ error: "Could not determine current image" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };

      try {
        send({ stage: "start", image: caps.imageRef });

        await pullImage(caps.imageRef!, (line) => {
          // Docker stream shapes: { status, id, progressDetail: {current,total}, progress }
          send({
            stage: "pull",
            status: line.status,
            id: line.id,
            progress: line.progressDetail?.current,
            total: line.progressDetail?.total,
            raw: line.progress,
          });
        });

        send({ stage: "recreate", message: "Spawning helper container to swap images…" });
        await scheduleSelfRecreate(caps);

        send({ stage: "done", message: "Helper scheduled. Container will restart in ~4s." });
        controller.close();
      } catch (e: any) {
        send({ stage: "error", message: e?.message || String(e) });
        controller.close();
      }
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
