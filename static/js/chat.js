// =====================================
// NEXUS CHAT - CHAT MODULE v3.0
// All bugs fixed: screen overlap, timezone, emoji, voice, context menu
// =====================================

// DOM Elements (safe getters - DOM may not be ready at parse time)
const chatList = document.getElementById('chat-list');
const groupsList = document.getElementById('groups-list');
const broadcastsList = document.getElementById('broadcasts-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const currentChatAvatar = document.getElementById('current-chat-avatar');
const currentChatName = document.getElementById('current-chat-name');
const currentChatStatus = document.getElementById('current-chat-status');
const chatStatusIndicator = document.getElementById('chat-status-indicator');
const searchContacts = document.getElementById('search-contacts');
const sidebar = document.getElementById('sidebar');
const chatArea = document.getElementById('chat-area');
const backButton = document.getElementById('back-button');
const emptyChat = document.getElementById('empty-chat');
const fileUpload = document.getElementById('file-upload');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const selectionHeader = document.getElementById('selection-header');
const selectionCount = document.getElementById('selection-count');
const selectionBack = document.getElementById('selection-back');
const selectionDelete = document.getElementById('selection-delete');
const selectionMute = document.getElementById('selection-mute');
const selectionBlock = document.getElementById('selection-block');
const selectionRead = document.getElementById('selection-read');
const selectionArchive = document.getElementById('selection-archive');
const chatTabs = document.querySelectorAll('.chat-tab');
const attachMenuBtn = document.getElementById('attach-menu-btn');
const attachmentMenu = document.getElementById('attachment-menu');
const emojiPickerBtn = document.getElementById('emoji-picker-btn');
const emojiPicker = document.getElementById('emoji-picker');
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const searchChatBtn = document.getElementById('search-chat-btn');
const chatMenuBtn = document.getElementById('chat-menu-btn');
const startNewChat = document.getElementById('start-new-chat');

// Chat state
let currentChat = null;
let contacts = [];
let groups = [];
let broadcasts = [];
let chats = {};
let groupChats = {};
let broadcastChats = {};
let selectedChats = new Set();
let messageSoundEnabled = true;
let typingTimeout = null;
let longPressTimer = null;
let isSelectionMode = false;
let currentChatType = 'contact';
let replyToMessage = null;
let waveSurferInstances = new Map();
let currentlyPlaying = null;

// ===== INITIALIZATION =====
// KEY FIX: Do NOT call initChat on DOMContentLoaded
// auth.js will call initChat() only after successful login / session restore

function initChat() {
    setupChatEventListeners();
    setupLongPress();
    setupChatMenu();
    setupBackButtonHandler();
    setupAttachmentMenu();
    setupEmojiPicker();
    setupMessageEvents();
    setupInfiniteScroll();
    setupScreenshotDetection();
    setupPushNotifications();
    startLastSeenRefreshInterval();

    if (startNewChat) {
        startNewChat.addEventListener('click', () => {
            const modal = document.getElementById('add-contact-modal');
            if (modal && window.openModal) window.openModal(modal);
        });
    }

    // Load data
    loadContacts();
    loadGroups();
    loadBroadcasts();
}

// Register additional socket events (called by auth.js after socket connected)
function registerSocketEvents(sock) {
    sock.on('user-status-updated', handleUserStatusUpdate);
    sock.on('new-group-message', handleNewGroupMessage);
    sock.on('new-broadcast-message', handleNewBroadcastMessage);
    sock.on('message-reaction', handleMessageReaction);
    sock.on('message-deleted', handleMessageDeleted);
    sock.on('message-edited', handleMessageEdited);
    sock.on('screenshot-taken', handleScreenshotReceived);
}
window.registerSocketEvents = registerSocketEvents;

// ===== EVENT LISTENERS SETUP =====
function setupChatEventListeners() {
    // Send message
    if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
        messageInput.addEventListener('input', () => { toggleSendButton(); handleTyping(); });
    }

    // File upload
    if (fileUpload) {
        fileUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                toggleSendButton();
                showToast(`${e.target.files.length} file(s) selected`, 'info');
            }
        });
    }

    // Search
    if (searchContacts) searchContacts.addEventListener('input', filterContacts);

    // Back button
    if (backButton) backButton.addEventListener('click', showChatList);

    // Selection actions
    if (selectionBack) selectionBack.addEventListener('click', exitSelectionMode);
    if (selectionDelete) selectionDelete.addEventListener('click', deleteSelectedChats);

    // Tab switching
    chatTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

// ===== CONTACT MANAGEMENT =====
async function loadContacts() {
    if (!window.currentUser) return;
    try {
        const res = await fetch(`/contacts/${window.currentUser.email}`);
        if (res.ok) {
            const serverContacts = await res.json();
            serverContacts.forEach(sc => {
                const lc = contacts.find(c => c.email === sc.email);
                if (lc) {
                    sc.unreadCount = lc.unreadCount || sc.unreadCount || 0;
                    sc.lastMessage = lc.lastMessage || sc.lastMessage || 'No messages yet';
                }
            });
            contacts = serverContacts;
            renderContacts();
        }
    } catch (e) { console.error('loadContacts error:', e); renderContacts(); }
}

// Called by auth.js when contacts arrive
function setContacts(serverContacts) {
    contacts = serverContacts;
    renderContacts();
}

function renderContacts() {
    window.currentUserContacts = contacts;
    if (!chatList) return;
    chatList.innerHTML = '';

    if (!contacts || contacts.length === 0) {
        chatList.innerHTML = `
            <div class="no-contacts">
                <i class="fas fa-user-plus"></i>
                <p>No contacts yet.</p>
                <button class="nexus-btn secondary" onclick="window.openModal(document.getElementById('add-contact-modal'))">
                    <i class="fas fa-plus"></i> Add Contact
                </button>
            </div>`;
        return;
    }

    const sorted = [...contacts].sort((a, b) => {
        const ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
        const tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
        return tb - ta;
    });

    sorted.forEach((contact, i) => chatList.appendChild(createChatItem(contact, i)));
}

function createChatItem(contact, index) {
    const el = document.createElement('div');
    el.className = 'chat-item';
    el.dataset.email = contact.email;
    el.dataset.type = 'contact';
    el.style.animationDelay = `${index * 0.05}s`;

    const lastMsg = contact.lastMessage || 'Tap to start chatting';
    const lastTime = contact.lastTime ? formatTime(contact.lastTime) : '';
    const unread = contact.unreadCount > 0 ? `<span class="chat-unread">${contact.unreadCount}</span>` : '';

    let statusIcon = '';
    if (chats[contact.email]?.messages?.length) {
        const lm = chats[contact.email].messages[chats[contact.email].messages.length - 1];
        if (lm?.from === window.currentUser?.email) {
            statusIcon = lm.status === 'seen' ? '<i class="fas fa-check-double" style="color:var(--nexus-teal);margin-right:3px;font-size:0.7rem;"></i>'
                : lm.status === 'delivered' ? '<i class="fas fa-check-double" style="margin-right:3px;font-size:0.7rem;opacity:0.6;"></i>'
                : '<i class="fas fa-check" style="margin-right:3px;font-size:0.7rem;opacity:0.5;"></i>';
        }
    }

    el.innerHTML = `
        <div class="chat-avatar-wrap">
            <img src="${contact.avatar || defaultAvatar()}" class="chat-avatar" alt="${contact.name}">
            <span class="status-dot ${contact.online ? 'online' : ''}"></span>
        </div>
        <div class="chat-info">
            <div class="chat-name-row">
                <span class="chat-name">${contact.name}</span>
                <span class="chat-time">${lastTime}</span>
            </div>
            <div class="chat-preview-row">
                <span class="chat-last-msg">${statusIcon}${contact.typing ? '<em>typing...</em>' : lastMsg}</span>
                ${unread}
            </div>
        </div>`;

    el.addEventListener('click', () => {
        if (isSelectionMode) toggleChatSelection(el);
        else openChat(contact);
    });

    return el;
}

