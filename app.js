"use strict";

const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const ATTEMPT_LIMIT = 5;
const WINDOW_MS = 60_000;
const LOCKOUT_MS = 30_000;

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Adaptive Login Defense — Local Prototype</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #0b1220; color: #e5edf9; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
    main { width: min(100%, 460px); }
    .card { background: #121d30; border: 1px solid #263752; border-radius: 16px; padding: 28px; box-shadow: 0 18px 55px #0005; }
    .tag { color: #75e0bf; font-size: .78rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 8px 0; font-size: 1.8rem; }
    p { color: #a9bad2; line-height: 1.55; }
    label { display: block; margin: 18px 0 7px; font-weight: 600; }
    input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #344865; border-radius: 8px; color: inherit; background: #0b1423; }
    button { margin-top: 20px; width: 100%; padding: 12px; border: 0; border-radius: 8px; color: #08241d; background: #75e0bf; font-size: 1rem; font-weight: 700; cursor: pointer; }
    button.secondary { margin-top: 10px; color: #d7e4f6; background: #263752; }
    #status { min-height: 1.5em; margin-top: 16px; }
    .note { font-size: .86rem; border-top: 1px solid #263752; padding-top: 14px; margin-top: 22px; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <div class="tag">Local security lab</div>
      <h1>Adaptive login defense</h1>
      <p>This prototype treats every submitted login as a failed, synthetic attempt. After five attempts, this browser's local client address is temporarily sent to an isolated decoy page.</p>
      <form id="login">
        <label for="username">Test username</label>
        <input id="username" name="username" autocomplete="off" maxlength="120" required>
        <label for="password">Test password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" maxlength="120" required>
        <button type="submit">Simulate login attempt</button>
      </form>
      <p id="status" role="status" aria-live="polite"></p>
      <button id="reset" class="secondary" type="button">Reset local state</button>
      <p class="note">Use fictional values only. This prototype has no real authentication, stores no passwords, and listens only on this computer.</p>
    </section>
  </main>
  <script>
    const form = document.querySelector("#login");
    const status = document.querySelector("#status");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: fields.get("username"),
          password: fields.get("password")
        })
      });
      const result = await response.json();
      if (result.mode === "decoy") {
        window.location.assign("/decoy");
        return;
      }
      status.textContent = result.message;
      form.elements.password.value = "";
    });

    document.querySelector("#reset").addEventListener("click", async () => {
      const response = await fetch("/api/reset", { method: "POST" });
      const result = await response.json();
      status.textContent = result.message;
      form.reset();
    });
  </script>
</body>
</html>`;

const decoyPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Isolated Decoy — Local Prototype</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #10151d; color: #e5edf9; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
    main { max-width: 560px; padding: 30px; border: 1px solid #394252; border-radius: 16px; background: #191f2a; }
    .tag { color: #ffca78; font-size: .78rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    p { color: #bdc7d7; line-height: 1.6; }
    a { color: #8bd8ff; }
  </style>
</head>
<body>
  <main>
    <div class="tag">Isolated prototype decoy</div>
    <h1>This is not a real sign-in page</h1>
    <p>The local prototype reached its attempt limit. This page is static and does not accept or collect credentials or other input.</p>
    <p>To continue testing after the temporary lockout, return to the <a href="/">local prototype</a> and choose “Reset local state.”</p>
  </main>
</body>
</html>`;

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  response.end(contentType.startsWith("application/json") ? JSON.stringify(body) : body);
}

function clientState(address, now, clients) {
  let state = clients.get(address);
  if (
    !state ||
    (state.blockedUntil > 0 && now >= state.blockedUntil) ||
    now - state.windowStartedAt >= WINDOW_MS
  ) {
    state = { attempts: 0, windowStartedAt: now, blockedUntil: 0 };
    clients.set(address, state);
  }
  return state;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > 4096) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new SyntaxError("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function createServer() {
  const clients = new Map();

  return http.createServer(async (request, response) => {
    const address = request.socket.remoteAddress || "unknown";
    const now = Date.now();

    if (request.method === "GET" && request.url === "/") {
      send(response, 200, page, "text/html; charset=utf-8");
      return;
    }

    if (request.method === "GET" && request.url === "/decoy") {
      const state = clients.get(address);
      if (!state || state.blockedUntil <= now) {
        response.writeHead(303, { Location: "/" });
        response.end();
        return;
      }
      send(response, 200, decoyPage, "text/html; charset=utf-8");
      return;
    }

    if (request.method === "POST" && request.url === "/api/reset") {
      clients.delete(address);
      send(response, 200, { message: "Local prototype state reset." });
      return;
    }

    if (request.method === "POST" && request.url === "/api/login") {
      let data;
      try {
        data = await readJson(request);
      } catch (error) {
        if (!response.destroyed && !response.headersSent) {
          const tooLarge = error.message === "Request body too large";
          send(response, tooLarge ? 413 : 400, {
            message: tooLarge ? "Request body is too large." : "Send valid JSON."
          });
        }
        return;
      }

      if (
        !data ||
        typeof data.username !== "string" ||
        typeof data.password !== "string" ||
        data.username.trim().length === 0 ||
        data.password.length === 0 ||
        data.username.length > 120 ||
        data.password.length > 120
      ) {
        send(response, 400, { message: "Enter test values of 120 characters or fewer." });
        return;
      }

      const state = clientState(address, now, clients);
      if (state.blockedUntil > now) {
        send(response, 429, { mode: "decoy", message: "Temporary prototype lockout is active." });
        return;
      }

      state.attempts += 1;
      if (state.attempts >= ATTEMPT_LIMIT) {
        state.blockedUntil = now + LOCKOUT_MS;
        send(response, 429, { mode: "decoy", message: "Attempt limit reached." });
        return;
      }

      send(response, 401, {
        mode: "observe",
        message: `Synthetic login failed. ${ATTEMPT_LIMIT - state.attempts} attempt(s) remain before the prototype lockout.`
      });
      return;
    }

    send(response, 404, { message: "Not found." });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Local prototype listening at http://${HOST}:${PORT}`);
  });

  server.on("error", (error) => {
    console.error("Could not start local prototype:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { createServer };
