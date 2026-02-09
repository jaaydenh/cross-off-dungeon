import { boot, ColyseusTestServer } from "@colyseus/testing";
import { createServer } from "net";

type BootConfig = Parameters<typeof boot>[0];

function isSocketPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "EPERM"
  );
}

let socketSupportPromise: Promise<boolean> | undefined;

async function canBindLocalSocket(): Promise<boolean> {
  if (!socketSupportPromise) {
    socketSupportPromise = new Promise<boolean>((resolve) => {
      const server = createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.listen(0, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });
  }

  return socketSupportPromise;
}

export async function bootSandboxSafe(
  ctx: Mocha.Context,
  config: BootConfig
): Promise<ColyseusTestServer | undefined> {
  if (!(await canBindLocalSocket())) {
    ctx.skip();
    return undefined;
  }

  try {
    return await boot(config);
  } catch (error) {
    if (isSocketPermissionError(error)) {
      ctx.skip();
      return undefined;
    }
    throw error;
  }
}

export async function cleanupSandboxSafe(
  colyseus: ColyseusTestServer | undefined
): Promise<void> {
  if (colyseus) {
    await colyseus.cleanup();
  }
}

export async function shutdownSandboxSafe(
  colyseus: ColyseusTestServer | undefined
): Promise<void> {
  if (colyseus) {
    await colyseus.shutdown();
  }
}
