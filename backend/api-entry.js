// Vercel serverless entry — lazily import the Express app so
// cold-start errors surface as readable JSON instead of silent crashes.
import typecheck from "node:util"; // eslint-disable-line

export default async function handler(req, res) {
  try {
    const { app } = await import("./src/server.js");
    return app(req, res);
  } catch (err) {
    console.error("[api] Cold start error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Function failed to start: " + (err?.message || String(err)) });
    }
  }
}
