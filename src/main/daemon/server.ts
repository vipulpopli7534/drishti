import * as http from "node:http";
import { EventSink, HookPayload, SessionQuery } from "./types";

export function startServer(
  host: string,
  port: number,
  store: EventSink & SessionQuery,
  onChange: () => void
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/debug") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ aggregate: store.computeAggregate(), sessions: store.getAll() }, null, 2));
      return;
    }

    if (req.method !== "POST" || req.url !== "/event") {
      res.writeHead(404).end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      // Always 200: the hook shim must never see a failure, and a malformed
      // payload should just be dropped, not raised.
      res.writeHead(200).end();
      try {
        const payload = JSON.parse(body) as HookPayload;
        if (!payload.session_id || !payload.hook_event_name) {
          console.warn("[drishti] dropping malformed payload:", body.slice(0, 200));
          return;
        }
        console.log(`[drishti] event ${payload.hook_event_name} session=${payload.session_id}`);
        store.apply(payload);
        onChange();
      } catch (err) {
        console.warn("[drishti] dropping unparseable payload:", (err as Error).message);
      }
    });
    req.on("error", () => {
      // Client hung up mid-request; nothing to do.
    });
  });

  server.listen(port, host, () => {
    console.log(`[drishti] daemon listening on http://${host}:${port}`);
  });

  return server;
}