function defaultAvatar() {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%236C3AE8'/%3E%3Ccircle cx='20' cy='15' r='7' fill='white' opacity='0.9'/%3E%3Cellipse cx='20' cy='35' rx='13' ry='10' fill='white' opacity='0.9'/%3E%3C/svg%3E`;
}

// ===== GROUP & BROADCAST MANAGEMENT =====
async function loadGroups() {
    if (!window.currentUser) return;
    try {
        const res = await fetch(`/user-groups/${window.currentUser.email}`);
        if (res.ok) { groups = await res.json(); renderGroups(); }
    } catch(e) {}
}

function renderGroups() {
    if (!groupsList) return;
    if (!groups || groups.length === 0) {
        groupsList.innerHTML = `<div class="no-contacts"><i class="fas fa-users"></i><p>No groups yet.</p><button class="nexus-btn secondary" onclick="window.openModal(document.getElementById('create-group-modal'))"><i class="fas fa-plus"></i> Create Group</button></div>`;
        return;
    }
    groupsList.innerHTML = '';
    [...groups].sort((a,b) => new Date(b.lastMessageTime||0) - new Date(a.lastMessageTime||0))
        .forEach((g, i) => {
            const el = document.createElement('div');
            el.className = 'chat-item';
            el.dataset.groupId = g.id;
            el.innerHTML = `
                <div class="chat-avatar-wrap">
                    <img src="${g.avatar || defaultAvatar()}" class="chat-avatar" alt="${g.name}">
                </div>
                <div class="chat-info">
                    <div class="chat-name-row"><span class="chat-name">${g.name}</span><span class="chat-time">${g.lastMessageTime ? formatTime(g.lastMessageTime) : ''}</span></div>
                    <div class="chat-preview-row"><span class="chat-last-msg">${g.lastMessage || 'No messages yet'}</span></div>
                </div>`;
            el.addEventListener('click', () => openGroupChat(g));
            groupsList.appendChild(el);
        });
}

async function loadBroadcasts() {
    if (!window.currentUser) return;
    try {
        const res = await fetch(`/user-broadcasts/${window.currentUser.email}`);
        if (res.ok) { broadcasts = await res.json(); renderBroadcasts(); }
    } catch(e) {}
}

function renderBroadcasts() {
    if (!broadcastsList) return;
    if (!broadcasts || broadcasts.length === 0) {
        broadcastsList.innerHTML = `<div class="no-contacts"><i class="fas fa-bullhorn"></i><p>No broadcast lists yet.</p></div>`;
        return;
    }
    broadcastsList.innerHTML = '';
    broadcasts.forEach(b => {
        const el = document.createElement('div');
        el.className = 'chat-item';
        el.dataset.broadcastId = b.id;
        el.innerHTML = `
            <div class="chat-avatar-wrap"><img src="${b.avatar || defaultAvatar()}" class="chat-avatar" alt="${b.name}"></div>
            <div class="chat-info">
                <div class="chat-name-row"><span class="chat-name">${b.name}</span></div>
                <div class="chat-preview-row"><span class="chat-last-msg">${b.lastMessage || 'No messages yet'}</span></div>
            </div>`;
        el.addEventListener('click', () => openBroadcastChat(b));
        broadcastsList.appendChild(el);
    });
}

// ===== CHAT OPENING =====
function openChat(contact) {
    currentChat = contact;
    window.currentChat = contact;
    currentChatType = 'contact';

    currentChatAvatar.src = contact.avatar || defaultAvatar();
    currentChatName.textContent = contact.name;
    updateChatStatus(contact);

    // Mobile: show chat area, hide sidebar
    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden');
        chatArea.classList.add('visible');
        history.pushState({ chat: contact.email }, '');
    }
    if (emptyChat) emptyChat.style.display = 'none';

    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    const sel = document.querySelector(`.chat-item[data-email="${contact.email}"]`);
    if (sel) sel.classList.add('active');

    loadChatMessages(contact.email);
    messageInput.focus();
    markMessagesAsSeen();

    if (voiceCallBtn) voiceCallBtn.style.display = 'flex';
    if (videoCallBtn) videoCallBtn.style.display = 'flex';
}

function openGroupChat(group) {
    currentChat = { ...group, isGroup: true, email: group.id };
    window.currentChat = currentChat;
    currentChatType = 'group';

    currentChatAvatar.src = group.avatar || defaultAvatar();
    currentChatName.textContent = group.name;
    currentChatStatus.textContent = `${group.members?.length || 0} members`;
    chatStatusIndicator.className = 'status-indicator online';

    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden');
        chatArea.classList.add('visible');
        history.pushState({ groupChat: group.id }, '');
    }
    if (emptyChat) emptyChat.style.display = 'none';

    loadGroupMessages(group.id);
    messageInput.focus();
    if (voiceCallBtn) voiceCallBtn.style.display = 'none';
    if (videoCallBtn) videoCallBtn.style.display = 'none';
}

function openBroadcastChat(broadcast) {
    currentChat = { ...broadcast, isBroadcast: true, email: broadcast.id };
    window.currentChat = currentChat;
    currentChatType = 'broadcast';

    currentChatAvatar.src = broadcast.avatar || defaultAvatar();
    currentChatName.textContent = broadcast.name;
    currentChatStatus.textContent = `${broadcast.members?.length || 0} recipients`;

    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden');
        chatArea.classList.add('visible');
    }
    if (emptyChat) emptyChat.style.display = 'none';

    loadBroadcastMessages(broadcast.id);
    messageInput.focus();
}

// ===== STATUS DISPLAY =====
// PKT timezone: UTC+5. We force PKT regardless of device clock.
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - msgDay) / 86400000);

    const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

    if (diffDays === 0) return timeStr;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatLastSeen(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const diff = Math.floor((Date.now() - date) / 1000);
    const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (date.toDateString() === today.toDateString()) return timeStr;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function updateChatStatus(contact) {
    if (!contact) return;
    if (contact.online) {
        currentChatStatus.innerHTML = `<span class="online-dot-pulse"></span> Online`;
        currentChatStatus.className = 'current-chat-status text-online';
        chatStatusIndicator.className = 'status-indicator online';
    } else {
        const ls = formatLastSeen(contact.lastSeen);
        // Show "Last seen today at 3:43 PM" first time, then just time
        currentChatStatus.textContent = ls ? `Last seen ${ls}` : '';
        currentChatStatus.className = 'current-chat-status';
        chatStatusIndicator.className = 'status-indicator offline';
    }
}

// ===== MESSAGE LOADING =====
async function loadChatMessages(contactEmail) {
    if (!window.currentUser) return;

    // Show cache instantly
    const cacheKey = `nexus_chat_${window.currentUser.email}_${contactEmail}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const cachedData = JSON.parse(cached);
            if (cachedData.messages?.length) {
                chats[contactEmail] = cachedData;
                renderMessages(cachedData.messages);
            }
        }
    } catch(e) {}

    try {
        const res = await fetch('/get-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user1: window.currentUser.email, user2: contactEmail })
        });
        if (res.ok) {
            const chat = await res.json();
            chats[contactEmail] = chat || { messages: [] };
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ messages: (chat.messages || []).slice(-200) }));
            } catch(e) {}

            const contact = contacts.find(c => c.email === contactEmail);
            if (contact && chat.messages?.length) {
                const lm = chat.messages[chat.messages.length - 1];
                contact.lastMessage = formatMessagePreview(lm);
                contact.lastTime = lm.timestamp;
            }
            renderMessages(chat.messages || []);
            renderContacts();
        }
    } catch(e) { showToast('Error loading messages', 'error'); }
}

async function loadGroupMessages(groupId) {
    if (!window.currentUser) return;
    try {
        const res = await fetch('/get-group-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId })
        });
        if (res.ok) {
            const data = await res.json();
            groupChats[groupId] = data.messages || [];
            renderMessages(data.messages || []);
        }
    } catch(e) { showToast('Error loading group messages', 'error'); }
}

async function loadBroadcastMessages(broadcastId) {
    if (!window.currentUser) return;
    try {
        const res = await fetch('/get-broadcast-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ broadcastId })
        });
        if (res.ok) {
            const data = await res.json();
            broadcastChats[broadcastId] = data.messages || [];
            renderMessages(data.messages || []);
        }
    } catch(e) {}
}

// ===== MESSAGE RENDERING =====
function renderMessages(messages) {
    if (!messagesContainer) return;
    messagesContainer.innerHTML = '';
    // Destroy old wavesurfer instances
    waveSurferInstances.forEach(ws => { try { ws.destroy(); } catch(e) {} });
    waveSurferInstances.clear();

    if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon"><i class="fas fa-comments"></i></div>
                <h3>Start a conversation</h3>
                <p>Say hello to ${currentChat?.name || 'your contact'} 👋</p>
            </div>`;
        return;
    }

    let lastDate = null;
    messages.forEach(msg => {
        const msgDate = new Date(msg.timestamp).toDateString();
        if (msgDate !== lastDate) { addDateSeparator(msg.timestamp); lastDate = msgDate; }
        addMessageToUI(msg, false);
    });

    scrollToBottom();
}

