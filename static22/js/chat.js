// =====================================
// NEXUS CHAT - CHAT MODULE v3.0 - FIXED
// =====================================

// DOM Elements
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
let lastMessageDate = null;

// ===== INITIALIZATION =====
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

    loadContacts();
    loadGroups();
    loadBroadcasts();

    // Set up message input toggle
    if (messageInput) {
        messageInput.addEventListener('input', toggleSendButton);
    }
}

function registerSocketEvents(sock) {
    sock.on('user-status-update', handleUserStatusUpdate);
    sock.on('new-group-message', handleNewGroupMessage);
    sock.on('new-broadcast-message', handleNewBroadcastMessage);
    sock.on('message-reaction', handleMessageReaction);
    sock.on('message-deleted', handleMessageDeleted);
    sock.on('message-edited', handleMessageEdited);
    sock.on('screenshot-taken', handleScreenshotReceived);
}
window.registerSocketEvents = registerSocketEvents;

// ===== EVENT LISTENERS =====
function setupChatEventListeners() {
    if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                if (messageInput.value.trim() || fileUpload?.files?.length) {
                    sendMessage(); 
                }
            }
        });
        messageInput.addEventListener('input', () => { 
            toggleSendButton(); 
            handleTyping(); 
        });
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                toggleSendButton();
                showFilePreview(e.target.files[0]);
            }
        });
    }

    if (searchContacts) searchContacts.addEventListener('input', filterContacts);
    if (backButton) backButton.addEventListener('click', showChatList);

    if (selectionBack) selectionBack.addEventListener('click', exitSelectionMode);
    if (selectionDelete) selectionDelete.addEventListener('click', deleteSelectedChats);

    chatTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

// ===== SEND BUTTON TOGGLE - FIXED =====
function toggleSendButton() {
    if (!sendMessageBtn) return;
    const hasText = messageInput?.value.trim().length > 0;
    const hasFile = fileUpload?.files?.length > 0;

    if (hasText || hasFile) {
        sendMessageBtn.classList.add('active');
        sendMessageBtn.style.display = 'flex';
    } else {
        sendMessageBtn.classList.remove('active');
        sendMessageBtn.style.display = 'none';
    }
}

// ===== FILE PREVIEW =====
function showFilePreview(file) {
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview';

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.innerHTML = `
                <img src="${e.target.result}" style="max-height:60px; max-width:60px; border-radius:8px;">
                <div style="flex:1;">
                    <div style="font-size:0.8rem; font-weight:600;">${file.name.substring(0,20)}${file.name.length > 20 ? '…' : ''}</div>
                    <div style="font-size:0.7rem; color:var(--nexus-text-muted);">${formatFileSize(file.size)}</div>
                </div>
                <button class="remove-preview" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
            `;
        };
        reader.readAsDataURL(file);
    } else {
        const icon = getFileIcon(file.name.split('.').pop());
        previewContainer.innerHTML = `
            <i class="fas ${icon}" style="font-size:2rem; color:var(--nexus-accent);"></i>
            <div style="flex:1;">
                <div style="font-size:0.8rem; font-weight:600;">${file.name.substring(0,20)}${file.name.length > 20 ? '…' : ''}</div>
                <div style="font-size:0.7rem; color:var(--nexus-text-muted);">${formatFileSize(file.size)}</div>
            </div>
            <button class="remove-preview" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        `;
    }

    document.querySelector('.message-input-container').before(previewContainer);
}

