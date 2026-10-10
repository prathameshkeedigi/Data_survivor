# Deploying DATA SURVIVOR

**For:** whoever puts the game online (club leads / tech team). About 15 minutes per option.

The app is **one Node.js server** that serves the website and holds the live connections. The same code runs everywhere; only settings change.

## Requirements (any host)

| Must have | Why |
|---|---|
| Runs a **long-lived** process (Docker or Node 22) | Serverless platforms (Vercel, Netlify) can't keep 400 live connections. |
| **WebSockets** allowed | Live updates. Plain HTTP works as a fallback, but slower. |
| **Exactly 1 instance**, autoscaling **off** | The game lives in one server's memory. |
| **HTTPS** URL | Phones' Share button and trust when people scan the QR code. |
| Setting `HOST_PASSWORD` (8+ characters, not guessable) | Protects `/host`. |

**Optional settings:**
- `QUESTION_MS`: seconds per question × 1000. Default 20000.
- `FINALE_MS`: the same for the finale. Default 25000.

`PORT` is set automatically by most hosts.

After deploying, open `https://<your-url>/health`. You should see `{"ok":true,...}`.

---

## Option A: AWS EC2 (preferred if credits are available)

1. **Launch an instance:**
   - Region **Mumbai (ap-south-1)**, **Ubuntu 24.04**, type **t3.small**.
   - Security group: allow **80** and **443** from anywhere, and **22** from your IP only.
2. **SSH in and run:**
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io git caddy
   git clone https://github.com/prathameshkeedigi/Data_survivor.git && cd Data_survivor
   sudo docker build -t data-survivor .
   sudo docker run -d --name ds --restart unless-stopped -p 127.0.0.1:3000:3000 \
     -e HOST_PASSWORD='CHANGE-ME-long-password' data-survivor
   ```
3. **Set up HTTPS with Caddy.** It gets the certificate automatically.
   - If you have a domain, point an `A` record (e.g. `play.yourclub.in`) at the instance's public IP.
   - If you don't, use `<ip-with-dashes>.sslip.io` (e.g. `13-233-10-20.sslip.io`).
   ```bash
   echo 'play.yourclub.in {
     reverse_proxy 127.0.0.1:3000
   }' | sudo tee /etc/caddy/Caddyfile
   sudo systemctl restart caddy
   ```
4. **To update after a code change** (never after Monday's final reset):
   ```bash
   cd Data_survivor && git pull && sudo docker build -t data-survivor . && sudo docker rm -f ds && sudo docker run -d --name ds --restart unless-stopped -p 127.0.0.1:3000:3000 -e HOST_PASSWORD='...' data-survivor
   ```

## Option B: Railway (default if AWS isn't available)

1. Go to railway.com, sign in with GitHub, then **New Project → Deploy from GitHub repo → Data_survivor**. It finds the `Dockerfile` automatically.
2. Open the service:
   - **Variables:** add `HOST_PASSWORD`.
   - **Settings:**
     - Region: **Southeast Asia (Singapore)**.
     - Replicas: **1**.
     - Networking: **Generate Domain**.
   - Health check path: `/health`.
3. Wait for the deploy to show **Active**, then open `/health`.

## Option C: Render (standby)

1. Go to render.com, then **New → Web Service → connect the GitHub repo**.
2. Configure it:
   - Runtime: **Docker**.
   - Region: **Singapore**.
   - Instance: Free (or Starter).
   - Health check path `/health`.
3. Under **Environment**, add `HOST_PASSWORD`.

On the **free** plan, the server sleeps after 15 minutes with no visitors and takes about a minute to wake up. **Open `/screen` 15 minutes before the event and leave it open**: its live connection keeps the server awake.

---

## Before the event: load test your deployment

Run this from any laptop with the repo cloned and `npm ci` done:

```bash
npx tsx scripts/swarm.ts --url https://<your-url> --password '<HOST_PASSWORD>' --n 500 --reset
```

It joins 500 fake phones, plays a whole game, and prints PASS/FAIL for:
- lost or duplicated answers,
- late answers,
- attacks,
- speed,
- server load.

`--reset` **wipes the game**. Never run it once the real audience has joined.

## Projector check without a game

`https://<your-url>/screen?preview=1` (through `4`) shows each data-moment chart with simulated data. Use it to check how the charts look on the venue projector.
