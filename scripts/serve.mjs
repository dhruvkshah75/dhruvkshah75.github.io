import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("out");
if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("Run npm run build before npm start.");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".png": "image/png" };
http.createServer((request, response) => {
  let name;
  try { name = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400).end(); return; }
  let file = path.resolve(root, `.${name}`);
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { response.writeHead(404, { "Content-Type": "text/html" }); fs.createReadStream(path.join(root, "404.html")).pipe(response); return; }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
  fs.createReadStream(file).pipe(response);
}).listen(Number(process.env.PORT || 3000), "127.0.0.1", () => console.log(`Portfolio ready at http://127.0.0.1:${process.env.PORT || 3000}`));