function getFileIcon(ext) {
    const icons = {
        pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word',
        xls: 'fa-file-excel', xlsx: 'fa-file-excel', txt: 'fa-file-alt',
        zip: 'fa-file-archive', rar: 'fa-file-archive', mp3: 'fa-file-audio',
        mp4: 'fa-file-video', jpg: 'fa-file-image', jpeg: 'fa-file-image',
        png: 'fa-file-image', gif: 'fa-file-image'
    };
    return icons[ext?.toLowerCase()] || 'fa-file';
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// ===== CONTACT MANAGEMENT =====
async function loadContacts() {
    if (!window.currentUser) return;
    try {
        const res = await fetch(`/contacts/${window.currentUser.email}`);
        if (res.ok) {
            const serverContacts = await res.json();
            contacts = serverContacts;
            renderContacts();
        }
    } catch (e) { console.error('loadContacts error:', e); }
}

function setContacts(serverContacts) {
    contacts = serverContacts;
    renderContacts();
}

function renderContacts() {
    if (!chatList) return;

    if (!contacts || contacts.length === 0) {
        chatList.innerHTML = `
            <div class="no-contacts">
                <i class="fas fa-user-plus" style="font-size:3rem; opacity:0.3; margin-bottom:10px;"></i>
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

    chatList.innerHTML = '';
    sorted.forEach((contact, i) => {
        chatList.appendChild(createChatItem(contact, i));
    });
}

function createChatItem(contact, index) {
    const el = document.createElement('div');
    el.className = 'chat-item';
    el.dataset.email = contact.email;
    el.dataset.type = 'contact';
    el.style.animationDelay = `${index * 0.05}s`;

    const lastMsg = contact.lastMessage || 'Tap to start chatting';
    const lastTime = contact.lastTime ? window.formatTime(contact.lastTime) : '';
    const unread = contact.unreadCount > 0 ? `<span class="chat-unread">${contact.unreadCount}</span>` : '';

    let statusIcon = '';
    if (chats[contact.email]?.messages?.length) {
        const lm = chats[contact.email].messages[chats[contact.email].messages.length - 1];
        if (lm?.from === window.currentUser?.email) {
            if (lm.status === 'seen') statusIcon = '<i class="fas fa-check-double" style="color:var(--nexus-teal); margin-right:3px; font-size:0.7rem;"></i>';
            else if (lm.status === 'delivered') statusIcon = '<i class="fas fa-check-double" style="margin-right:3px; font-size:0.7rem; opacity:0.6;"></i>';
            else statusIcon = '<i class="fas fa-check" style="margin-right:3px; font-size:0.7rem; opacity:0.5;"></i>';
        }
    }

    el.innerHTML = `
        <div class="chat-avatar-wrap">
            <img src="${contact.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%237C3AED\'%3E%3Cpath d=\'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-6.627 0-12 5.373-12 12h24c0-6.627-5.373-12-12-12z\'/%3E%3C/svg%3E'}" class="chat-avatar">
            <span class="status-dot ${contact.online ? 'online' : ''}"></span>
        </div>
        <div class="chat-info">
            <div class="chat-name-row">
                <span class="chat-name">${contact.name || contact.email.split('@')[0]}</span>
                <span class="chat-time">${lastTime}</span>
            </div>
            <div class="chat-preview-row">
                <span class="chat-last-msg">${statusIcon}${contact.typing ? '<em style="color:var(--nexus-teal);">typing...</em>' : (lastMsg.length > 30 ? lastMsg.substring(0,30) + '…' : lastMsg)}</span>
                ${unread}
            </div>
        </div>`;

    el.addEventListener('click', () => {
        if (isSelectionMode) toggleChatSelection(el);
        else openChat(contact);
    });

    return el;
}

// ===== CHAT OPENING =====
function openChat(contact) {
    currentChat = contact;
    currentChatType = 'contact';

    currentChatAvatar.src = contact.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%237C3AED\'%3E%3Cpath d=\'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-6.627 0-12 5.373-12 12h24c0-6.627-5.373-12-12-12z\'/%3E%3C/svg%3E';
    currentChatName.textContent = contact.name || contact.email.split('@')[0];
    updateChatStatus(contact);

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
    messageInput?.focus();
    markMessagesAsSeen();

    if (voiceCallBtn) voiceCallBtn.style.display = 'flex';
    if (videoCallBtn) videoCallBtn.style.display = 'flex';
}

function openGroupChat(group) {
    currentChat = { ...group, isGroup: true, email: group.id };
    currentChatType = 'group';

    currentChatAvatar.src = group.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%237C3AED\'%3E%3Cpath d=\'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/%3E%3C/svg%3E';
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
    messageInput?.focus();
    if (voiceCallBtn) voiceCallBtn.style.display = 'none';
    if (videoCallBtn) videoCallBtn.style.display = 'none';
}

function openBroadcastChat(broadcast) {
    currentChat = { ...broadcast, isBroadcast: true, email: broadcast.id };
    currentChatType = 'broadcast';

    currentChatAvatar.src = broadcast.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%237C3AED\'%3E%3Cpath d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z\'/%3E%3C/svg%3E';
    currentChatName.textContent = broadcast.name;
    currentChatStatus.textContent = `${broadcast.members?.length || 0} recipients`;

    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden');
        chatArea.classList.add('visible');
    }
    if (emptyChat) emptyChat.style.display = 'none';

    loadBroadcastMessages(broadcast.id);
    messageInput?.focus();
}

// ===== STATUS UPDATE =====
function updateChatStatus(contact) {
    if (!contact) return;
    if (contact.online) {
        currentChatStatus.innerHTML = `<span class="online-dot-pulse"></span> Online`;
        currentChatStatus.className = 'current-chat-status text-online';
        chatStatusIndicator.className = 'status-indicator online';
    } else {
        const ls = window.formatLastSeen ? window.formatLastSeen(contact.lastSeen) : 'Offline';
        currentChatStatus.textContent = ls;
        currentChatStatus.className = 'current-chat-status';
        chatStatusIndicator.className = 'status-indicator offline';
    }
}

// ===== MESSAGE LOADING =====
async function loadChatMessages(contactEmail) {
    if (!window.currentUser) return;

    try {
        const cacheKey = `nexus_chat_${window.currentUser.email}_${contactEmail}`;
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
                localStorage.setItem(`nexus_chat_${window.currentUser.email}_${contactEmail}`, 
                    JSON.stringify({ messages: (chat.messages || []).slice(-200) }));
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
        if (msgDate !== lastDate) { 
            addDateSeparator(msg.timestamp); 
            lastDate = msgDate; 
        }
        addMessageToUI(msg, false);
    });

    scrollToBottom();
}

function addDateSeparator(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    let txt = '';

    if (date.toDateString() === now.toDateString()) txt = 'Today';
    else if (date.toDateString() === new Date(now - 86400000).toDateString()) txt = 'Yesterday';
    else txt = date.toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', weekday: 'long', month: 'long', day: 'numeric' });

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
        ? `<div class="message-sender">${msg.senderName || msg.from?.split('@')[0]}</div>` : '';
    const replyPreview = msg.replyTo ? buildReplyPreview(msg.replyTo) : '';
    const content = buildMessageContent(msg);
    const statusIcon = isOutgoing ? getStatusIcon(msg.status || 'sent') : '';
    const reactionsHTML = (msg.reactions?.length) ? buildReactionsHTML(msg.reactions, msg.id) : '';
    const timeStr = window.formatTime ? window.formatTime(msg.timestamp) : '';

    wrapper.innerHTML = `
        <div class="message-bubble">
            ${senderName}
            ${replyPreview}
            ${content}
            <div class="message-meta">
                <span class="message-time">${timeStr}</span>
                ${statusIcon}
                ${msg.edited ? '<span class="message-edited">edited</span>' : ''}
            </div>
        </div>
        ${reactionsHTML}`;

    wrapper.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageContextMenu(msg, e.clientX, e.clientY);
    });

    messagesContainer.appendChild(wrapper);

    if (msg.type === 'voice') {
        setTimeout(() => initVoiceMessagePlayer(msg.id, msg.message), 150);
    }

    if (animate) {
        scrollToBottom();
        if (!isOutgoing && messageSoundEnabled) playMessageSound('received');
    }
}

function buildMessageContent(msg) {
    switch(msg.type) {
        case 'image':
            return `
                <img src="${msg.message}" alt="Photo" class="message-image" onclick="window.viewMedia && window.viewMedia('${msg.message}', 'image', 'photo.jpg')">`;
        case 'video':
            return `<video controls preload="metadata" style="max-width:260px; border-radius:16px;"><source src="${msg.message}" type="video/mp4"></video>`;
        case 'voice':
            return `
                <div class="voice-player">
                    <button class="play-btn"><i class="fas fa-play"></i></button>
                    <div class="voice-waveform" id="waveform-${msg.id}"></div>
                    <span class="voice-duration">${msg.duration || '0:00'}</span>
                </div>`;
        case 'file': {
            const name = msg.fileName || 'File';
            const size = msg.fileSize ? formatFileSize(msg.fileSize) : '';
            const icon = getFileIcon(name.split('.').pop());
            return `
                <div class="message-file" onclick="window.downloadMedia && window.downloadMedia('${msg.message}', '${name}')">
                    <div class="file-icon"><i class="fas ${icon}"></i></div>
                    <div class="file-info">
                        <div class="file-name">${name.length > 25 ? name.substring(0,22) + '…' : name}</div>
                        ${size ? `<div class="file-size">${size}</div>` : ''}
                    </div>
                    <div class="file-download-btn"><i class="fas fa-download"></i></div>
                </div>`;
        }
        default:
            return `<div class="message-text">${linkify(msg.message || '')}</div>`;
    }
}

function buildReplyPreview(replyToId) {
    const orig = findMessageById(replyToId);
    if (!orig) return '';
    const name = orig.from === window.currentUser?.email ? 'You' : (orig.senderName || orig.from?.split('@')[0]);
    const preview = orig.type !== 'text' ? `📎 ${orig.type}` : (orig.message || '').substring(0, 40);
    return `<div class="message-reply" onclick="scrollToMessage('${replyToId}')"><div class="reply-author">${name}</div><div class="reply-text">${preview}</div></div>`;
}

function buildReactionsHTML(reactions, msgId) {
    const counts = {};
    reactions.forEach(r => { counts[r.reaction] = (counts[r.reaction] || 0) + 1; });
    let html = '<div class="message-reactions">';
    for (const [reaction, count] of Object.entries(counts)) {
        const myReaction = reactions.some(r => r.user === window.currentUser?.email && r.reaction === reaction);
        html += `<span class="reaction-badge ${myReaction ? 'mine' : ''}" onclick="window.toggleReaction && window.toggleReaction('${msgId}', '${reaction}')">${reaction}<span class="reaction-count">${count}</span></span>`;
    }
    return html + '</div>';
}

function getStatusIcon(status) {
    if (status === 'seen') return '<i class="fas fa-check-double message-status seen"></i>';
    if (status === 'delivered') return '<i class="fas fa-check-double message-status delivered"></i>';
    return '<i class="fas fa-check message-status sent"></i>';
}

function formatMessagePreview(msg) {
    if (!msg) return 'No messages yet';
    const icons = { image: '📷 Photo', video: '🎥 Video', audio: '🎵 Audio', voice: '🎤 Voice message', file: '📄 File' };
    return icons[msg.type] || (msg.message?.length > 30 ? msg.message.substring(0,30) + '…' : msg.message || '');
}

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function findMessageById(id) {
    if (currentChatType === 'group') return groupChats[currentChat?.email]?.find(m => m.id === id);
    if (currentChatType === 'broadcast') return broadcastChats[currentChat?.email]?.find(m => m.id === id);
    return chats[currentChat?.email]?.messages?.find(m => m.id === id);
}

// ===== VOICE PLAYER =====
function initVoiceMessagePlayer(msgId, src) {
    if (waveSurferInstances.has(msgId)) return;
    const container = document.getElementById(`waveform-${msgId}`);
    if (!container || !window.WaveSurfer) return;

    try {
        const isOut = container.closest('.message-outgoing') !== null;
        const ws = WaveSurfer.create({
            container,
            waveColor: isOut ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.5)',
            progressColor: isOut ? '#fff' : '#8B5CF6',
            cursorWidth: 0,
            height: 36,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            url: src
        });

        waveSurferInstances.set(msgId, ws);

        const player = container.closest('.voice-player');
        const playBtn = player?.querySelector('.play-btn');
        const durationEl = player?.querySelector('.voice-duration');

        ws.on('finish', () => {
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>';
            currentlyPlaying = null;
        });

        ws.on('ready', () => {
            const dur = ws.getDuration();
            const m = Math.floor(dur / 60);
            const s = Math.floor(dur % 60).toString().padStart(2, '0');
            if (durationEl) durationEl.textContent = `${m}:${s}`;
        });

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (currentlyPlaying && currentlyPlaying !== ws) {
                    currentlyPlaying.pause();
                    const prev = document.querySelector('.play-btn.playing');
                    if (prev) prev.innerHTML = '<i class="fas fa-play"></i>';
                }
                if (ws.isPlaying()) {
                    ws.pause();
                    playBtn.innerHTML = '<i class="fas fa-play"></i>';
                    currentlyPlaying = null;
                } else {
                    ws.play();
                    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    currentlyPlaying = ws;
                }
            });
        }
    } catch(e) { console.warn('WaveSurfer failed:', e); }
}

// ===== SEND MESSAGE =====
async function sendMessage() {
    if (!navigator.onLine) {
        handleOfflineMessage();
        return;
    }

    if (currentChatType === 'group') { await sendGroupMessage(); return; }
    if (currentChatType === 'broadcast') { await sendBroadcastMessage(); return; }

    let message = messageInput?.value.trim();
    const file = fileUpload?.files[0];
    let type = 'text';

    if (!message && !file) return;
    if (!currentChat || !window.currentUser) return;

    try {
        if (file) {
            const result = await uploadFile(file);
            if (!result) return;
            message = result.fileUrl;
            type = result.fileType;
        }

        const res = await fetch('/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: window.currentUser.email,
                to: currentChat.email,
                message, type,
                replyTo: replyToMessage?.id || null,
                fileName: file?.name || null,
                fileSize: file?.size || null
            })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (!chats[currentChat.email]) chats[currentChat.email] = { messages: [] };
            chats[currentChat.email].messages.push(data.message);

            try {
                localStorage.setItem(`nexus_chat_${window.currentUser.email}_${currentChat.email}`, 
                    JSON.stringify({ messages: chats[currentChat.email].messages.slice(-200) }));
            } catch(e) {}

            const c = contacts.find(c => c.email === currentChat.email);
            if (c) { 
                c.lastMessage = formatMessagePreview(data.message); 
                c.lastTime = data.message.timestamp; 
            }

            addMessageToUI(data.message, true);
            playMessageSound('sent');
            clearMessageInput();
            renderContacts();
            if (replyToMessage) clearReply();
        }
    } catch(e) { showToast('Error sending message', 'error'); }
}

async function sendGroupMessage() {
    let message = messageInput?.value.trim();
    const file = fileUpload?.files[0];
    let type = 'text';
    if (!message && !file) return;
    if (!currentChat || !window.currentUser) return;
    try {
        if (file) {
            const result = await uploadFile(file);
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
    let message = messageInput?.value.trim();
    const file = fileUpload?.files[0];
    let type = 'text';
    if (!message && !file) return;
    if (!currentChat || !window.currentUser) return;
    try {
        if (file) {
            const result = await uploadFile(file);
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

// ===== OFFLINE MESSAGE HANDLING =====
let offlineQueue = [];

function handleOfflineMessage() {
    const messageText = messageInput?.value.trim();
    if (!messageText && !fileUpload?.files?.length) return;

    const tempMsg = {
        id: 'temp_' + Date.now(),
        from: window.currentUser.email,
        to: currentChat.email,
        message: messageText || '📎 File (offline)',
        type: 'text',
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    if (!chats[currentChat.email]) chats[currentChat.email] = { messages: [] };
    chats[currentChat.email].messages.push(tempMsg);
    addMessageToUI(tempMsg, true);
    clearMessageInput();

    offlineQueue.push(tempMsg);
    showToast('You are offline. Message queued.', 'warning');
}

window.addEventListener('online', async () => {
    if (offlineQueue.length > 0) {
        showToast('Sending queued messages...', 'info');
        for (let msg of offlineQueue) {
            try {
                await fetch('/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: msg.from,
                        to: msg.to,
                        message: msg.message,
                        type: 'text'
                    })
                });
            } catch(e) {}
        }
        offlineQueue = [];
        showToast('Messages sent!', 'success');
    }
});

async function uploadFile(file) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText);
                resolve(data.status === 'ok' ? data : null);
            } catch(e) { resolve(null); }
        };
        xhr.onerror = () => resolve(null);

        xhr.open('POST', '/upload-file');
        xhr.send(formData);
    });
}

// ===== REAL-TIME HANDLERS =====
function handleNewMessage(message) {
    if (!message || !window.currentUser) return;

    const chatEmail = message.from === window.currentUser.email ? message.to : message.from;
    let contact = contacts.find(c => c.email === chatEmail);

    if (!contact) {
        contact = { email: chatEmail, name: message.fromName || chatEmail.split('@')[0], avatar: null, online: false, lastMessage: formatMessagePreview(message), lastTime: message.timestamp, unreadCount: 0 };
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
        try {
            localStorage.setItem(`nexus_chat_${window.currentUser.email}_${chatEmail}`, 
                JSON.stringify({ messages: chats[chatEmail].messages.slice(-200) }));
        } catch(e) {}
    }

    if (message.from !== window.currentUser.email && !isCurrentChat && document.visibilityState !== 'visible') {
        const name = contact.name || message.fromName || 'New Message';
        const body = formatMessagePreview(message);
        showNotification(name, body);
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
    if (c) { 
        c.online = data.online; 
        if (!data.online && data.lastSeen) c.lastSeen = data.lastSeen; 
    }
    if (currentChat && currentChat.email === data.email) updateChatStatus(c || data);
    renderContacts();
}

function updateMessageStatus(messageId, status) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
        const si = el.querySelector('.message-status');
        if (si) {
            si.className = `fas fa-check${status !== 'sent' ? '-double' : ''} message-status ${status}`;
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

// ===== CONTEXT MENU =====
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

    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    let left = Math.min(x, window.innerWidth - rect.width - 10);
    let top = Math.min(y, window.innerHeight - rect.height - 10);
    left = Math.max(10, left);
    top = Math.max(10, top);
    menu.style.cssText = `position:fixed;left:${left}px;top:${top}px;z-index:99999;`;

    setTimeout(() => {
        const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
        document.addEventListener('click', close);
    }, 50);
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
    const preview = msg.type !== 'text' ? `📎 ${msg.type}` : (msg.message || '').substring(0, 40);
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
        if (res.ok) {
            const el = document.querySelector(`[data-message-id="${msgId}"] .message-text`);
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
    const el = document.querySelector(`[data-message-id="${data.messageId}"] .message-text`);
    if (el) el.textContent = data.newMessage;
}

function handleMessageReaction(data) {
    const el = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (el) {
        const rc = el.querySelector('.message-reactions');
        const html = buildReactionsHTML(data.reactions, data.messageId);
        if (rc) rc.outerHTML = html;
        else el.querySelector('.message-bubble')?.insertAdjacentHTML('afterend', html);
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

// ===== NOTIFICATIONS =====
function setupPushNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const n = new Notification(title, { body, icon: '/static/icon.png', tag: 'nexus' });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 5000);
    } catch(e) {}
}

// ===== EMOJI PICKER =====
function setupEmojiPicker() {
    if (!emojiPickerBtn || !emojiPicker) return;
    emojiPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiPickerBtn) {
            emojiPicker.style.display = 'none';
        }
    });
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
        case 'camera': 
            fileUpload.accept = 'image/*'; 
            fileUpload.capture = 'environment'; 
            fileUpload.click(); 
            break;
        case 'image': 
            fileUpload.accept = 'image/*,video/*'; 
            delete fileUpload.capture; 
            fileUpload.multiple = true; 
            fileUpload.click(); 
            break;
        case 'document': 
            fileUpload.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar'; 
            delete fileUpload.capture; 
            fileUpload.click(); 
            break;
        default: 
            showToast('Coming soon!', 'info');
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
function scrollToBottom() {
    if (messagesContainer) messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

function scrollToMessage(id) {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (el) { 
        el.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
        el.classList.add('highlight'); 
        setTimeout(() => el.classList.remove('highlight'), 2000); 
    }
}

function playMessageSound(type) {
    if (!messageSoundEnabled) return;
    const s = document.getElementById(`message-${type}-sound`);
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
}

function clearMessageInput() {
    if (messageInput) messageInput.value = '';
    if (fileUpload) fileUpload.value = '';
    document.querySelectorAll('.file-preview').forEach(el => el.remove());
    toggleSendButton();
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

    const statusList = document.getElementById('status-list');
    if (statusList) statusList.style.display = tabName === 'status' ? 'block' : 'none';
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
    if (isSelectionMode) exitSelectionMode();
    history.replaceState({}, '', window.location.pathname);
}

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
    document.getElementById('view-profile-avatar').src = contact.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%237C3AED\'%3E%3Cpath d=\'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-6.627 0-12 5.373-12 12h24c0-6.627-5.373-12-12-12z\'/%3E%3C/svg%3E';
    document.getElementById('view-profile-name').textContent = contact.name || contact.email.split('@')[0];
    document.getElementById('view-profile-about').textContent = contact.about || '';
    document.getElementById('view-profile-email').textContent = contact.email;
    document.getElementById('view-profile-lastseen').textContent = contact.online ? 'Online' : (window.formatLastSeen ? window.formatLastSeen(contact.lastSeen) : 'Offline');

    const mediaContainer = document.querySelector('.profile-media-container');
    if (mediaContainer) {
        mediaContainer.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            mediaContainer.innerHTML += `<div class="media-thumb"><i class="fas fa-image"></i></div>`;
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
            body: JSON.stringify({ userEmail: window.currentUser.email, blockEmail: email })
        });
        contacts = contacts.filter(c => c.email !== email);
        renderContacts();
        showChatList();
        showToast('User blocked', 'success');
    } catch(e) {
        showToast('Error blocking user', 'error');
    }
}

async function clearChat(email) {
    if (!confirm('Clear this chat permanently?')) return;
    try {
        await fetch('/clear-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: window.currentUser.email, contactEmail: email })
        });
        if (chats[email]) chats[email].messages = [];
        if (currentChat?.email === email) {
            messagesContainer.innerHTML = '<div class="welcome-message"><i class="fas fa-comments welcome-icon"></i><h3>Chat cleared</h3></div>';
        }
        const c = contacts.find(c => c.email === email);
        if (c) { c.lastMessage = ''; c.lastTime = ''; }
        renderContacts();
        try { localStorage.removeItem(`nexus_chat_${window.currentUser?.email}_${email}`); } catch(e) {}
        showToast('Chat cleared', 'success');
    } catch(e) {
        showToast('Failed to clear chat', 'error');
    }
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

// ===== GROUP MANAGEMENT =====
function renderGroups() {
    if (!groupsList) return;
    if (!groups || groups.length === 0) {
        groupsList.innerHTML = `<div class="no-contacts"><i class="fas fa-users" style="font-size:3rem; opacity:0.3;"></i><p>No groups yet.</p><button class="nexus-btn secondary" onclick="window.openModal(document.getElementById('create-group-modal'))"><i class="fas fa-plus"></i> Create Group</button></div>`;
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
                    <img src="${g.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%237C3AED\'%3E%3Cpath d=\'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/%3E%3C/svg%3E'}" class="chat-avatar">
                </div>
                <div class="chat-info">
                    <div class="chat-name-row"><span class="chat-name">${g.name}</span><span class="chat-time">${g.lastMessageTime ? window.formatTime(g.lastMessageTime) : ''}</span></div>
                    <div class="chat-preview-row"><span class="chat-last-msg">${g.lastMessage || 'No messages yet'}</span></div>
                </div>`;
            el.addEventListener('click', () => openGroupChat(g));
            groupsList.appendChild(el);
        });
}

