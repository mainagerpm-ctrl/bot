/**
 * Chatbot Builder Dashboard – Frontend JS
 */

const API = '';  // same origin

// ── State ────────────────────────────────────────────────────────────────────
let bots = [];
let editingBotId = null;
let embedSnippet = '';

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadBots();
});

// ── Section navigation ────────────────────────────────────────────────────────
function showSection(name, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  el.classList.add('active');
  if (name === 'chats') loadChats();
}

// ── Bots ─────────────────────────────────────────────────────────────────────
async function loadBots() {
  try {
    const res  = await fetch(API + '/api/bots');
    bots       = await res.json();
    renderBots();
  } catch (e) {
    console.error(e);
    showToast('Could not connect to server');
  }
}

function renderBots() {
  const container = document.getElementById('bots-container');

  if (!bots.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤖</div>
        <div class="empty-title">No chatbots yet</div>
        <div class="empty-sub">Create your first chatbot and embed it anywhere</div>
        <button class="btn btn-primary" onclick="openCreateModal()">Create Your First Chatbot</button>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="bot-grid">${bots.map(botCard).join('')}</div>`;
}

function botCard(bot) {
  const color = bot.widget_color || '#6366f1';
  return `
    <div class="bot-card" onclick="openEditModal('${bot.id}')">
      <div class="bot-color-dot" style="background:${color}20;color:${color}">🤖</div>
      <div class="bot-name">${esc(bot.name)}</div>
      <div class="bot-model">${esc(bot.model)} · ${bot.widget_pos}</div>
      <div class="bot-desc">${esc(bot.instructions)}</div>
      <div class="bot-actions" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${bot.id}')">✏️ Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="openEmbedModal('${bot.id}')">📋 Embed</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.id}')">🗑️</button>
      </div>
    </div>`;
}

// ── Create / Edit modal ───────────────────────────────────────────────────────
function openCreateModal() {
  editingBotId = null;
  document.getElementById('modal-title').textContent = 'New Chatbot';
  document.getElementById('modal-sub').textContent   = 'Set up your AI chatbot in minutes';
  clearForm();
  document.getElementById('bot-modal').classList.add('open');
}

function openEditModal(id) {
  const bot = bots.find(b => b.id === id);
  if (!bot) return;
  editingBotId = id;

  document.getElementById('modal-title').textContent = 'Edit Chatbot';
  document.getElementById('modal-sub').textContent   = bot.name;

  document.getElementById('f-name').value         = bot.name;
  document.getElementById('f-instructions').value = bot.instructions;
  document.getElementById('f-welcome').value      = bot.welcome_msg;
  document.getElementById('f-apikey').value       = '';  // never pre-fill key
  document.getElementById('f-apikey').placeholder = 'Leave blank to keep existing key';
  document.getElementById('f-model').value        = bot.model;
  document.getElementById('f-temp').value         = bot.temperature;
  document.getElementById('temp-val').textContent = bot.temperature;
  document.getElementById('f-color').value        = bot.widget_color;
  document.getElementById('f-pos').value          = bot.widget_pos;
  document.getElementById('f-origins').value      = bot.allowed_origins || '';

  document.getElementById('bot-modal').classList.add('open');
}

function clearForm() {
  ['f-name','f-instructions','f-welcome','f-apikey','f-origins'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-apikey').placeholder = 'sk-…';
  document.getElementById('f-model').value = 'gpt-4o-mini';
  document.getElementById('f-temp').value  = '0.7';
  document.getElementById('temp-val').textContent = '0.7';
  document.getElementById('f-color').value = '#6366f1';
  document.getElementById('f-pos').value   = 'bottom-right';
}

async function saveBot() {
  const name    = document.getElementById('f-name').value.trim();
  const apikey  = document.getElementById('f-apikey').value.trim();

  if (!name) return showToast('Please enter a bot name');
  if (!editingBotId && !apikey) return showToast('Please enter your OpenAI API key');

  const payload = {
    name,
    instructions:    document.getElementById('f-instructions').value.trim() || 'You are a helpful assistant.',
    welcome_msg:     document.getElementById('f-welcome').value.trim()       || 'Hello! How can I help you?',
    api_key:         apikey,
    model:           document.getElementById('f-model').value,
    temperature:     parseFloat(document.getElementById('f-temp').value),
    widget_color:    document.getElementById('f-color').value,
    widget_pos:      document.getElementById('f-pos').value,
    allowed_origins: document.getElementById('f-origins').value.trim(),
  };

  try {
    const url    = editingBotId ? `/api/bots/${editingBotId}` : '/api/bots';
    const method = editingBotId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    closeModal();
    await loadBots();
    showToast(editingBotId ? '✅ Chatbot updated!' : '✅ Chatbot created!');
  } catch (e) {
    showToast('Error: ' + e.message);
  }
}

async function deleteBot(id) {
  const bot = bots.find(b => b.id === id);
  if (!confirm(`Delete "${bot?.name}"? This cannot be undone.`)) return;
  try {
    await fetch(`/api/bots/${id}`, { method: 'DELETE' });
    await loadBots();
    showToast('🗑️ Chatbot deleted');
  } catch (e) {
    showToast('Error deleting bot');
  }
}

function closeModal() {
  document.getElementById('bot-modal').classList.remove('open');
  editingBotId = null;
}

// ── Embed modal ───────────────────────────────────────────────────────────────
function openEmbedModal(id) {
  const bot    = bots.find(b => b.id === id);
  if (!bot) return;

  const origin = window.location.origin;
  embedSnippet = `<script
  src="${origin}/js/widget.js"
  data-bot-key="${bot.key}"
  data-api-base="${origin}"
><\/script>`;

  document.getElementById('embed-code-display').textContent = embedSnippet;
  document.getElementById('embed-modal').classList.add('open');
}

function closeEmbedModal() {
  document.getElementById('embed-modal').classList.remove('open');
}

function copyEmbed() {
  navigator.clipboard.writeText(embedSnippet).then(() => {
    showToast('📋 Snippet copied to clipboard!');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = embedSnippet;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('📋 Snippet copied!');
  });
}

// ── Conversations ─────────────────────────────────────────────────────────────
async function loadChats() {
  const container = document.getElementById('chats-container');
  container.innerHTML = '<p style="color:var(--muted);font-size:14px;">Loading…</p>';

  try {
    // Read chats.json via a simple server endpoint
    const res   = await fetch('/api/chats');
    const chats = await res.json();

    if (!chats.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-title">No conversations yet</div>
          <div class="empty-sub">Conversations will appear here once users start chatting</div>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="chats-list">${chats.map(chatRow).join('')}</div>`;
  } catch (e) {
    container.innerHTML = '<p style="color:var(--muted);">Could not load conversations.</p>';
  }
}

function chatRow(chat) {
  const bot   = bots.find(b => b.key === chat.bot_key);
  const color = bot?.widget_color || '#6366f1';
  const last  = chat.messages?.slice(-1)[0];
  const time  = chat.last_activity ? new Date(chat.last_activity).toLocaleString() : '—';
  return `
    <div class="chat-row">
      <div class="chat-dot" style="background:${color}"></div>
      <div class="chat-meta">
        <div class="chat-session">Session ${chat.session_id?.slice(0,12)}… · ${bot?.name || 'Unknown bot'}</div>
        <div class="chat-preview">${esc(last?.content?.slice(0,120) || '(no messages)')}</div>
      </div>
      <div class="chat-time">${time}</div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function closeModalOnOverlay(e) {
  if (e.target === e.currentTarget) {
    closeModal();
    closeEmbedModal();
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