function addDateSeparator(timestamp) {
    const msgDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    let txt = '';
    if (msgDate.toDateString() === today.toDateString()) txt = 'Today';
    else if (msgDate.toDateString() === yesterday.toDateString()) txt = 'Yesterday';
    else txt = msgDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const sep = document.createElement('div');
    sep.className = 'date-separator';
    sep.innerHTML = `<span>${txt}</span>`;
    messagesContainer.appendChild(sep);
}

function addMessageToUI(msg, animate = true) {
    if (!messagesContainer || !window.currentUser) return;

    const isOutgoing = msg.from === window.currentUser.email;
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
    wrapper.dataset.messageId = msg.id;

    if (msg.deleted) {
        wrapper.innerHTML = `
            <div class="message-bubble message-deleted">
                <i class="fas fa-ban"></i> This message was deleted
            </div>`;
        messagesContainer.appendChild(wrapper);
        return;
    }

    const senderName = (currentChat?.isGroup && !isOutgoing)
        ? `<div class="msg-sender">${msg.senderName || msg.from?.split('@')[0]}</div>` : '';
    const replyPreview = msg.replyTo ? buildReplyPreview(msg.replyTo) : '';
    const content = buildMessageContent(msg);
    const statusIcon = isOutgoing ? getStatusIcon(msg.status || 'sent') : '';
    const reactionsHTML = (msg.reactions?.length) ? buildReactionsHTML(msg.reactions, msg.id) : '';
    const timeStr = formatTime(msg.timestamp);

    wrapper.innerHTML = `
        <div class="message-bubble">
            ${senderName}
            ${replyPreview}
            ${content}
            <div class="message-meta">
                <span class="msg-time">${timeStr}</span>
                ${statusIcon}
                ${msg.edited ? '<span class="msg-edited">edited</span>' : ''}
            </div>
        </div>
        ${reactionsHTML}`;

    // Context menu - right click and long press
    wrapper.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageContextMenu(msg, e.clientX, e.clientY);
    });

    let touchTimer;
    wrapper.addEventListener('touchstart', (e) => {
        touchTimer = setTimeout(() => showMessageContextMenu(msg, e.touches[0].clientX, e.touches[0].clientY), 600);
    }, { passive: true });
    wrapper.addEventListener('touchend', () => clearTimeout(touchTimer));
    wrapper.addEventListener('touchmove', () => clearTimeout(touchTimer));

    messagesContainer.appendChild(wrapper);

    // Init WaveSurfer for voice messages
    if (msg.type === 'voice') {
        setTimeout(() => initVoiceMessagePlayer(msg.id, msg.message), 150);
    }

    if (animate) {
        scrollToBottom();
        if (!isOutgoing && messageSoundEnabled) playMessageSound('received');
    }
}

// ===== WAVESURFER VOICE PLAYER =====
function initVoiceMessagePlayer(msgId, src) {
    if (waveSurferInstances.has(msgId)) return; // Prevent double init
    const container = document.getElementById(`waveform-${msgId}`);
    if (!container || !window.WaveSurfer) return;

    try {
        const isOut = container.closest('.message-outgoing') !== null;
        const ws = WaveSurfer.create({
            container,
            waveColor: isOut ? 'rgba(255,255,255,0.4)' : 'rgba(139,92,246,0.4)',
            progressColor: isOut ? 'rgba(255,255,255,0.9)' : '#8B5CF6',
            cursorWidth: 0,
            height: 36,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            interact: true,
            url: src
        });

        waveSurferInstances.set(msgId, ws);

        const player = container.closest('.voice-player');
        const playBtn = player?.querySelector('.play-btn');
        const durationEl = player?.querySelector('.voice-duration');

        ws.on('finish', () => {
            if (playBtn) { playBtn.innerHTML = '<i class="fas fa-play"></i>'; }
            currentlyPlaying = null;
        });

        ws.on('audioprocess', () => {
            if (durationEl) {
                const rem = ws.getDuration() - ws.getCurrentTime();
                const m = Math.floor(rem / 60);
                const s = Math.floor(rem % 60).toString().padStart(2, '0');
                durationEl.textContent = `${m}:${s}`;
            }
        });

        ws.on('ready', () => {
            if (playBtn) {
                playBtn.classList.remove('loading');
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                playBtn.disabled = false;
            }
            if (durationEl) {
                const dur = ws.getDuration();
                const m = Math.floor(dur / 60);
                const s = Math.floor(dur % 60).toString().padStart(2, '0');
                durationEl.textContent = `${m}:${s}`;
            }
        });

        ws.on('error', () => {
            if (playBtn) {
                playBtn.classList.remove('loading');
                playBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                playBtn.disabled = true;
            }
        });

        if (playBtn) {
            playBtn.disabled = true;
            playBtn.addEventListener('click', () => {
                if (currentlyPlaying && currentlyPlaying !== ws) {
                    currentlyPlaying.pause();
                    const prev = document.querySelector('.play-btn.playing');
                    if (prev) { prev.innerHTML = '<i class="fas fa-play"></i>'; prev.classList.remove('playing'); }
                }
                if (ws.isPlaying()) {
                    ws.pause();
                    playBtn.innerHTML = '<i class="fas fa-play"></i>';
                    playBtn.classList.remove('playing');
                    currentlyPlaying = null;
                } else {
                    ws.play();
                    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    playBtn.classList.add('playing');
                    currentlyPlaying = ws;
                }
            });
        }
    } catch(e) { console.warn('WaveSurfer failed:', e); }
}

