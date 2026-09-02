
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../out");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

const server = http.createServer((req, res) => {
  try {
    const parsed = new URL(req.url, "http://localhost:3555");
    let p = parsed.pathname;
    if (p === "/") p = "/index.html";
    let target = path.join(OUT, p);

    if (fs.existsSync(target + ".html") && (!fs.existsSync(target) || fs.statSync(target).isDirectory())) {
      target = target + ".html";
    } else if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      if (fs.existsSync(path.join(target, "index.html"))) {
        target = path.join(target, "index.html");
      }
    }

    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      const ext = path.extname(target);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(target).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  } catch (err) {
    res.writeHead(500);
    res.end(err.message);
  }
});

server.listen(3555, () => console.log("Test server running at http://localhost:3555"));
