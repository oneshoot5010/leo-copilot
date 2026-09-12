let chats = JSON.parse(localStorage.getItem("chats")) || {};
let currentChatId = localStorage.getItem("currentChatId") || null;
let settings = JSON.parse(localStorage.getItem("settings")) || { fontSize: 14, speechRate: 1, voiceType: "ar", darkMode: false };
let stats = JSON.parse(localStorage.getItem("stats")) || { totalMessages: 0, totalChats: 0, wordCount: 0 };

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send");
const modeEl = { value: "general" };
const modeBtn = document.getElementById("modeBtn");
const modeLabel = document.getElementById("modeLabel");
const modeDropdown = document.getElementById("modeDropdown");
const modeOptions = document.querySelectorAll(".mode-option");

modeBtn.onclick = (e) => {
  e.stopPropagation();
  modeDropdown.classList.toggle("show");
  modeBtn.classList.toggle("open");
};
document.addEventListener("click", () => {
  modeDropdown.classList.remove("show");
  modeBtn.classList.remove("open");
});
modeOptions.forEach(opt => {
  opt.onclick = () => {
    modeOptions.forEach(o => o.classList.remove("active"));
    opt.classList.add("active");
    modeLabel.textContent = opt.textContent;
    modeEl.value = opt.dataset.value;
    modeDropdown.classList.remove("show");
    modeBtn.classList.remove("open");
  };
});
const chatListEl = document.getElementById("chatList");
const settingsModal = document.getElementById("settingsModal");
const statsModal = document.getElementById("statsModal");
const overlay = document.getElementById("overlay");
const voiceInputBtn = document.getElementById("voiceInput");
const speakOutputBtn = document.getElementById("speakOutput");

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

function createNewChat() {
  const id = generateId();
  chats[id] = { id, title: "محادثة جديدة", messages: [], created: new Date(), color: getRandomColor() };
  currentChatId = id;
  localStorage.setItem("chats", JSON.stringify(chats));
  localStorage.setItem("currentChatId", currentChatId);
  stats.totalChats++;
  localStorage.setItem("stats", JSON.stringify(stats));
  renderChats();
  renderChat();
}

function getRandomColor() {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function renderChats() {
  chatListEl.innerHTML = "";
  Object.values(chats).forEach(chat => {
    const item = document.createElement("div");
    item.className = `chat-item ${chat.id === currentChatId ? "active" : ""}`;
    item.innerHTML = `<span class="chat-item-title">${chat.title}</span><button class="del-one">✕</button>`;
    item.onclick = () => { currentChatId = chat.id; localStorage.setItem("currentChatId", currentChatId); renderChats(); renderChat(); };
    item.querySelector(".del-one").onclick = (e) => { e.stopPropagation(); delete chats[currentChatId]; localStorage.setItem("chats", JSON.stringify(chats)); currentChatId = Object.keys(chats)[0] || null; if (!currentChatId) createNewChat(); renderChats(); renderChat(); };
    chatListEl.appendChild(item);
  });
}

function renderChat() {
  if (!currentChatId) { createNewChat(); return; }
  const chat = chats[currentChatId];
  if (!chat) return;
  
  chatEl.innerHTML = "";
  document.getElementById("chatTitle").textContent = chat.title;
  
  chat.messages.forEach((msg, idx) => {
    const msgEl = document.createElement("div");
    msgEl.className = `msg ${msg.role}`;
    msgEl.style.backgroundColor = msg.role === "user" ? "unset" : `${chat.color}20`;
    msgEl.innerHTML = `
      <div>${msg.content}</div>
      ${msg.role === "bot" ? `<div class="msg-actions"><button class="msg-action-btn" id="speakBtn-${idx}" onclick="speakMsg('${idx}')">🔊 استماع</button></div>` : ""}
      ${msg.reactions ? `<div style="font-size:12px;margin-top:6px;">${Object.entries(msg.reactions).map(([e, c]) => `${e} ${c}`).join(" ")}</div>` : ""}
    `;
    chatEl.appendChild(msgEl);
  });
  chatEl.scrollTop = chatEl.scrollHeight;
}


function togglePin(idx) {
  const msg = chats[currentChatId].messages[idx];
  msg.pinned = !msg.pinned;
  localStorage.setItem("chats", JSON.stringify(chats));
  renderChat();
}

function copyMsg(idx) {
  const msg = chats[currentChatId].messages[idx].content;
  navigator.clipboard.writeText(msg);
  alert("تم النسخ!");
}

function deleteMsg(idx) {
  chats[currentChatId].messages.splice(idx, 1);
  localStorage.setItem("chats", JSON.stringify(chats));
  renderChat();
}

function editMsg(idx) {
  const msg = chats[currentChatId].messages[idx];
  if (msg.role === "user") {
    inputEl.value = msg.content;
    deleteMsg(idx);
  }
}

function toggleReaction(idx, emoji) {
  const msg = chats[currentChatId].messages[idx];
  if (!msg.reactions) msg.reactions = {};
  msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
  localStorage.setItem("chats", JSON.stringify(chats));
  renderChat();
}

function speakMsg(idx) {
  const btn = document.getElementById(`speakBtn-${idx}`);
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    if (btn) btn.textContent = "🔊 استماع";
    return;
  }
  const msg = chats[currentChatId].messages[idx].content;
  const utterance = new SpeechSynthesisUtterance(msg);
  utterance.rate = parseFloat(settings.speechRate);
  utterance.lang = settings.voiceType === "ar" ? "ar-SA" : "en-US";
  utterance.onend = () => { if (btn) btn.textContent = "🔊 استماع"; };
  if (btn) btn.textContent = "⏹️ إيقاف";
  speechSynthesis.speak(utterance);
}