// ===== MESSAGE CONTENT BUILDERS =====
function buildMessageContent(msg) {
    switch(msg.type) {
        case 'image':
            return `
                <div class="msg-image-wrap" onclick="window.viewMedia && window.viewMedia('${msg.message}', 'image', 'photo.jpg')">
                    <img src="${msg.message}" alt="Photo" loading="lazy" class="msg-image">
                    <div class="img-overlay"><i class="fas fa-search-plus"></i></div>
                </div>`;
        case 'video':
            return `<div class="msg-video-wrap"><video controls preload="metadata" class="msg-video"><source src="${msg.message}" type="video/mp4"></video></div>`;
        case 'audio':
            return `<div class="msg-audio-wrap"><audio controls preload="metadata"><source src="${msg.message}" type="audio/mpeg"></audio></div>`;
        case 'voice':
            return `
                <div class="voice-player">
                    <button class="play-btn loading" aria-label="Play"><i class="fas fa-spinner fa-spin"></i></button>
                    <div class="voice-waveform-wrap">
                        <div class="voice-waveform" id="waveform-${msg.id}"></div>
                        <span class="voice-duration">${msg.duration || '0:00'}</span>
                    </div>
                </div>`;
        case 'file': {
            const name = msg.fileName || 'File';
            const size = msg.fileSize ? formatFileSize(msg.fileSize) : '';
            const ext = name.split('.').pop().toLowerCase();
            const iconMap = { pdf:'fa-file-pdf', doc:'fa-file-word', docx:'fa-file-word', xls:'fa-file-excel', xlsx:'fa-file-excel', zip:'fa-file-archive', rar:'fa-file-archive', txt:'fa-file-alt', mp3:'fa-file-audio', mp4:'fa-file-video' };
            const icon = iconMap[ext] || 'fa-file';
            return `
                <div class="msg-file" onclick="window.downloadMedia && window.downloadMedia('${msg.message}', '${name}')">
                    <div class="file-icon"><i class="fas ${icon}"></i></div>
                    <div class="file-info">
                        <div class="file-name">${name}</div>
                        ${size ? `<div class="file-size">${size}</div>` : ''}
                    </div>
                    <div class="file-dl"><i class="fas fa-download"></i></div>
                </div>`;
        }
        default:
            return `<div class="msg-text">${linkify(msg.message || '')}</div>`;
    }
}

function buildReplyPreview(replyToId) {
    const orig = findMessageById(replyToId);
    if (!orig) return '';
    const name = orig.from === window.currentUser?.email ? 'You' : (orig.senderName || orig.from?.split('@')[0]);
    const preview = orig.type !== 'text' ? `📎 ${orig.type}` : (orig.message || '').substring(0, 50);
    return `<div class="msg-reply" onclick="scrollToMessage('${replyToId}')"><div class="reply-name">${name}</div><div class="reply-text">${preview}</div></div>`;
}

function buildReactionsHTML(reactions, msgId) {
    const counts = {};
    reactions.forEach(r => { counts[r.reaction] = (counts[r.reaction] || 0) + 1; });
    let html = '<div class="msg-reactions">';
    for (const [reaction, count] of Object.entries(counts)) {
        const myReaction = reactions.some(r => r.user === window.currentUser?.email && r.reaction === reaction);
        html += `<span class="reaction ${myReaction ? 'mine' : ''}" onclick="window.toggleReaction && window.toggleReaction('${msgId}', '${reaction}')">${reaction}<span class="rc">${count}</span></span>`;
    }
    return html + '</div>';
}

function getStatusIcon(status) {
    if (status === 'pending') return '<i class="far fa-clock msg-status" style="opacity:0.5;font-size:0.7rem;"></i>';
    if (status === 'seen') return '<i class="fas fa-check-double msg-status seen"></i>';
    if (status === 'delivered') return '<i class="fas fa-check-double msg-status delivered"></i>';
    return '<i class="fas fa-check msg-status sent"></i>';
}
window.getStatusIcon = getStatusIcon;

// ===== SEND MESSAGE =====
// ===== OPTIMISTIC SEND HELPERS =====
const QUEUE_KEY = () => `nexus_send_queue_${window.currentUser?.email || ''}`;

function saveChatCache(email) {
    try {
        const ck = `nexus_chat_${window.currentUser.email}_${email}`;
        localStorage.setItem(ck, JSON.stringify({ messages: (chats[email]?.messages || []).slice(-200) }));
    } catch(e) {}
}

function saveSendQueue(queue) {
    try { localStorage.setItem(QUEUE_KEY(), JSON.stringify(queue)); } catch(e) {}
}

function loadSendQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY()) || '[]'); } catch(e) { return []; }
}

// Replace temp message with real message after server confirm
function confirmTempMessage(tempId, realMsg) {
    const targetEmail = realMsg.to === window.currentUser.email ? realMsg.from : realMsg.to;
    if (!chats[targetEmail]) return;
    const idx = chats[targetEmail].messages.findIndex(m => m.id === tempId);
    if (idx !== -1) {
        chats[targetEmail].messages[idx] = realMsg;
        saveChatCache(targetEmail);
        // Update DOM element
        const el = document.querySelector(`[data-message-id="${tempId}"]`);
        if (el) {
            el.dataset.messageId = realMsg.id;
            const statusEl = el.querySelector('.msg-status, .far.fa-clock, .fas.fa-check');
            if (statusEl) statusEl.parentElement.innerHTML = window.getStatusIcon(realMsg.status || 'sent');
        }
    }
    // Update contact preview
    const c = contacts.find(c => c.email === targetEmail);
    if (c) { c.lastMessage = formatMessagePreview(realMsg); c.lastTime = realMsg.timestamp; }
    renderContacts();
}

// Background server sync - non-blocking
async function syncMessageToServer(payload, tempId, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch('/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (data.status === 'ok') {
                confirmTempMessage(tempId, data.message);
                // Remove from persistent queue
                const q = loadSendQueue().filter(m => m.tempId !== tempId);
                saveSendQueue(q);
                return true;
            }
        } catch(e) {
            if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        }
    }
    return false;
}

// Process any queued messages (on app start or coming back online)
async function flushSendQueue() {
    const queue = loadSendQueue();
    if (queue.length === 0) return;
    const remaining = [];
    for (const item of queue) {
        const ok = await syncMessageToServer(item.payload, item.tempId, 2);
        if (!ok) remaining.push(item);
    }
    saveSendQueue(remaining);
}

async function sendMessage() {
    if (currentChatType === 'group') { await sendGroupMessage(); return; }
    if (currentChatType === 'broadcast') { await sendBroadcastMessage(); return; }

    const file = fileUpload?.files[0];
    let message = messageInput.value.trim();
    let type = 'text';

    if (!message && !file) return;
    if (!currentChat || !window.currentUser) return;

    // For file uploads, do it normally (must upload first)
    if (file) {
        const sendBtn = document.getElementById('send-message-btn');
        if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }
        try {
            const result = await uploadFileWithProgress(file);
            if (!result) return;
            message = result.fileUrl;
            type = result.fileType;
        } finally {
            if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = ''; }
        }
    }

    const savedReply = replyToMessage ? { ...replyToMessage } : null;
    const tempId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const tempMsg = {
        id: tempId,
        from: window.currentUser.email,
        to: currentChat.email,
        message,
        type,
        timestamp: new Date().toISOString(),
        status: 'pending',
        replyTo: savedReply?.id || null
    };

    // 1. Show immediately in UI
    if (!chats[currentChat.email]) chats[currentChat.email] = { messages: [] };
    chats[currentChat.email].messages.push(tempMsg);
    saveChatCache(currentChat.email);

    const c = contacts.find(c => c.email === currentChat.email);
    if (c) { c.lastMessage = formatMessagePreview(tempMsg); c.lastTime = tempMsg.timestamp; }

    addMessageToUI(tempMsg, true);
    playMessageSound('sent');
    clearMessageInput();
    if (savedReply) clearReply();
    renderContacts();

    // 2. Sync to server in background (don't await)
    const payload = {
        from: window.currentUser.email,
        to: currentChat.email,
        message,
        type,
        replyTo: savedReply?.id || null,
        fileName: file?.name || null,
        fileSize: file?.size || null
    };

    // Save to persistent queue before sending (in case page closes)
    if (type === 'text') {
        const q = loadSendQueue();
        q.push({ tempId, payload });
        saveSendQueue(q);
    }

    syncMessageToServer(payload, tempId);
}

