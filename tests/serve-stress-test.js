const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = 8080;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

http.createServer((request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  const relativePath = requestUrl.pathname === "/"
    ? "stress-test.html"
    : decodeURIComponent(requestUrl.pathname.slice(1));
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`壓測頁本機預覽：http://127.0.0.1:${port}/stress-test.html`);
  console.log("按 Ctrl+C 停止預覽伺服器");
});