let mediaRecorder;
let audioChunks = [];

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognitionAPI) {
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = "ar-SA";
  recognition.interimResults = false;
  recognition.continuous = false;
  let listening = false;

  voiceInputBtn.onclick = () => {
    if (listening) { recognition.stop(); return; }
    recognition.start();
  };
  recognition.onstart = () => { listening = true; voiceInputBtn.classList.add("recording"); };
  recognition.onend = () => { listening = false; voiceInputBtn.classList.remove("recording"); };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    inputEl.value += (inputEl.value ? " " : "") + transcript;
  };
  recognition.onerror = () => { listening = false; voiceInputBtn.classList.remove("recording"); };
} else {
  voiceInputBtn.onclick = () => alert("المتصفح ده مش بيدعم تحويل الصوت لنص");
}


sendBtn.onclick = async () => {
  const message = inputEl.value.trim();
  if (!message) return;
  
  if (!currentChatId) createNewChat();
  
  const chat = chats[currentChatId];
  chat.messages.push({ role: "user", content: message });
  
  stats.totalMessages++;
  stats.wordCount += message.split(" ").length;
  localStorage.setItem("stats", JSON.stringify(stats));
  
  inputEl.value = "";
  renderChat();
  
  if (chat.messages.length === 1) {
    chat.title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
  }
  
  const typingEl = document.createElement("div");
  typingEl.className = "msg bot typing";
  typingEl.textContent = "جاري الكتابة...";
  chatEl.appendChild(typingEl);
  chatEl.scrollTop = chatEl.scrollHeight;
  
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        mode: modeEl.value,
        history: chat.messages.slice(0, -1)
      })
    });
    
    const data = await response.json();
    typingEl.remove();
    chat.messages.push({ role: "bot", content: data.answer });
    stats.totalMessages++;
    stats.wordCount += data.answer.split(" ").length;
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("stats", JSON.stringify(stats));
    renderChat();
  } catch (e) {
    typingEl.remove();
    chat.messages.push({ role: "bot", content: "❌ حدث خطأ في الاتصال", error: true });
    renderChat();
  }
};

inputEl.onkeypress = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
};