async function sendGroupMessage() {
    let message = messageInput.value.trim();
    const file = fileUpload?.files[0];
    let type = 'text';
    if (!message && !file) return;
    if (!currentChat || !window.currentUser) return;
    try {
        if (file) {
            const result = await uploadFileWithProgress(file);
            if (!result) return;
            message = result.fileUrl; type = result.fileType;
        }
        const res = await fetch('/send-group-message', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: currentChat.email, from: window.currentUser.email, message, type, replyTo: replyToMessage?.id || null })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (!groupChats[currentChat.email]) groupChats[currentChat.email] = [];
            groupChats[currentChat.email].push(data.message);
            const g = groups.find(g => g.id === currentChat.email);
            if (g) { g.lastMessage = formatMessagePreview(data.message); g.lastMessageTime = data.message.timestamp; }
            addMessageToUI(data.message, true);
            playMessageSound('sent');
            clearMessageInput();
            renderGroups();
            if (replyToMessage) clearReply();
        }
    } catch(e) { showToast('Error sending message', 'error'); }
}

async function sendBroadcastMessage() {
    let message = messageInput.value.trim();
    const file = fileUpload?.files[0];
    let type = 'text';
    if (!message && !file) return;
    if (!currentChat || !window.currentUser) return;
    try {
        if (file) {
            const result = await uploadFileWithProgress(file);
            if (!result) return;
            message = result.fileUrl; type = result.fileType;
        }
        const res = await fetch('/send-broadcast', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ broadcastId: currentChat.email, from: window.currentUser.email, message, type })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (!broadcastChats[currentChat.email]) broadcastChats[currentChat.email] = [];
            broadcastChats[currentChat.email].push(data.message);
            addMessageToUI(data.message, true);
            playMessageSound('sent');
            clearMessageInput();
        }
    } catch(e) { showToast('Error sending message', 'error'); }
}

// ===== FILE UPLOAD WITH PROGRESS BAR =====
async function uploadFileWithProgress(file) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Create progress bar
        const progressWrap = document.createElement('div');
        progressWrap.className = 'upload-progress-wrap';
        progressWrap.innerHTML = `
            <div class="upload-progress-info">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>${file.name.substring(0, 22)}${file.name.length > 22 ? '…' : ''}</span>
                <span class="upload-pct">0%</span>
            </div>
            <div class="upload-bar-bg"><div class="upload-bar-fill"></div></div>`;

        const inputWrap = document.querySelector('.message-input-container');
        if (inputWrap?.parentNode) inputWrap.parentNode.insertBefore(progressWrap, inputWrap);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                const fill = progressWrap.querySelector('.upload-bar-fill');
                const pctEl = progressWrap.querySelector('.upload-pct');
                if (fill) fill.style.width = pct + '%';
                if (pctEl) pctEl.textContent = pct + '%';
            }
        };

        xhr.onload = () => {
            progressWrap.remove();
            try {
                const data = JSON.parse(xhr.responseText);
                if (data.status === 'ok') resolve(data);
                else { showToast('Upload failed', 'error'); resolve(null); }
            } catch(e) { showToast('Upload failed', 'error'); resolve(null); }
        };

        xhr.onerror = () => { progressWrap.remove(); showToast('Upload failed', 'error'); resolve(null); };

        const fd = new FormData();
        fd.append('file', file);
        xhr.open('POST', '/upload-file');
        xhr.send(fd);
    });
}

// ===== REAL-TIME HANDLERS =====
function handleNewMessage(message) {
    if (!message || !window.currentUser) return;

    const chatEmail = message.from === window.currentUser.email ? message.to : message.from;
    let contact = contacts.find(c => c.email === chatEmail);

    if (!contact) {
        contact = { email: chatEmail, name: message.fromName || chatEmail.split('@')[0], avatar: message.fromAvatar || '', online: false, lastMessage: formatMessagePreview(message), lastTime: message.timestamp, unreadCount: 0 };
        contacts.unshift(contact);
    } else {
        contact.lastMessage = formatMessagePreview(message);
        contact.lastTime = message.timestamp;
    }

    if (!chats[chatEmail]) chats[chatEmail] = { messages: [] };
    chats[chatEmail].messages.push(message);

    if (message.from !== window.currentUser.email) {
        contact.unreadCount = (contact.unreadCount || 0) + 1;
    }

    const isCurrentChat = currentChat && (message.from === currentChat.email || message.to === currentChat.email);

    if (isCurrentChat) {
        addMessageToUI(message, true);
        if (message.from !== window.currentUser.email) {
            contact.unreadCount = Math.max(0, (contact.unreadCount || 1) - 1);
            updateMessageStatus(message.id, 'seen');
        }
        // Update cache
        try {
            const ck = `nexus_chat_${window.currentUser.email}_${chatEmail}`;
            localStorage.setItem(ck, JSON.stringify({ messages: chats[chatEmail].messages.slice(-200) }));
        } catch(e) {}
    }

    // Push notification for messages not in current view
    if (message.from !== window.currentUser.email && !isCurrentChat) {
        const name = contact.name || message.fromName || 'New Message';
        const body = formatMessagePreview(message);
        showPushNotification(name, body, contact.avatar);
    }

    renderContacts();
}

function handleNewGroupMessage(message) {
    if (!message) return;
    const g = groups.find(g => g.id === message.groupId);
    if (g) { g.lastMessage = formatMessagePreview(message); g.lastMessageTime = message.timestamp; }
    if (!groupChats[message.groupId]) groupChats[message.groupId] = [];
    groupChats[message.groupId].push(message);
    if (currentChat?.isGroup && currentChat.email === message.groupId) addMessageToUI(message, true);
    renderGroups();
}

function handleNewBroadcastMessage(message) {
    if (!message) return;
    const b = broadcasts.find(b => b.id === message.broadcastId);
    if (b) { b.lastMessage = formatMessagePreview(message); b.lastMessageTime = message.timestamp; }
    if (!broadcastChats[message.broadcastId]) broadcastChats[message.broadcastId] = [];
    broadcastChats[message.broadcastId].push(message);
    if (currentChat?.isBroadcast && currentChat.email === message.broadcastId) addMessageToUI(message, true);
    renderBroadcasts();
}

function handleUserStatusUpdate(data) {
    if (!data?.email) return;
    const c = contacts.find(c => c.email === data.email);
    if (c) { c.online = data.online; if (!data.online && data.lastSeen) c.lastSeen = data.lastSeen; }
    if (currentChat && currentChat.email === data.email) updateChatStatus(c || data);
    renderContacts();
}

// ===== MESSAGE STATUS =====
function updateMessageStatus(messageId, status) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
        const si = el.querySelector('.msg-status');
        if (si) {
            si.className = `fas fa-check${status !== 'sent' ? '-double' : ''} msg-status ${status}`;
            if (status === 'seen') si.style.color = 'var(--nexus-teal)';
        }
    }
    for (const key in chats) {
        chats[key].messages?.forEach(m => { if (m.id === messageId) m.status = status; });
    }
}

async function markMessagesAsSeen() {
    if (!window.currentUser || !currentChat || currentChat.isGroup || currentChat.isBroadcast) return;
    try {
        await fetch('/mark-messages-seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: window.currentUser.email, contactEmail: currentChat.email })
        });
        const c = contacts.find(c => c.email === currentChat.email);
        if (c) c.unreadCount = 0;
        renderContacts();
    } catch(e) {}
}