function renderBroadcasts() {
    if (!broadcastsList) return;
    if (!broadcasts || broadcasts.length === 0) {
        broadcastsList.innerHTML = `<div class="no-contacts"><i class="fas fa-bullhorn" style="font-size:3rem; opacity:0.3;"></i><p>No broadcast lists yet.</p></div>`;
        return;
    }
    broadcastsList.innerHTML = '';
    broadcasts.forEach(b => {
        const el = document.createElement('div');
        el.className = 'chat-item';
        el.dataset.broadcastId = b.id;
        el.innerHTML = `
            <div class="chat-avatar-wrap"><img src="${b.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%237C3AED\'%3E%3Cpath d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z\'/%3E%3C/svg%3E'}" class="chat-avatar"></div>
            <div class="chat-info">
                <div class="chat-name-row"><span class="chat-name">${b.name}</span></div>
                <div class="chat-preview-row"><span class="chat-last-msg">${b.lastMessage || 'No messages yet'}</span></div>
            </div>`;
        el.addEventListener('click', () => openBroadcastChat(b));
        broadcastsList.appendChild(el);
    });
}

function loadGroups() {
    if (!window.currentUser) return;
    fetch(`/user-groups/${window.currentUser.email}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => { groups = data; renderGroups(); })
        .catch(() => {});
}

function loadBroadcasts() {
    if (!window.currentUser) return;
    fetch(`/user-broadcasts/${window.currentUser.email}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => { broadcasts = data; renderBroadcasts(); })
        .catch(() => {});
}

// ===== INFINITE SCROLL =====
function setupInfiniteScroll() {
    if (!messagesContainer) return;
    messagesContainer.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop === 0) loadMoreMessages();
    });
}

function loadMoreMessages() {
    // Pagination would go here
}

function setupMessageEvents() {}

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

function handleNewContact(contact) {
    contacts.unshift(contact);
    renderContacts();
    showToast(`${contact.name} added!`, 'success');
}

function handleMessagesSeen(data) {
    if (!currentChat || data.from !== currentChat.email) return;
    document.querySelectorAll('.message-outgoing .message-status').forEach(el => {
        el.className = 'fas fa-check-double message-status seen';
        el.style.color = 'var(--nexus-teal)';
    });
}

// ===== EXPORTS =====
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
window.addMessageToUI = addMessageToUI;
window.chats = chats;