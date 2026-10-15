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
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #080d18;
      color: #eef3ff;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      --muted: #9ba9c2;
      --line: rgba(172, 190, 224, .14);
      --mint: #70e2c0;
    }
    * { box-sizing: border-box; }
    body {
      min-width: 320px;
      min-height: 100vh;
      margin: 0;
      padding: 28px;
      background:
        radial-gradient(ellipse at 14% 8%, rgba(52, 111, 139, .18), transparent 38%),
        radial-gradient(ellipse at 88% 85%, rgba(79, 71, 143, .16), transparent 38%),
        #080d18;
    }
    button, input { font: inherit; }
    .shell { width: min(100%, 1040px); margin: 0 auto; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 52px; }
    .brand { display: flex; align-items: center; gap: 12px; color: #f4f7ff; font-size: .95rem; font-weight: 700; letter-spacing: -.02em; }
    .brand-mark { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid rgba(112, 226, 192, .24); border-radius: 12px; background: rgba(112, 226, 192, .09); color: var(--mint); }
    .local-pill { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; color: #bdc9dd; background: rgba(18, 27, 44, .75); font-size: .78rem; }
    .local-pill::before { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); box-shadow: 0 0 12px rgba(112, 226, 192, .65); content: ""; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, .82fr); align-items: center; gap: clamp(40px, 8vw, 92px); }
    .intro { padding: 10px 0; }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; color: var(--mint); font-size: .75rem; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
    .eyebrow-mark { width: 20px; height: 1px; background: var(--mint); }
    h1 { max-width: 520px; margin: 19px 0 18px; font-size: clamp(2.8rem, 6vw, 4.8rem); font-weight: 650; letter-spacing: -.065em; line-height: .99; }
    h1 span { color: var(--mint); }
    .intro-copy { max-width: 440px; margin: 0; color: var(--muted); font-size: 1.05rem; line-height: 1.75; }
    .feature-list { display: grid; gap: 14px; margin: 34px 0 0; padding: 0; list-style: none; }
    .feature-list li { display: flex; align-items: center; gap: 11px; color: #cad4e6; font-size: .91rem; }
    .check { display: grid; flex: 0 0 22px; width: 22px; height: 22px; place-items: center; border: 1px solid rgba(112, 226, 192, .22); border-radius: 50%; color: var(--mint); background: rgba(112, 226, 192, .07); font-size: .76rem; }
    .card { overflow: hidden; border: 1px solid rgba(174, 194, 229, .17); border-radius: 20px; background: linear-gradient(145deg, rgba(22, 32, 51, .98), rgba(14, 22, 37, .98)); box-shadow: 0 28px 90px rgba(0, 0, 0, .34), inset 0 1px rgba(255, 255, 255, .035); }
    .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 26px 28px 22px; border-bottom: 1px solid var(--line); }
    .card-kicker { margin: 0 0 6px; color: var(--muted); font-size: .8rem; }
    h2 { margin: 0; font-size: 1.2rem; letter-spacing: -.025em; }
    .lock-icon { display: grid; flex: 0 0 42px; width: 42px; height: 42px; place-items: center; border: 1px solid var(--line); border-radius: 13px; color: var(--mint); background: rgba(112, 226, 192, .06); }
    .card-body { padding: 24px 28px 26px; }
    .field { margin-bottom: 18px; }
    label { display: block; margin-bottom: 8px; color: #e4eaf6; font-size: .86rem; font-weight: 600; }
    input { display: block; width: 100%; height: 48px; border: 1px solid rgba(161, 181, 217, .2); border-radius: 10px; outline: none; padding: 0 14px; color: #f3f6ff; background: rgba(7, 13, 24, .66); transition: border-color .18s, box-shadow .18s, background .18s; }
    input::placeholder { color: #697892; }
    input:hover { border-color: rgba(161, 181, 217, .34); }
    input:focus-visible { border-color: var(--mint); background: rgba(7, 13, 24, .9); box-shadow: 0 0 0 3px rgba(112, 226, 192, .12); }
    .password-wrap { position: relative; }
    .password-wrap input { padding-right: 74px; }
    .password-toggle { position: absolute; top: 50%; right: 7px; transform: translateY(-50%); border: 0; border-radius: 7px; padding: 7px 9px; color: #a9b7ce; background: transparent; font-size: .76rem; cursor: pointer; }
    .password-toggle:hover { color: #f2f6ff; background: rgba(255, 255, 255, .06); }
    button:focus-visible, a:focus-visible { outline: 2px solid var(--mint); outline-offset: 3px; }
    .primary, .secondary { display: inline-flex; width: 100%; min-height: 48px; align-items: center; justify-content: center; gap: 9px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: transform .16s, background .16s, border-color .16s, opacity .16s; }
    .primary { margin-top: 5px; border: 1px solid #80eccb; color: #082119; background: linear-gradient(115deg, #83ebcb, #62d9b5); box-shadow: 0 7px 20px rgba(83, 208, 170, .13); }
    .primary:hover:not(:disabled) { transform: translateY(-1px); background: linear-gradient(115deg, #9af2d8, #75e5c2); }
    .secondary { min-height: 42px; margin-top: 10px; border: 1px solid var(--line); color: #bdc9dd; background: rgba(255, 255, 255, .025); font-size: .86rem; }
    .secondary:hover:not(:disabled) { border-color: rgba(172, 190, 224, .3); color: white; background: rgba(255, 255, 255, .055); }
    button:disabled { opacity: .6; cursor: wait; }
    .spinner { width: 15px; height: 15px; border: 2px solid rgba(8, 33, 25, .3); border-top-color: #082119; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .attempts { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 18px; color: var(--muted); font-size: .76rem; }
    .attempt-dots { display: flex; gap: 5px; }
    .attempt-dot { width: 18px; height: 4px; border-radius: 9px; background: rgba(161, 181, 217, .18); transition: background .2s; }
    .attempt-dot.used { background: #e3a85f; }
    #status { display: none; margin: 16px 0 0; border: 1px solid transparent; border-radius: 9px; padding: 11px 12px; font-size: .84rem; line-height: 1.5; }
    #status.visible { display: block; }
    #status[data-kind="info"] { border-color: rgba(106, 171, 231, .22); color: #bfdcff; background: rgba(48, 106, 162, .12); }
    #status[data-kind="success"] { border-color: rgba(112, 226, 192, .22); color: #a8f0d8; background: rgba(48, 151, 116, .12); }
    #status[data-kind="error"] { border-color: rgba(236, 126, 126, .24); color: #ffc0bd; background: rgba(160, 52, 52, .12); }
    .privacy-note { display: flex; align-items: flex-start; gap: 9px; margin: 19px 0 0; color: #8795ad; font-size: .76rem; line-height: 1.55; }
    .privacy-note svg { flex: 0 0 15px; margin-top: 1px; color: #92a2bb; }
    .footer { margin-top: 54px; color: #65738b; font-size: .76rem; text-align: center; }
    @media (max-width: 760px) {
      body { padding: 20px; }
      .topbar { margin-bottom: 40px; }
      .layout { max-width: 520px; grid-template-columns: 1fr; gap: 30px; margin: 0 auto; }
      .intro { padding: 0; }
      h1 { max-width: 480px; margin-top: 13px; font-size: clamp(2.7rem, 11vw, 4rem); }
      .intro-copy { font-size: .96rem; }
      .feature-list { display: none; }
      .footer { margin-top: 36px; }
    }
    @media (max-width: 420px) {
      body { padding: 16px; }
      .topbar { margin-bottom: 34px; }
      .brand { font-size: .86rem; }
      .brand-mark { width: 34px; height: 34px; }
      .local-pill { padding: 7px 9px; font-size: .7rem; }
      .card-head { padding: 22px 20px 18px; }
      .card-body { padding: 20px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M12 3 19 6v5.4c0 4.6-3 7.7-7 9.6-4-1.9-7-5-7-9.6V6l7-3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span>Adaptive Login Defense</span>
      </div>
      <span class="local-pill">Local prototype</span>
    </header>
    <div class="layout">
      <section class="intro" aria-labelledby="page-title">
        <div class="eyebrow"><span class="eyebrow-mark"></span> Security learning project</div>
        <h1 id="page-title">Spot the signal.<br><span>Protect the login.</span></h1>
        <p class="intro-copy">Explore how a login flow can respond to repeated failed attempts with a temporary lockout and an isolated decoy.</p>
        <ul class="feature-list" aria-label="Prototype features">
          <li><span class="check" aria-hidden="true">✓</span> Adaptive attempt limit</li>
          <li><span class="check" aria-hidden="true">✓</span> Isolated, static decoy page</li>
          <li><span class="check" aria-hidden="true">✓</span> Runs only on this computer</li>
        </ul>
      </section>
      <section class="card" aria-labelledby="form-title">
        <div class="card-head">
          <div>
            <p class="card-kicker">Interactive walkthrough</p>
            <h2 id="form-title">Simulate a login</h2>
          </div>
          <span class="lock-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </span>
        </div>
        <div class="card-body">
          <div class="attempts">
            <span id="attempt-label">5 attempts until lockout</span>
            <span class="attempt-dots" aria-hidden="true">
              <span class="attempt-dot"></span><span class="attempt-dot"></span><span class="attempt-dot"></span><span class="attempt-dot"></span><span class="attempt-dot"></span>
            </span>
          </div>
          <form id="login">
            <div class="field">
              <label for="username">Test username</label>
              <input id="username" name="username" autocomplete="off" maxlength="120" placeholder="e.g. learner01" required>
            </div>
            <div class="field">
              <label for="password">Test password</label>
              <div class="password-wrap">
                <input id="password" name="password" type="password" autocomplete="new-password" maxlength="120" placeholder="Use a fictional value" required>
                <button id="password-toggle" class="password-toggle" type="button" aria-controls="password" aria-pressed="false">Show</button>
              </div>
            </div>
            <button id="submit" class="primary" type="submit">Simulate login attempt <span aria-hidden="true">→</span></button>
          </form>
          <p id="status" role="status" aria-live="polite" aria-atomic="true"></p>
          <button id="reset" class="secondary" type="button">Reset local state</button>
          <p class="privacy-note">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 19 6v5.4c0 4.6-3 7.7-7 9.6-4-1.9-7-5-7-9.6V6l7-3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Use fictional values only. This prototype has no real authentication and does not save passwords.
          </p>
        </div>
      </section>
    </div>
    <footer class="footer">A local learning prototype · Not intended for production use</footer>
  </main>
  <script>
    const form = document.querySelector("#login");
    const status = document.querySelector("#status");
    const submitButton = document.querySelector("#submit");
    const resetButton = document.querySelector("#reset");
    const attemptLabel = document.querySelector("#attempt-label");
    const attemptDots = [...document.querySelectorAll(".attempt-dot")];

    function setStatus(message, kind) {
      status.textContent = message;
      status.dataset.kind = kind;
      status.classList.add("visible");
    }

    function setBusy(busy, action) {
      submitButton.disabled = busy;
      resetButton.disabled = busy;
      form.setAttribute("aria-busy", String(busy));
      submitButton.innerHTML = busy && action === "submit"
        ? '<span class="spinner" aria-hidden="true"></span>Checking attempt…'
        : 'Simulate login attempt <span aria-hidden="true">→</span>';
      resetButton.textContent = busy && action === "reset" ? "Resetting…" : "Reset local state";
    }

    function updateAttempts(remaining) {
      const used = Math.max(0, Math.min(attemptDots.length, attemptDots.length - remaining));
      attemptDots.forEach((dot, index) => dot.classList.toggle("used", index < used));
      attemptLabel.textContent = remaining === 1
        ? "1 attempt until lockout"
        : remaining + " attempts until lockout";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      setBusy(true, "submit");
      try {
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
          setStatus("Attempt limit reached. Opening the isolated decoy…", "error");
          window.location.assign("/decoy");
          return;
        }
        if (response.status !== 401) {
          throw new Error(result.message || "The request could not be completed.");
        }
        updateAttempts(result.remainingAttempts);
        setStatus(result.message, "info");
        form.elements.password.value = "";
      } catch (error) {
        setStatus(error.message || "Could not reach the local server. Check that it is running and try again.", "error");
      } finally {
        setBusy(false);
      }
    });

    resetButton.addEventListener("click", async () => {
      setBusy(true, "reset");
      try {
        const response = await fetch("/api/reset", { method: "POST" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Could not reset local state.");
        }
        updateAttempts(attemptDots.length);
        setStatus(result.message, "success");
        form.reset();
        form.elements.password.type = "password";
        document.querySelector("#password-toggle").textContent = "Show";
        document.querySelector("#password-toggle").setAttribute("aria-pressed", "false");
      } catch (error) {
        setStatus(error.message || "Could not reach the local server. Check that it is running and try again.", "error");
      } finally {
        setBusy(false);
      }
    });

    document.querySelector("#password-toggle").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const password = form.elements.password;
      const visible = password.type === "password";
      password.type = visible ? "text" : "password";
      button.textContent = visible ? "Hide" : "Show";
      button.setAttribute("aria-pressed", String(visible));
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
        message: `Synthetic login failed. ${ATTEMPT_LIMIT - state.attempts} attempt(s) remain before the prototype lockout.`,
        remainingAttempts: ATTEMPT_LIMIT - state.attempts
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
