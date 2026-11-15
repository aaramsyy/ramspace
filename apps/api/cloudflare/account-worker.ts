import { createApp } from "../src/app";
import { loadApiConfig } from "../src/config";

export type AccountWorkerEnv = Record<string, string | undefined>;

// Keep request-owned sockets and identity state within one Worker invocation.
async function openApp(env: AccountWorkerEnv) {
  const config = loadApiConfig(env);
  if (config.apns || config.cloudflareTunnel || config.polarBilling) {
    throw new Error("Workers account deployment does not yet support APNs, tunnels, or billing");
  }
  if (config.identityProvider !== "workos") {
    throw new Error("Workers account deployment requires WorkOS");
  }
  return createApp(config);
}

export default {
  async fetch(request: Request, env: AccountWorkerEnv): Promise<Response> {
    let runtime: Awaited<ReturnType<typeof createApp>> | undefined;
    try {
      runtime = await openApp(env);
      return await runtime.app.fetch(request);
    } catch {
      return Response.json(
        { error: "service_unavailable", message: "Account service is unavailable" },
        { status: 503 },
      );
    } finally {
      if (runtime) {
        try {
          await runtime.identity.close();
        } finally {
          await runtime.pool.end();
        }
      }
    }
  },
  async scheduled(_event: unknown, env: AccountWorkerEnv): Promise<void> {
    const runtime = await openApp(env);
    try {
      await runtime.cleanup();
    } finally {
      try {
        await runtime.identity.close();
      } finally {
        await runtime.pool.end();
      }
    }
  },
};