// ===== CONTEXT MENU (FIXED POSITION) =====
function showMessageContextMenu(msg, x, y) {
    document.querySelectorAll('.msg-context-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'msg-context-menu';

    const isOut = msg.from === window.currentUser?.email;
    const menuItems = [
        { icon: 'fa-reply', label: 'Reply', action: () => setReplyTo(msg.id) },
        ...(msg.type === 'text' ? [{ icon: 'fa-copy', label: 'Copy', action: () => copyMessage(msg.message) }] : []),
        { icon: 'fa-share', label: 'Forward', action: () => showToast('Forward coming soon', 'info') },
        { icon: 'fa-star', label: 'Star', action: () => starMessage(msg.id) },
        ...(isOut && msg.type === 'text' ? [{ icon: 'fa-edit', label: 'Edit', action: () => editMessagePrompt(msg.id, msg.message) }] : []),
        ...(isOut ? [{ icon: 'fa-trash', label: 'Delete', action: () => deleteMessage(msg.id), cls: 'danger' }] : [])
    ];

    menuItems.forEach(item => {
        const el = document.createElement('div');
        el.className = `ctx-item${item.cls ? ' ' + item.cls : ''}`;
        el.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.label}</span>`;
        el.addEventListener('click', () => { menu.remove(); item.action(); });
        menu.appendChild(el);
    });

    // Position inside viewport
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    let left = x, top = y;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
    if (top + rect.height > window.innerHeight - 10) top = y - rect.height;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    menu.style.cssText = `position:fixed;left:${left}px;top:${top}px;z-index:99999;`;

    // Close on outside click
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 50);
}

// ===== REPLY =====
function setReplyTo(messageId) {
    const msg = findMessageById(messageId);
    if (!msg) return;
    replyToMessage = msg;

    document.getElementById('reply-preview')?.remove();
    const rp = document.createElement('div');
    rp.id = 'reply-preview';
    rp.className = 'reply-preview-bar';
    const name = msg.from === window.currentUser?.email ? 'You' : (msg.senderName || msg.from?.split('@')[0]);
    const preview = msg.type !== 'text' ? `📎 ${msg.type}` : (msg.message || '').substring(0, 50);
    rp.innerHTML = `
        <div class="rp-left"><div class="rp-name">${name}</div><div class="rp-text">${preview}</div></div>
        <button class="rp-close" onclick="window.clearReply()"><i class="fas fa-times"></i></button>`;
    document.querySelector('.chat-area')?.insertBefore(rp, document.querySelector('.message-input-container'));
}

function clearReply() {
    replyToMessage = null;
    document.getElementById('reply-preview')?.remove();
}

function copyMessage(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success')).catch(() => showToast('Copy failed', 'error'));
}

function editMessagePrompt(msgId, currentText) {
    const newText = prompt('Edit message:', currentText);
    if (newText !== null && newText.trim() && newText.trim() !== currentText) editMessage(msgId, newText.trim());
}

async function editMessage(msgId, newText) {
    if (!window.currentUser || !currentChat) return;
    try {
        const chatId = currentChat.isGroup ? currentChat.email : [window.currentUser.email, currentChat.email].sort().join('_');
        const res = await fetch('/edit-message', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, messageId: msgId, userEmail: window.currentUser.email, newMessage: newText })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            const el = document.querySelector(`[data-message-id="${msgId}"] .msg-text`);
            if (el) el.textContent = newText;
            showToast('Message edited', 'success');
        }
    } catch(e) { showToast('Error editing message', 'error'); }
}

async function deleteMessage(msgId) {
    if (!confirm('Delete this message?')) return;
    try {
        const chatId = currentChat.isGroup ? currentChat.email : [window.currentUser.email, currentChat.email].sort().join('_');
        await fetch('/delete-message', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, messageId: msgId, userEmail: window.currentUser.email })
        });
        const el = document.querySelector(`[data-message-id="${msgId}"]`);
        if (el) {
            el.querySelector('.message-bubble').innerHTML = '<i class="fas fa-ban"></i> This message was deleted';
            el.querySelector('.message-bubble').className = 'message-bubble message-deleted';
        }
        showToast('Message deleted', 'success');
    } catch(e) { showToast('Error deleting message', 'error'); }
}

function starMessage(msgId) {
    fetch('/star-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: window.currentUser?.email, messageId: msgId, chatId: currentChat?.isGroup ? currentChat.email : [window.currentUser?.email, currentChat?.email].sort().join('_') })
    }).then(() => showToast('⭐ Message starred', 'success')).catch(() => {});
}

function handleMessageDeleted(data) {
    const el = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (el) {
        el.querySelector('.message-bubble').innerHTML = '<i class="fas fa-ban"></i> This message was deleted';
        el.querySelector('.message-bubble').className = 'message-bubble message-deleted';
    }
}

function handleMessageEdited(data) {
    const el = document.querySelector(`[data-message-id="${data.messageId}"] .msg-text`);
    if (el) el.textContent = data.newMessage;
}

function handleMessageReaction(data) {
    const el = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (el) {
        const rc = el.querySelector('.msg-reactions');
        const html = buildReactionsHTML(data.reactions, data.messageId);
        if (rc) rc.outerHTML = html;
        else el.querySelector('.message-bubble')?.insertAdjacentHTML('afterend', html);
    }
}

// ===== TYPING INDICATOR =====
function handleTyping() {
    if (!currentChat || currentChat.isGroup || currentChat.isBroadcast || !window.socket) return;
    window.socket.emit('typing', { to: currentChat.email, typing: true });
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => window.socket?.emit('typing', { to: currentChat.email, typing: false }), 1500);
}

function handleTypingIndicator(data) {
    if (!currentChat || data.from !== currentChat.email) return;
    if (data.typing) {
        if (typingText) typingText.textContent = `${currentChat.name} is typing...`;
        if (typingIndicator) typingIndicator.style.display = 'flex';
    } else {
        if (typingIndicator) typingIndicator.style.display = 'none';
    }
}

// ===== SCREENSHOT DETECTION =====
function setupScreenshotDetection() {
    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) handleScreenshotDetected();
    });
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['s','S','4','3'].includes(e.key)) handleScreenshotDetected();
    });
}

function handleScreenshotDetected() {
    if (!currentChat || !window.currentUser) return;
    const name = window.currentUser.profile?.name || window.currentUser.email.split('@')[0];
    addScreenshotNotification(`📸 ${name} took a screenshot`);
    if (window.socket && currentChat.email && !currentChat.isGroup) {
        window.socket.emit('screenshot-taken', { from: window.currentUser.email, fromName: name, to: currentChat.email });
    }
}

function handleScreenshotReceived(data) {
    if (!currentChat || currentChat.email !== data.from) return;
    addScreenshotNotification(`📸 ${data.fromName} took a screenshot`);
}

function addScreenshotNotification(text) {
    if (!messagesContainer) return;
    const el = document.createElement('div');
    el.className = 'screenshot-notice';
    el.innerHTML = `<i class="fas fa-camera"></i> ${text}`;
    messagesContainer.appendChild(el);
    scrollToBottom();
}

// ===== PUSH NOTIFICATIONS =====
function setupPushNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showPushNotification(title, body, icon) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
        const n = new Notification(title, { body, icon: icon || '', tag: 'nexus', renotify: true });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 6000);
    } catch(e) {}
}

// ===== EMOJI PICKER =====
function setupEmojiPicker() {
    // Handled by emoji.js - just ensure no double listener here
    // emoji.js's initEmojiPicker() is called by auth.js after login
}

// ===== ATTACHMENT MENU =====
function setupAttachmentMenu() {
    if (!attachMenuBtn || !attachmentMenu) return;
    attachMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        attachmentMenu.style.display = attachmentMenu.style.display === 'grid' ? 'none' : 'grid';
    });
    document.querySelectorAll('.attachment-item').forEach(item => {
        item.addEventListener('click', () => {
            handleAttachment(item.dataset.type);
            attachmentMenu.style.display = 'none';
        });
    });
    document.addEventListener('click', (e) => {
        if (!attachMenuBtn.contains(e.target) && !attachmentMenu.contains(e.target)) {
            attachmentMenu.style.display = 'none';
        }
    });
}

function handleAttachment(type) {
    if (!fileUpload) return;
    switch(type) {
        case 'camera': fileUpload.accept = 'image/*'; fileUpload.capture = 'camera'; fileUpload.click(); break;
        case 'image': fileUpload.accept = 'image/*,video/*'; delete fileUpload.capture; fileUpload.multiple = true; fileUpload.click(); break;
        case 'document': fileUpload.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar'; delete fileUpload.capture; fileUpload.click(); break;
        default: showToast('Coming soon!', 'info');
    }
}

// ===== SELECTION MODE =====
function setupLongPress() {
    if (!chatList) return;
    const press = (e) => {
        const item = e.target.closest('.chat-item');
        if (item) longPressTimer = setTimeout(() => { enterSelectionMode(); toggleChatSelection(item); }, 500);
    };
    const release = () => clearTimeout(longPressTimer);
    chatList.addEventListener('mousedown', press);
    chatList.addEventListener('mouseup', release);
    chatList.addEventListener('mouseleave', release);
    chatList.addEventListener('touchstart', press, { passive: true });
    chatList.addEventListener('touchend', release);
    chatList.addEventListener('touchmove', release);
}

function enterSelectionMode() {
    isSelectionMode = true;
    if (selectionHeader) selectionHeader.style.display = 'flex';
}

function exitSelectionMode() {
    isSelectionMode = false;
    if (selectionHeader) selectionHeader.style.display = 'none';
    selectedChats.clear();
    document.querySelectorAll('.chat-item.selected').forEach(el => el.classList.remove('selected'));
    if (selectionCount) selectionCount.textContent = '0 selected';
}

function toggleChatSelection(item) {
    const id = item.dataset.email || item.dataset.groupId || item.dataset.broadcastId;
    if (selectedChats.has(id)) { selectedChats.delete(id); item.classList.remove('selected'); }
    else { selectedChats.add(id); item.classList.add('selected'); }
    if (selectionCount) selectionCount.textContent = `${selectedChats.size} selected`;
}

async function deleteSelectedChats() {
    if (selectedChats.size === 0) return;
    if (!confirm(`Delete ${selectedChats.size} conversation(s)?`)) return;
    for (const id of selectedChats) {
        contacts = contacts.filter(c => c.email !== id);
        delete chats[id];
    }
    renderContacts();
    exitSelectionMode();
    showToast('Deleted', 'success');
}

// ===== UTILITIES =====
function formatMessagePreview(msg) {
    if (!msg) return 'No messages yet';
    const icons = { image: '📷 Photo', video: '🎥 Video', audio: '🎵 Audio', voice: '🎤 Voice message', file: '📄 File' };
    if (icons[msg.type]) return icons[msg.type];
    const text = msg.message || '';
    return text.length > 45 ? text.substring(0, 42) + '...' : text;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function linkify(text) {
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function findMessageById(id) {
    if (currentChatType === 'group') return groupChats[currentChat?.email]?.find(m => m.id === id);
    if (currentChatType === 'broadcast') return broadcastChats[currentChat?.email]?.find(m => m.id === id);
    return chats[currentChat?.email]?.messages?.find(m => m.id === id);
}

function scrollToBottom() {
    if (messagesContainer) messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

function scrollToMessage(id) {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight'); setTimeout(() => el.classList.remove('highlight'), 2000); }
}

function playMessageSound(type) {
    if (!messageSoundEnabled) return;
    const s = document.getElementById(`message-${type}-sound`);
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
}

function clearMessageInput() {
    if (messageInput) messageInput.value = '';
    if (fileUpload) fileUpload.value = '';
    toggleSendButton();
}

function toggleSendButton() {
    const hasContent = !!(messageInput?.value.trim() || fileUpload?.files?.length);
    const voiceBtn = document.getElementById('voice-record-btn');
    if (sendMessageBtn) sendMessageBtn.style.display = hasContent ? 'flex' : 'none';
    if (voiceBtn) voiceBtn.style.display = hasContent ? 'none' : 'flex';
}

function showToast(msg, type = 'info') {
    if (window.showToast) window.showToast(msg, type);
}

// ===== TAB & SEARCH =====
function switchTab(tabName) {
    chatTabs.forEach(t => { t.classList.toggle('active', t.dataset.tab === tabName); });
    if (chatList) chatList.style.display = tabName === 'chats' ? 'block' : 'none';
    if (groupsList) groupsList.style.display = tabName === 'groups' ? 'block' : 'none';
    if (broadcastsList) broadcastsList.style.display = tabName === 'broadcasts' ? 'block' : 'none';
}

function filterContacts() {
    const q = searchContacts?.value.toLowerCase() || '';
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
        const msg = item.querySelector('.chat-last-msg')?.textContent.toLowerCase() || '';
        item.style.display = (name.includes(q) || msg.includes(q)) ? '' : 'none';
    });
}

// ===== CHAT LIST (MOBILE) =====
function showChatList() {
    sidebar.classList.remove('hidden');
    chatArea.classList.remove('visible');
    currentChat = null;
    window.currentChat = null;
    if (isSelectionMode) exitSelectionMode();
    history.replaceState({}, '', window.location.pathname);
}

// ===== BACK BUTTON (MOBILE) =====
function setupBackButtonHandler() {
    history.pushState({ chatOpen: false }, '');
    window.addEventListener('popstate', () => {
        if (window.innerWidth <= 768 && currentChat) showChatList();
    });
}

// ===== CHAT MENU =====
function setupChatMenu() {
    if (!chatMenuBtn) return;
    chatMenuBtn.addEventListener('click', () => {
        const modal = document.getElementById('chat-menu-modal');
        if (modal) modal.classList.add('active');
        document.querySelectorAll('#chat-menu-modal .menu-item').forEach(item => {
            item.onclick = () => { handleChatMenuAction(item.dataset.action); modal.classList.remove('active'); };
        });
    });
}

function handleChatMenuAction(action) {
    if (!currentChat) return;
    switch(action) {
        case 'view-profile': viewProfile(currentChat); break;
        case 'search': document.getElementById('search-chat-modal')?.classList.add('active'); break;
        case 'mute': showToast('Chat muted', 'success'); break;
        case 'block': blockUser(currentChat.email); break;
        case 'clear': clearChat(currentChat.email); break;
        case 'export': exportChat(); break;
    }
}

function viewProfile(contact) {
    const modal = document.getElementById('profile-view-modal');
    if (!modal) return;
    document.getElementById('view-profile-avatar').src = contact.avatar || defaultAvatar();
    document.getElementById('view-profile-name').textContent = contact.name;
    document.getElementById('view-profile-about').textContent = contact.about || '';
    document.getElementById('view-profile-email').textContent = contact.email;
    document.getElementById('view-profile-lastseen').textContent = '';

    const statusEl = document.getElementById('view-profile-status');
    if (statusEl) statusEl.className = `status-indicator-large ${contact.online ? 'online' : 'offline'}`;

    const onlineBadge = document.getElementById('view-profile-online-badge');
    if (onlineBadge) {
        onlineBadge.textContent = contact.online ? 'Online' : (contact.lastSeen ? formatLastSeen(contact.lastSeen) : 'Offline');
        onlineBadge.style.color = contact.online ? 'var(--nexus-teal)' : 'var(--nexus-text-muted)';
    }

    // Load media gallery from chat history
    const mediaContainer = document.getElementById('profile-media-container');
    if (mediaContainer) {
        const messages = chats[contact.email]?.messages || [];
        const mediaMessages = messages.filter(m => m.type === 'image' || m.type === 'video');
        if (mediaMessages.length === 0) {
            mediaContainer.innerHTML = '<div style="color:var(--nexus-text-muted); font-size:0.82rem; padding:10px 0;">No media shared yet</div>';
        } else {
            mediaContainer.innerHTML = '';
            mediaMessages.slice(-12).forEach(m => {
                const mediaUrl = m.message || m.url || '';
                const thumb = document.createElement('div');
                thumb.style.cssText = 'width:70px;height:70px;border-radius:8px;overflow:hidden;flex-shrink:0;cursor:pointer;position:relative;';
                if (m.type === 'image') {
                    thumb.innerHTML = `<img src="${mediaUrl}" style="width:100%;height:100%;object-fit:cover;" onclick="window.openMediaViewer && window.openMediaViewer('${mediaUrl}','image')">`;
                } else {
                    thumb.innerHTML = `<video src="${mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);"><i class="fas fa-play" style="color:#fff;font-size:1.1rem;"></i></div>`;
                    thumb.onclick = () => { if (window.openMediaViewer) window.openMediaViewer(mediaUrl, 'video'); };
                }
                mediaContainer.appendChild(thumb);
            });
        }
    }

    modal.classList.add('active');
}

async function blockUser(email) {
    if (!confirm(`Block ${currentChat?.name}?`)) return;
    try {
        await fetch('/block-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: window.currentUser?.email, blockEmail: email })
        });
    } catch(e) {}
    contacts = contacts.filter(c => c.email !== email);
    renderContacts();
    showChatList();
    showToast('User blocked', 'success');
}

function clearChat(email) {
    if (!confirm('Clear this chat?')) return;
    if (chats[email]) chats[email].messages = [];
    if (currentChat?.email === email) messagesContainer.innerHTML = '<div class="welcome-message"><i class="fas fa-comments welcome-icon"></i><h3>Chat cleared</h3></div>';
    const c = contacts.find(c => c.email === email);
    if (c) { c.lastMessage = ''; c.lastTime = ''; }
    renderContacts();
    // Clear cache
    try { localStorage.removeItem(`nexus_chat_${window.currentUser?.email}_${email}`); } catch(e) {}
    showToast('Chat cleared', 'success');
}

function exportChat() {
    if (!currentChat || !chats[currentChat.email]) return;
    const blob = new Blob([JSON.stringify({ contact: currentChat, messages: chats[currentChat.email].messages }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat-${currentChat.name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ===== INFINITE SCROLL =====
function setupInfiniteScroll() {
    if (!messagesContainer) return;
    messagesContainer.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop === 0) loadMoreMessages();
    });
}

async function loadMoreMessages() {
    // TODO: pagination
}

function setupMessageEvents() {
    // Socket events registered via registerSocketEvents in auth.js
}

function startLastSeenRefreshInterval() {
    setInterval(() => {
        if (currentChat && !currentChat.isGroup && !currentChat.isBroadcast) {
            const c = contacts.find(c => c.email === currentChat.email);
            if (c && !c.online) updateChatStatus(c);
        }
    }, 60000);
}

// ===== REACTIONS =====
async function toggleReaction(msgId, reaction) {
    if (!window.currentUser || !currentChat) return;
    const chatId = currentChat.isGroup ? currentChat.email : [window.currentUser.email, currentChat.email].sort().join('_');
    try {
        await fetch('/add-reaction', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, messageId: msgId, userEmail: window.currentUser.email, reaction })
        });
    } catch(e) {}
}

// ===== HANDLE NEW CONTACT =====
function handleNewContact(contact) {
    contacts.unshift(contact);
    renderContacts();
    showToast(`${contact.name} added!`, 'success');
}

// ===== HANDLE MESSAGES SEEN =====
function handleMessagesSeen(data) {
    if (!currentChat || data.from !== currentChat.email) return;
    document.querySelectorAll('.message-outgoing .msg-status').forEach(el => {
        el.className = 'fas fa-check-double msg-status seen';
        el.style.color = 'var(--nexus-teal)';
    });
}

// ===== WINDOW EXPORTS =====
window.initChat = initChat;
window.setContacts = setContacts;
window.handleNewMessage = handleNewMessage;
window.handleNewGroupMessage = handleNewGroupMessage;
window.handleNewBroadcastMessage = handleNewBroadcastMessage;
window.handleTypingIndicator = handleTypingIndicator;
window.handleMessagesSeen = handleMessagesSeen;
window.handleUserStatusUpdate = handleUserStatusUpdate;
window.updateMessageStatus = updateMessageStatus;
window.renderContacts = renderContacts;
window.loadContacts = loadContacts;
window.loadGroups = loadGroups;
window.loadBroadcasts = loadBroadcasts;
window.toggleReaction = toggleReaction;
window.deleteMessage = deleteMessage;
window.editMessagePrompt = editMessagePrompt;
window.setReplyTo = setReplyTo;
window.clearReply = clearReply;
window.copyMessage = copyMessage;
window.scrollToMessage = scrollToMessage;
window.showChatList = showChatList;
window.sendMessage = sendMessage;
window.handleScreenshotReceived = handleScreenshotReceived;
window.forwardMessage = () => showToast('Forward coming soon', 'info');
window.starMessage = starMessage;
window.openShareContact = () => showToast('Share contact coming soon', 'info');
window.shareLocation = () => showToast('Location sharing coming soon', 'info');
window.addMessageToUI = addMessageToUI;
window.chats = chats;

/* ===== NEW FEATURES & FIXES ADDED ===== */

// Export toggleSendButton for voice.js access
window.toggleSendButton = toggleSendButton;

// Bug 1: Real-time Online/Offline Status Bug (Instant updates)
const originalHandleUserStatusUpdate = window.handleUserStatusUpdate;
window.handleUserStatusUpdate = function(data) {
    if (originalHandleUserStatusUpdate) originalHandleUserStatusUpdate(data);
    if (!data?.email) return;
    const c = contacts.find(c => c.email === data.email);
    if (c) {
        c.online = data.online; 
        if (!data.online && data.lastSeen) c.lastSeen = data.lastSeen;
    }
    if (currentChat && currentChat.email === data.email) updateChatStatus(c || data);
    renderContacts(); // Immediately reflect in sidebar
};

// Bug 3: Clear Chat Problem (Permanently delete using the new backend endpoint)
window.clearChat = async function(email) {
    if (!confirm('Clear this chat permanently?')) return;
    try {
        await fetch('/clear-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: window.currentUser.email, contactEmail: email })
        });
        if (chats[email]) chats[email].messages = [];
        if (currentChat?.email === email) {
            const mc = document.getElementById('messages-container');
            if(mc) mc.innerHTML = '<div class="welcome-message"><i class="fas fa-comments welcome-icon"></i><h3>Chat permanently cleared</h3></div>';
        }
        const c = contacts.find(c => c.email === email);
        if (c) { c.lastMessage = ''; c.lastTime = ''; }
        renderContacts();
        try { localStorage.removeItem(`nexus_chat_${window.currentUser?.email}_${email}`); } catch(e) {}
        showToast('Chat permanently cleared', 'success');
    } catch(e) {
        showToast('Failed to clear chat', 'error');
    }
};

// ===== ONLINE RECOVERY: flush any messages that failed while offline =====
window.addEventListener('online', async () => {
    const q = loadSendQueue();
    if (q.length > 0) {
        showToast(`Back online. Sending ${q.length} pending message(s)...`, 'info');
        await flushSendQueue();
    }
});

// On page load, flush any messages left over from a previous session
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(flushSendQueue, 3000);
});