# Hosting guide

## GitHub vs Vercel

| | GitHub | Vercel |
|---|--------|--------|
| Purpose | Stores your **code** (backup, history) | **Runs** the website |
| URL | No app URL | `https://your-app.vercel.app` |
| Mobile anywhere | No | Yes |
| Saves data | No (unless you commit JSON manually) | Yes, with Blob storage |

**Use both:** push code to **GitHub**, deploy from GitHub to **Vercel**.

This app cannot save on Vercel with file storage alone (read-only filesystem). Enable **Vercel Blob** for persistence.

## Fix "Internal Server Error"

### On your PC (local)

1. Stop all old dev servers (`Ctrl+C` in terminals).
2. Start fresh:
   ```powershell
   cd "C:\Users\phtan\OneDrive\Documents\Cursor\net-worth-tracker"
   npm run dev
   ```
3. Open the URL printed in the terminal — default is **http://localhost:3020** (not 3000).
4. On your phone (same Wi‑Fi), use the **Network** line, e.g. `http://192.168.68.53:3020`.

If port 3000 shows an error, another app is using it — ignore 3000 and use 3020.

### On Vercel

1. Vercel project → **Storage** → **Connect Blob**.
2. Redeploy (env var `BLOB_READ_WRITE_TOKEN` is added automatically).
3. Without Blob, the dashboard may load but **saving** returns 500.

## Deploy to Vercel (summary)

1. Push `net-worth-tracker` to a **private** GitHub repo.
2. [vercel.com](https://vercel.com) → Import repo → Root directory: `net-worth-tracker` (if monorepo) or repo root.
3. Add **Blob** storage in the project.
4. Deploy → open your `.vercel.app` URL on phone or desktop.

`data/finance.json` in git is the initial seed; after deploy, live data lives in Blob.
