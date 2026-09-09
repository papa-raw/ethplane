// shoot.cjs: screenshots for the swarm and the gate. Two modes:
//   node shoot.cjs export <out-dir> <shots-dir> [api-base]   serve a Next static export ($uri, $uri.html, $uri/index.html;
//                                                            /api/* proxied to api-base, default https://ethplane.ecofrontiers.xyz)
//                                                            and shoot home, docs, deck and a live node page at 1440px
//   node shoot.cjs file <file.html> <out.png>                render one standalone HTML file
// Fails (exit 1) on a 404 title or a blank page, and refuses two identical shots, so a broken capture is never mistaken for a page.
const path = require("path"), fs = require("fs"), http = require("http"), https = require("https"), crypto = require("crypto");
const pwPath = process.env.PLAYWRIGHT_PATH || "playwright"; const { chromium } = require(pwPath);
const [mode, a, b, c] = process.argv.slice(2);
const types = { html: "text/html", css: "text/css", js: "application/javascript", svg: "image/svg+xml", png: "image/png", json: "application/json", woff2: "font/woff2", txt: "text/plain", ico: "image/x-icon" };
async function shoot(pg, url, file) {
  await pg.goto(url, { waitUntil: "networkidle", timeout: 60000 }); await pg.waitForTimeout(800);
  const title = await pg.title(); const text = (await pg.innerText("body")).trim();
  if (/404|not found/i.test(title) || text.length < 40) throw new Error(`capture failed for ${url}: title "${title}", ${text.length} chars of text`);
  await pg.screenshot({ path: file, fullPage: false }); return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
(async () => {
  const browser = await chromium.launch(); const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    if (mode === "file") { fs.mkdirSync(path.dirname(b), { recursive: true }); await shoot(pg, "file://" + path.resolve(a), b); console.log("shot", b); }
    else {
      const outDir = a, shots = b, api = (c || "https://ethplane.ecofrontiers.xyz").replace(/\/$/, ""); fs.mkdirSync(shots, { recursive: true });
      const srv = http.createServer((req, res) => {
        const p = decodeURIComponent(req.url.split("?")[0]);
        if (p.startsWith("/api/")) { https.get(api + p, { headers: { accept: "application/json" } }, r => { res.writeHead(r.statusCode, { "content-type": r.headers["content-type"] || "application/json" }); r.pipe(res); }).on("error", () => { res.writeHead(502); res.end("{}"); }); return; }
        let f = path.join(outDir, p);
        if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = fs.existsSync(path.join(f, "index.html")) ? path.join(f, "index.html") : f + ".html";
        else if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f = f + ".html";
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { "content-type": "text/html" }); return res.end("<title>404</title>404"); }
        res.writeHead(200, { "content-type": types[f.split(".").pop()] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
      });
      await new Promise(r => srv.listen(4499, r));
      const liveNode = "0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e";
      const pages = { home: "/", docs: "/docs", deck: "/deck", node: "/node/" + liveNode };
      const hashes = {};
      for (const [name, url] of Object.entries(pages)) { hashes[name] = await shoot(pg, "http://127.0.0.1:4499" + url, path.join(shots, name + ".png")); console.log("shot", name, url); }
      const dup = Object.entries(hashes).find(([n, h], i, arr) => arr.findIndex(([m, g]) => g === h) !== i);
      srv.close(); if (dup) throw new Error(`two identical screenshots (${dup[0]}): the capture is broken`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });
