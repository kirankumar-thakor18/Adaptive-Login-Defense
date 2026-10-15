# Adaptive Login Defense — Local Demo

A dependency-free Node.js learning project that demonstrates a simple defensive login flow: repeated synthetic failures trigger a temporary lockout and a static decoy page.

> **Local learning demo only.** This is not an authentication system and is not intended to protect or test a real website. Use fictional values only. Do not deploy it publicly.

## Requirements

- Node.js 18 or newer

## Run

```powershell
npm start
```

Open <http://127.0.0.1:3000>, then submit fictional values five times to trigger the 30-second lockout. Use **Reset local demo** to clear the in-memory state. To use a different port in PowerShell:

```powershell
$env:PORT = "3001"
npm start
```

The server binds only to `127.0.0.1`. Every submitted login is treated as a synthetic failure. Password values are neither logged nor saved, and the static decoy page accepts no input. Attempt state is held in memory, tracked by the connecting client address, and lost when the server stops. The reset endpoint is intentionally unauthenticated for this localhost demo.

## Tests

No package installation is needed. Run the automated HTTP tests and syntax checks with:

```powershell
npm test
npm run check
```

## Limitations

- The demo has no real user accounts or authentication.
- A client address is only a simple demo identifier; shared networks and address changes can cause incorrect grouping.
- State is not persistent and is not shared between server instances.
- The decoy is static and does not collect activity or credentials.
- The demo is not hardened for internet exposure or production use.

## Push to GitHub

Create an empty repository on GitHub, then run these commands from this project folder. Replace the URL with your repository's URL:

```powershell
git init
git add app.js test/app.test.js package.json README.md .gitignore
git commit -m "Add local adaptive login defense demo"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If this folder is already a Git repository, do not run `git init` again; check `git status` and add only the project files you intend to publish.
