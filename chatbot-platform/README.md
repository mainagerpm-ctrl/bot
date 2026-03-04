# 🤖 Chatbot Builder

Create AI chatbots and embed them on any website.

## Requirements
- **Node.js** (v16 or newer) — free download at https://nodejs.org
- An **OpenAI API key** — get one at https://platform.openai.com/api-keys

## How to run

**On a Mac or Linux computer:**
1. Open Terminal
2. Navigate to this folder:  `cd chatbot-platform`
3. Start the server:         `node server.js`
4. Open your browser to:    http://localhost:3000

**On Windows:**
1. Open Command Prompt or PowerShell
2. Navigate to this folder:  `cd chatbot-platform`
3. Start the server:         `node server.js`
4. Open your browser to:    http://localhost:3000

## To embed on a real website (not just localhost)
You need to host this on a server so it has a public URL.
Easy free options:
- **Railway** – https://railway.app (drag & drop deploy)
- **Render**  – https://render.com (free tier available)
- **Fly.io**  – https://fly.io

Once deployed, your embed snippet will look like:
```html
<script
  src="https://your-app.railway.app/js/widget.js"
  data-bot-key="YOUR_BOT_KEY"
  data-api-base="https://your-app.railway.app">
</script>
```

## Files
- `server.js`        — the backend server
- `public/index.html`— the dashboard UI
- `public/js/widget.js` — the embed widget (goes on any website)
- `data/bots.json`   — your chatbots (auto-created)
- `data/chats.json`  — conversation history (auto-created)
