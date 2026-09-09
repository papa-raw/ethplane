// shoot.cjs: screenshots for the swarm and the gate. Two modes:
//   node shoot.cjs export <out-dir> <shots-dir> [api-base]   serve a Next static export ($uri, $uri.html, $uri/index.html;
//                                                            /api/* proxied to api-base, default https://ethplane.ecofrontiers.xyz)
//                                                            and shoot home, docs, deck and a live node page at 1440px
//   node shoot.cjs file <file.html> <out.png>                render one standalone HTML file
//   node shoot.cjs deck <out-dir> <shots-dir> [api-base]     serve the export and shoot every deck
//                                                            screen, pressing ArrowRight between
//                                                            them, as deck-01.png … deck-NN.png
// Fails (exit 1) on a 404 title or a blank page, and refuses two identical shots, so a broken capture is never mistaken for a page.
const path = require("path"), fs = require("fs"), http = require("http"), https = require("https"), crypto = require("crypto");
const pwPath = process.env.PLAYWRIGHT_PATH || "playwright"; const { chromium } = require(pwPath);
const [mode, a, b, c] = process.argv.slice(2);
const types = { html: "text/html", css: "text/css", js: "application/javascript", svg: "image/svg+xml", png: "image/png", json: "application/json", woff2: "font/woff2", txt: "text/plain", ico: "image/x-icon" };
async function shoot(pg, url, file, navigate = true) {
  if (navigate) { await pg.goto(url, { waitUntil: "networkidle", timeout: 60000 }); await pg.waitForTimeout(800); }
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
      const nodeDir = path.join(outDir, "node"); const nodeFiles = fs.existsSync(nodeDir) ? fs.readdirSync(nodeDir).filter(f => f.endsWith(".html")) : [];
      const nodeId = nodeFiles.includes(liveNode + ".html") ? liveNode : (nodeFiles[0] || "").replace(/\.html$/, "");
      if (mode === "deck") {
        // Every screen, not just the first: the deck is one route and nine of its ten screens are
        // invisible to a reviewer who only has the landing shot.
        await pg.goto("http://127.0.0.1:4499/deck", { waitUntil: "networkidle", timeout: 60000 });
        await pg.waitForTimeout(600);
        const total = await pg.evaluate(() => document.querySelectorAll("[data-screen]").length) ||
                      Number((await pg.innerText("body")).match(/\/\s*(\d+)/)?.[1] || 0);
        if (!total) throw new Error("deck: could not count the screens");
        const seen = {};
        for (let i = 1; i <= total; i++) {
          const file = path.join(shots, `deck-${String(i).padStart(2, "0")}.png`);
          const h = await shoot(pg, pg.url(), file, false); console.log("shot", `deck-${i}/${total}`);
          if (seen[h]) throw new Error(`deck screen ${i} is identical to screen ${seen[h]}: the arrow key did not advance`);
          seen[h] = i;
          if (i < total) { await pg.keyboard.press("ArrowRight"); await pg.waitForTimeout(400); }
        }
        srv.close(); await browser.close(); return;
      }
      const pages = { home: "/", docs: "/docs", deck: "/deck", join: "/join", ...(nodeId ? { node: "/node/" + nodeId } : {}) };
      const hashes = {};
      for (const [name, url] of Object.entries(pages)) { hashes[name] = await shoot(pg, "http://127.0.0.1:4499" + url, path.join(shots, name + ".png")); console.log("shot", name, url); }
      const dup = Object.entries(hashes).find(([n, h], i, arr) => arr.findIndex(([m, g]) => g === h) !== i);
      srv.close(); if (dup) throw new Error(`two identical screenshots (${dup[0]}): the capture is broken`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });
