const http = require("http");
const crypto = require("crypto");
const { execSync } = require("child_process");

const PORT = parseInt(process.env.DEPLOY_PORT || "4003", 10);
const SECRET = process.env.DEPLOY_SECRET || "";

function verifySignature(payload, signature) {
  if (!SECRET) return true;
  const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  const expected = `sha256=${hmac}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/deploy") {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const sig = req.headers["x-hub-signature-256"];
    if (SECRET && !verifySignature(body, sig)) {
      console.log("Deploy webhook: invalid signature");
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const payload = JSON.parse(body);
      if (payload.ref !== "refs/heads/main") {
        res.writeHead(200);
        res.end("Skipped: not main branch");
        return;
      }
    } catch {}

    console.log(`Deploy triggered at ${new Date().toISOString()}`);
    res.writeHead(200);
    res.end("Deploying...");

    try {
      execSync("git pull && npm run build && pm2 restart minicrm-mcp", {
        cwd: "/home/app/minicrm-mcp",
        stdio: "inherit",
        timeout: 60_000,
      });
      console.log("Deploy successful");
    } catch (err) {
      console.error("Deploy failed:", err.message);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Deploy webhook listening on port ${PORT}`);
});
