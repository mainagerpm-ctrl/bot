/**
 * Chatbot Builder Platform – Server
 * Pure Node.js, zero external dependencies.
 * Run: node server.js
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const https  = require('https');

const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'bots.json');
const CHATS_FILE = path.join(__dirname, 'data', 'chats.json');

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadJSON(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function uid() {
  return crypto.randomBytes(16).toString('hex');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function parseFormData(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const result = {};
      body.split('&').forEach(pair => {
        const [k, v] = pair.split('=').map(decodeURIComponent);
        if (k) result[k] = v || '';
      });
      resolve(result);
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function json(res, data, status = 200, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

// ── OpenAI proxy ─────────────────────────────────────────────────────────────

function callOpenAI(apiKey, messages, model, temperature, instructions) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: model || 'gpt-4o-mini',
      temperature: parseFloat(temperature) || 0.7,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: instructions || 'You are a helpful assistant.' },
        ...messages
      ]
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) return reject(new Error(data.error.message));
          resolve(data.choices[0].message.content);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Data access ──────────────────────────────────────────────────────────────

function getBots()          { return loadJSON(DATA_FILE, {}); }
function saveBots(bots)     { saveJSON(DATA_FILE, bots); }
function getChats()         { return loadJSON(CHATS_FILE, {}); }
function saveChats(chats)   { saveJSON(CHATS_FILE, chats); }

function getBot(key) {
  const bots = getBots();
  return Object.values(bots).find(b => b.key === key) || null;
}

function getBotById(id) {
  const bots = getBots();
  return bots[id] || null;
}

// ── Router ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, 'http://localhost');
  const method = req.method;
  const p      = url.pathname;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ── Static files ──────────────────────────────────────────────────────────

  if (p === '/' || p === '/index.html') {
    return serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html');
  }
  if (p.startsWith('/css/')) {
    return serveFile(res, path.join(__dirname, 'public', p), 'text/css');
  }
  if (p.startsWith('/js/')) {
    return serveFile(res, path.join(__dirname, 'public', p), 'application/javascript');
  }

  // ── Admin API: list bots ──────────────────────────────────────────────────
  if (p === '/api/bots' && method === 'GET') {
    const bots = getBots();
    // Strip API keys before sending to frontend
    const safe = Object.values(bots).map(b => ({ ...b, api_key: b.api_key ? '••••' + b.api_key.slice(-4) : '' }));
    return json(res, safe);
  }

  // ── Admin API: create bot ─────────────────────────────────────────────────
  if (p === '/api/bots' && method === 'POST') {
    const body = await readBody(req);
    const id   = uid();
    const key  = uid();
    const bot  = {
      id,
      key,
      name:           body.name           || 'My Chatbot',
      instructions:   body.instructions   || 'You are a helpful assistant.',
      welcome_msg:    body.welcome_msg     || 'Hello! How can I help you?',
      model:          body.model           || 'gpt-4o-mini',
      temperature:    parseFloat(body.temperature) || 0.7,
      api_key:        body.api_key         || '',
      widget_color:   body.widget_color    || '#6366f1',
      widget_pos:     body.widget_pos      || 'bottom-right',
      allowed_origins: body.allowed_origins || '',
      created_at:     new Date().toISOString()
    };
    const bots = getBots();
    bots[id] = bot;
    saveBots(bots);
    return json(res, { ...bot, api_key: '••••' + bot.api_key.slice(-4) }, 201);
  }

  // ── Admin API: get single bot ─────────────────────────────────────────────
  const botMatch = p.match(/^\/api\/bots\/([a-f0-9]{32})$/);
  if (botMatch && method === 'GET') {
    const bot = getBotById(botMatch[1]);
    if (!bot) return json(res, { error: 'Not found' }, 404);
    return json(res, { ...bot, api_key: bot.api_key ? '••••' + bot.api_key.slice(-4) : '' });
  }

  // ── Admin API: update bot ─────────────────────────────────────────────────
  if (botMatch && method === 'PUT') {
    const body = await readBody(req);
    const bots = getBots();
    const bot  = bots[botMatch[1]];
    if (!bot) return json(res, { error: 'Not found' }, 404);

    const updated = {
      ...bot,
      name:            body.name           ?? bot.name,
      instructions:    body.instructions   ?? bot.instructions,
      welcome_msg:     body.welcome_msg    ?? bot.welcome_msg,
      model:           body.model          ?? bot.model,
      temperature:     body.temperature !== undefined ? parseFloat(body.temperature) : bot.temperature,
      widget_color:    body.widget_color   ?? bot.widget_color,
      widget_pos:      body.widget_pos     ?? bot.widget_pos,
      allowed_origins: body.allowed_origins ?? bot.allowed_origins,
      // Only update api_key if a real key is provided (not a masked value)
      api_key: body.api_key && !body.api_key.startsWith('••••') ? body.api_key : bot.api_key
    };

    bots[botMatch[1]] = updated;
    saveBots(bots);
    return json(res, { ...updated, api_key: updated.api_key ? '••••' + updated.api_key.slice(-4) : '' });
  }

  // ── Admin API: delete bot ─────────────────────────────────────────────────
  if (botMatch && method === 'DELETE') {
    const bots = getBots();
    if (!bots[botMatch[1]]) return json(res, { error: 'Not found' }, 404);
    delete bots[botMatch[1]];
    saveBots(bots);
    return json(res, { success: true });
  }

  // ── Embed API: bot info (called by widget on any site) ────────────────────
  const embedInfoMatch = p.match(/^\/embed\/([a-f0-9]{32})\/info$/);
  if (embedInfoMatch && method === 'GET') {
    const bot = getBot(embedInfoMatch[1]);
    if (!bot) return json(res, { error: 'Bot not found' }, 404);

    // Check allowed origins
    const origin = req.headers.origin || '';
    if (bot.allowed_origins) {
      const allowed = bot.allowed_origins.split(',').map(s => s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(origin)) {
        return json(res, { error: 'Origin not allowed' }, 403);
      }
    }

    return json(res, {
      name:         bot.name,
      welcome_msg:  bot.welcome_msg,
      widget_color: bot.widget_color,
      widget_pos:   bot.widget_pos,
    });
  }

  // ── Embed API: send message ───────────────────────────────────────────────
  const embedMsgMatch = p.match(/^\/embed\/([a-f0-9]{32})\/message$/);
  if (embedMsgMatch && method === 'POST') {
    const bot = getBot(embedMsgMatch[1]);
    if (!bot) return json(res, { error: 'Bot not found' }, 404);

    if (!bot.api_key) return json(res, { error: 'This chatbot has no API key configured.' }, 500);

    const body      = await readBody(req);
    const userMsg   = (body.message || '').slice(0, 2000);
    const sessionId = body.session_id || uid();

    if (!userMsg) return json(res, { error: 'No message provided' }, 400);

    // Load conversation history
    const chats = getChats();
    if (!chats[sessionId]) chats[sessionId] = { bot_key: bot.key, messages: [], created_at: new Date().toISOString() };
    const history = chats[sessionId].messages;
    history.push({ role: 'user', content: userMsg });
    if (history.length > 20) history.splice(0, history.length - 20);

    try {
      const reply = await callOpenAI(bot.api_key, history, bot.model, bot.temperature, bot.instructions);
      history.push({ role: 'assistant', content: reply });
      chats[sessionId].messages = history;
      chats[sessionId].last_activity = new Date().toISOString();
      saveChats(chats);
      return json(res, { message: reply, session_id: sessionId });
    } catch (err) {
      console.error('OpenAI error:', err.message);
      return json(res, { error: 'AI error: ' + err.message }, 500);
    }
  }

  // ── Admin API: list conversations ─────────────────────────────────────────
  if (p === '/api/chats' && method === 'GET') {
    const chats = getChats();
    const list  = Object.entries(chats).map(([id, c]) => ({ session_id: id, ...c }));
    list.sort((a, b) => new Date(b.last_activity || 0) - new Date(a.last_activity || 0));
    return json(res, list.slice(0, 100));
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  res.writeHead(404);
  res.end('Not found');
});

// ── Start ────────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
if (!fs.existsSync(DATA_FILE))  fs.writeFileSync(DATA_FILE,  '{}');
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, '{}');

server.listen(PORT, () => {
  console.log(`\n🤖 Chatbot Builder running at http://localhost:${PORT}\n`);
});
