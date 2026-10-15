# Pasal

Stock and sales for a small shop. Three tabs:

- **Record**: type, speak (Audio tab) or snap a photo of what happened. Gemma (via Google AI Studio) reads it and works out whether it's a sale or stock coming in. You check the items, flip Sale / Stock in if it guessed wrong, and save. Recent entries show below with Undo.
- **Stock**: what's left, what's running low, and what the stock is worth.
- **Insights**: daily revenue and profit/loss charts for 30 days, Ask Gemma, then what to reorder, best sellers, and stock that isn't selling.

Your data stays in one SQLite file (`data/shop.db`). Only photos, notes and questions go to Gemma.

## Run it

Needs Node 24+.

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY, APP_PIN, SESSION_SECRET
npm run seed                 # optional: 30 days of demo data
npm run dev
```

Open http://localhost:3000. On a computer, a QR code shows the address to open on your phone (same Wi-Fi).

| Command | What it does |
|---|---|
| `npm test` | Parser, stock ledger and insights checks against a throwaway DB |
| `npm run seed` | Demo data; refuses to touch a DB that already has products |
| `npm run build && npm start` | Production server |

## How it works

- **Stock is a ledger.** `movements` holds +qty for stock in and −qty for sales. Stock is their sum, so it never drifts, and **Undo** in History deletes an entry and its movements.
- **Audio** uses the browser's speech recognition (Chrome, Safari) because Gemma on AI Studio doesn't accept audio. It needs HTTPS or localhost; on plain shop Wi-Fi the Audio tab points you to the keyboard mic instead.
- **AI suggests, the owner confirms.** Gemma's reply is validated (`lib/gemma.ts`) and shown for review. Nothing is saved until you press Save.
- **Profit uses the cost at the time of sale**, not today's cost.
- **Security:** a PIN unlocks each device for a year. Changing `APP_PIN` signs everyone out. Ten wrong PINs in 15 minutes lock login (devices already signed in keep working). Every server action checks the session.

## Deploy (Render)

`render.yaml` sets up a Starter web service with a 1 GB persistent disk at `/var/data`. SQLite needs a disk that survives restarts, and Render's free tier has none.

1. Push to GitHub. In Render, go to **New → Blueprint** and pick the repo.
2. Fill in `GEMINI_API_KEY` and `APP_PIN` when asked. `SESSION_SECRET` is generated for you.
3. Open the `onrender.com` URL on your phone. It's HTTPS, so it works from anywhere, not only on shop Wi-Fi.

Render snapshots persistent disks daily, so the shop data can be restored from the dashboard.