document.getElementById("settingsBtn").onclick = () => { settingsModal.classList.add("show"); overlay.classList.add("show"); };
document.getElementById("closeSettings").onclick = () => { settingsModal.classList.remove("show"); overlay.classList.remove("show"); };

document.getElementById("darkMode").checked = settings.darkMode;
document.getElementById("darkMode").onchange = (e) => {
  settings.darkMode = e.target.checked;
  document.body.style.filter = settings.darkMode ? "invert(1)" : "none";
  localStorage.setItem("settings", JSON.stringify(settings));
};

document.getElementById("fontLarger").onclick = () => {
  if (settings.fontSize < 20) {
    settings.fontSize += 2;
    document.documentElement.style.fontSize = settings.fontSize + "px";
    document.getElementById("fontSize").textContent = settings.fontSize + "px";
    localStorage.setItem("settings", JSON.stringify(settings));
  }
};

document.getElementById("fontSmaller").onclick = () => {
  if (settings.fontSize > 11) {
    settings.fontSize -= 2;
    document.documentElement.style.fontSize = settings.fontSize + "px";
    document.getElementById("fontSize").textContent = settings.fontSize + "px";
    localStorage.setItem("settings", JSON.stringify(settings));
  }
};

document.getElementById("speechRate").onchange = (e) => {
  settings.speechRate = e.target.value;
  localStorage.setItem("settings", JSON.stringify(settings));
};

document.getElementById("voiceType").onchange = (e) => {
  settings.voiceType = e.target.value;
  localStorage.setItem("settings", JSON.stringify(settings));
};

document.getElementById("statsBtn").onclick = () => {
  const statsContent = document.getElementById("statsContent");
  statsContent.innerHTML = `
    <div class="setting-row">
      <span>عدد المحادثات:</span>
      <strong>${Object.keys(chats).length}</strong>
    </div>
    <div class="setting-row">
      <span>إجمالي الرسائل:</span>
      <strong>${stats.totalMessages}</strong>
    </div>
    <div class="setting-row">
      <span>عدد الكلمات:</span>
      <strong>${stats.wordCount}</strong>
    </div>
    <div class="setting-row">
      <span>متوسط الرسائل/المحادثة:</span>
      <strong>${Object.keys(chats).length > 0 ? (stats.totalMessages / Object.keys(chats).length).toFixed(1) : 0}</strong>
    </div>
  `;
  statsModal.classList.add("show");
  overlay.classList.add("show");
};

document.getElementById("closeStats").onclick = () => { statsModal.classList.remove("show"); overlay.classList.remove("show"); };

document.getElementById("searchInput").onkeyup = (e) => {
  const search = e.target.value.toLowerCase();
  chatListEl.childNodes.forEach(el => {
    const title = el.querySelector(".chat-item-title").textContent.toLowerCase();
    el.style.display = title.includes(search) ? "" : "none";
  });
};

document.getElementById("newChatBtn").onclick = createNewChat;

document.getElementById("clearAllBtn").onclick = () => {
  if (confirm("هل أنت متأكد من حذف كل المحادثات؟")) {
    chats = {};
    currentChatId = null;
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("currentChatId", "");
    createNewChat();
  }
};

overlay.onclick = () => { settingsModal.classList.remove("show"); statsModal.classList.remove("show"); sidebarEl.classList.remove("open"); overlay.classList.remove("show"); };
const menuBtn = document.getElementById("menuBtn");
const sidebarEl = document.querySelector(".sidebar");
menuBtn.onclick = () => { sidebarEl.classList.add("open"); overlay.classList.add("show"); };


document.documentElement.style.fontSize = settings.fontSize + "px";
document.getElementById("fontSize").textContent = settings.fontSize + "px";
if (settings.darkMode) document.body.style.filter = "invert(1)";

if (!currentChatId) createNewChat();
renderChats();
renderChat();

document.getElementById("closeSidebarBtn").onclick = () => {
  sidebarEl.classList.remove("open");
  overlay.classList.remove("show");
};
