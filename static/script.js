// ============ عناصر DOM ============
const chatEl      = document.getElementById('chat');
const msgBox       = document.getElementById('message');
const sendBtn       = document.getElementById('send');
const modeBtnEl = document.getElementById('modeBtn');
const modeMenuEl = document.getElementById('modeMenu');
const modeLabels = {general:'📌 عام', code:'💻 برمجة', explain:'📚 شرح', detailed:'📝 مفصّل', creative:'✨ إبداعي'};
let _currentMode = 'general';
const modeSel = {
  get value(){ return _currentMode; },
  set value(v){ _currentMode = v; if (modeBtnEl) modeBtnEl.textContent = modeLabels[v] || v; },
  addEventListener(evt, cb){ this._cb = cb; }
};
if (modeMenuEl) modeMenuEl.addEventListener('click', function(e){
  var li = e.target.closest('li');
  if(!li) return;
  modeSel.value = li.dataset.value;
  modeMenuEl.classList.remove('open');
  if (modeSel._cb) modeSel._cb();
});
if (modeBtnEl) modeBtnEl.addEventListener('click', function(){ modeMenuEl.classList.toggle('open'); });
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

  document.body.classList.toggle('light-mode', !settings.alwaysDark);
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
  s.messages.forEach((m, idx) => addBubble(m.content, m.role === 'user' ? 'user' : 'bot', idx));
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

function addBubble(text, cls, idx) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + cls;

  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  div.innerHTML = renderMarkdownLite(text);
  wrap.appendChild(div);

  if (idx !== undefined && (cls === 'user' || cls === 'bot')) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = 'نسخ';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text).catch(()=>{});
      copyBtn.textContent = '✅';
      setTimeout(() => { copyBtn.textContent = '📋'; }, 1200);
    };
    actions.appendChild(copyBtn);

    if (cls === 'bot') {
      const shareBtn = document.createElement('button');
      shareBtn.className = 'msg-action-btn';
      shareBtn.textContent = '📤';
      shareBtn.title = 'مشاركة';
      shareBtn.onclick = async () => {
        const { Share } = window.Capacitor?.Plugins || {};
        try {
          if (Share) {
            await Share.share({ text: text });
          } else if (navigator.share) {
            await navigator.share({ text: text });
          } else {
            navigator.clipboard.writeText(text).catch(()=>{});
            alert('تم نسخ الرد (المشاركة غير مدعومة هنا).');
          }
        } catch (e) { /* المستخدم لغى المشاركة */ }
      };
      actions.appendChild(shareBtn);
    }

    if (cls === 'user') {
      const editBtn = document.createElement('button');
      editBtn.className = 'msg-action-btn';
      editBtn.textContent = '✏️';
      editBtn.title = 'تعديل وإعادة الإرسال';
      editBtn.onclick = () => editMessage(idx);
      actions.appendChild(editBtn);
    }

    wrap.appendChild(actions);
  }

  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function editMessage(idx) {
  const s = getCurrent();
  if (!s || !s.messages[idx]) return;
  msgBox.value = s.messages[idx].content;
  s.messages = s.messages.slice(0, idx);
  saveSessions();
  renderChat();
  autoResize();
  msgBox.focus();
}

// ============ إرسال الرسائل ============
let currentController = null;

async function send() {
  const text = msgBox.value.trim();
  if (!text && !pendingImage) return;
  let s = getCurrent();
  if (!s) { newSession(); s = getCurrent(); }

  s.messages.push({ role: 'user', content: text });
  if (s.title === 'محادثة جديدة') {
    s.title = text.slice(0, 30) + (text.length > 30 ? '…' : '');
  }
  saveSessions();
  renderSidebar(searchInput.value);
  addBubble(text, 'user', s.messages.length - 1);
  msgBox.value = '';
  autoResize();

  const typingEl = addBubble('...جاري التفكير', 'bot typing');
  currentController = new AbortController();
  sendBtn.textContent = '⏹ إيقاف';

  try {
    const res = await fetch('https://leo-copilot-production.up.railway.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        mode: modeSel.value,
        history: s.messages.slice(0, -1).slice(-20),
        image: pendingImage,
      }),
      signal: currentController.signal,
    });
    clearImage();
    const data = await res.json();
    typingEl.remove();

    if (data.answer) {
      addBubble(data.answer, 'bot', s.messages.length);
      s.messages.push({ role: 'assistant', content: data.answer });
      renderFollowUps();
    } else {
      addBubble(data.error || 'خطأ غير معروف', 'bot error');
    }
    saveSessions();
  } catch (e) {
    typingEl.remove();
    if (e.name === 'AbortError') {
      addBubble('تم إيقاف التوليد.', 'bot error');
    } else {
      addBubble('فشل الاتصال بالخادم — تأكد إن السيرفر شغال.', 'bot error');
    }
  } finally {
    currentController = null;
    sendBtn.textContent = 'إرسال';
  }
}

function stopGeneration() {
  if (currentController) currentController.abort();
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
sendBtn.addEventListener('click', () => {
  if (currentController) { stopGeneration(); } else { send(); }
});
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
  applySettings();
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


// ============ إدخال صوتي (Capacitor) ============
const micBtnEl = document.getElementById('micBtn');
let isRecording = false;

async function toggleVoiceInput() {
  const { SpeechRecognition } = window.Capacitor?.Plugins || {};
  if (!SpeechRecognition) {
    alert('ميزة الصوت غير متاحة في هذا الإصدار.');
    return;
  }
  if (isRecording) {
    await SpeechRecognition.stop();
    isRecording = false;
    micBtnEl.classList.remove('recording');
    return;
  }
  try {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') {
      alert('لازم توافق على صلاحية المايك عشان تستخدم الميزة دي.');
      return;
    }
    isRecording = true;
    micBtnEl.classList.add('recording');
    SpeechRecognition.addListener('partialResults', (data) => {
      if (data.matches && data.matches.length) {
        msgBox.value = data.matches[0];
        autoResize();
      }
    });
    await SpeechRecognition.start({ language: 'ar-EG', partialResults: true, popup: false });
  } catch (e) {
    alert('حصل خطأ في التعرف على الصوت: ' + e.message);
  } finally {
    isRecording = false;
    micBtnEl.classList.remove('recording');
  }
}

if (micBtnEl) micBtnEl.addEventListener('click', toggleVoiceInput);


// ============ رفع الصور ============
const attachBtn = document.getElementById('attachBtn');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewImg = document.getElementById('imagePreviewImg');
const removeImageBtn = document.getElementById('removeImageBtn');
let pendingImage = null;

attachBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingImage = reader.result;
    imagePreviewImg.src = pendingImage;
    imagePreview.style.display = 'flex';
  };
  reader.readAsDataURL(file);
});

function clearImage() {
  pendingImage = null;
  imageInput.value = '';
  imagePreview.style.display = 'none';
}
removeImageBtn.addEventListener('click', clearImage);

// ============ اقتراحات المتابعة ============
function renderFollowUps() {
  const old = chatEl.querySelector('.followups');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.className = 'followups';
  const chips = ['اشرح أكتر 🔍', 'لخصلي 📝', 'أعطيني مثال 💡'];
  chips.forEach(c => {
    const b = document.createElement('button');
    b.className = 'followup-chip';
    b.textContent = c;
    b.onclick = () => { msgBox.value = c.replace(/ [🔍📝💡]$/, ''); send(); };
    wrap.appendChild(b);
  });
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}
