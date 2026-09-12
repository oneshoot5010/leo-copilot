// ============ عناصر DOM ============
const chatEl      = document.getElementById('chat');
const msgBox       = document.getElementById('message');
const sendBtn       = document.getElementById('send');
const modeSel       = document.getElementById('mode');
const sidebar       = document.getElementById('sidebar');
const overlay       = document.getElementById('overlay');
const menuBtn       = document.getElementById('menuBtn');
const newChatBtn    = document.getElementById('newChatBtn');
const chatListEl    = document.getElementById('chatList');
const searchInput   = document.getElementById('searchChats');
const exportBtn     = document.getElementById('exportBtn');
const deleteAllBtn  = document.getElementById('deleteAllBtn');
const settingsBtn   = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const fontMinus     = document.getElementById('fontMinus');
const fontPlus      = document.getElementById('fontPlus');
const fontValue     = document.getElementById('fontValue');
const darkToggle    = document.getElementById('darkToggle');
const chatTitleEl   = document.getElementById('chatTitle');

const STORAGE_KEY = 'leo_copilot_sessions_v1';
const SETTINGS_KEY = 'leo_copilot_settings_v1';

// ============ الحالة ============
let sessions = loadSessions();          // { id, title, mode, messages: [{role, content}], createdAt }
let currentId = null;

// ============ تحميل/حفظ ============
function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { fontSize: 14, alwaysDark: true };
  } catch (e) { return { fontSize: 14, alwaysDark: true }; }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

let settings = loadSettings();
applySettings();

function applySettings() {
  document.documentElement.style.setProperty('--font-size', settings.fontSize + 'px');
  fontValue.textContent = settings.fontSize;
  darkToggle.checked = settings.alwaysDark;
}

// ============ إدارة الجلسات ============
function newSession() {
  const s = {
    id: 'c_' + Date.now(),
    title: 'محادثة جديدة',
    mode: modeSel.value || 'general',
    messages: [],
    createdAt: Date.now(),
  };
  sessions.unshift(s);
  currentId = s.id;
  saveSessions();
  renderSidebar();
  renderChat();
}

function getCurrent() {
  return sessions.find(s => s.id === currentId);
}

function openSession(id) {
  currentId = id;
  const s = getCurrent();
  if (s) modeSel.value = s.mode || 'general';
  renderSidebar();
  renderChat();
  closeSidebarOnMobile();
}

function deleteSession(id, evt) {
  if (evt) evt.stopPropagation();
  sessions = sessions.filter(s => s.id !== id);
  saveSessions();
  if (currentId === id) {
    currentId = sessions.length ? sessions[0].id : null;
    if (!currentId) newSession();
  }
  renderSidebar();
  renderChat();
}

function deleteAll() {
  if (!confirm('متأكد إنك عايز تمسح كل المحادثات؟ الإجراء ده لا يمكن التراجع عنه.')) return;
  sessions = [];
  saveSessions();
  newSession();
}

function exportAll() {
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leo-copilot-chats-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============ عرض الشريط الجانبي ============
function renderSidebar(filter = '') {
  chatListEl.innerHTML = '';
  const q = filter.trim().toLowerCase();
  sessions
    .filter(s => !q || s.title.toLowerCase().includes(q))
    .forEach(s => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (s.id === currentId ? ' active' : '');
      item.onclick = () => openSession(s.id);

      const title = document.createElement('span');
      title.className = 'chat-item-title';
      title.textContent = s.title;

      const delBtn = document.createElement('button');
      delBtn.className = 'del-one';
      delBtn.textContent = '✕';
      delBtn.onclick = (e) => deleteSession(s.id, e);

      item.appendChild(title);
      item.appendChild(delBtn);
      chatListEl.appendChild(item);
    });
}

// ============ عرض الدردشة ============
function renderChat() {
  chatEl.innerHTML = '';
  const s = getCurrent();
  if (!s) return;
  chatTitleEl.textContent = s.title === 'محادثة جديدة' ? 'مساعدك الذكي الشامل' : s.title;
  s.messages.forEach(m => addBubble(m.content, m.role === 'user' ? 'user' : 'bot'));
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderMarkdownLite(text) {
  // تحويل بسيط لكتل الكود ```...``` والأكواد المضمّنة `...`
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const withBlocks = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  const withInline = withBlocks.replace(/`([^`]+)`/g, '<code>$1</code>');
  return withInline;
}

function addBubble(text, cls) {
  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  div.innerHTML = renderMarkdownLite(text);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

// ============ إرسال الرسائل ============
async function send() {
  const text = msgBox.value.trim();
  if (!text) return;
  let s = getCurrent();
  if (!s) { newSession(); s = getCurrent(); }

  s.messages.push({ role: 'user', content: text });
  if (s.title === 'محادثة جديدة') {
    s.title = text.slice(0, 30) + (text.length > 30 ? '…' : '');
  }
  saveSessions();
  renderSidebar(searchInput.value);
  addBubble(text, 'user');
  msgBox.value = '';
  autoResize();

  const typingEl = addBubble('...جاري التفكير', 'bot typing');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        mode: modeSel.value,
        history: s.messages.slice(0, -1).slice(-20),
      }),
    });
    const data = await res.json();
    typingEl.remove();

    if (data.answer) {
      addBubble(data.answer, 'bot');
      s.messages.push({ role: 'assistant', content: data.answer });
    } else {
      addBubble(data.error || 'خطأ غير معروف', 'bot error');
    }
    saveSessions();
  } catch (e) {
    typingEl.remove();
    addBubble('فشل الاتصال بالخادم — تأكد إن السيرفر شغال.', 'bot error');
  }
}

function autoResize() {
  msgBox.style.height = 'auto';
  msgBox.style.height = Math.min(msgBox.scrollHeight, 120) + 'px';
}

// ============ الشريط الجانبي: فتح/غلق على الموبايل ============
function openSidebarOnMobile() {
  sidebar.classList.add('open');
  overlay.classList.add('show');
}
function closeSidebarOnMobile() {
  if (window.innerWidth < 900) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
}

// ============ ربط الأحداث ============
sendBtn.addEventListener('click', send);
msgBox.addEventListener('input', autoResize);
msgBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

newChatBtn.addEventListener('click', () => { newSession(); closeSidebarOnMobile(); });
menuBtn.addEventListener('click', openSidebarOnMobile);
overlay.addEventListener('click', closeSidebarOnMobile);

searchInput.addEventListener('input', () => renderSidebar(searchInput.value));
exportBtn.addEventListener('click', exportAll);
deleteAllBtn.addEventListener('click', deleteAll);

modeSel.addEventListener('change', () => {
  const s = getCurrent();
  if (s) { s.mode = modeSel.value; saveSessions(); }
});

settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
closeSettings.addEventListener('click', () => settingsModal.classList.remove('show'));

fontMinus.addEventListener('click', () => {
  settings.fontSize = Math.max(11, settings.fontSize - 1);
  saveSettings(settings); applySettings();
});
fontPlus.addEventListener('click', () => {
  settings.fontSize = Math.min(20, settings.fontSize + 1);
  saveSettings(settings); applySettings();
});
darkToggle.addEventListener('change', () => {
  settings.alwaysDark = darkToggle.checked;
  saveSettings(settings);
});

// ============ التشغيل الأولي ============
if (sessions.length === 0) {
  newSession();
} else {
  currentId = sessions[0].id;
  modeSel.value = sessions[0].mode || 'general';
  renderSidebar();
  renderChat();
}
