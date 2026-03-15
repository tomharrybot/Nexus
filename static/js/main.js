// =====================================
// NEXUS CHAT - MAIN MODULE v3.0
// Profile, Settings, Modals, Groups, Broadcasts
// KEY FIX: No DOMContentLoaded auto-init, called by auth.js after login
// =====================================

// DOM Elements
const userProfileBtn = document.getElementById('user-profile-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const profileModal = document.getElementById('profile-modal');
const addContactModal = document.getElementById('add-contact-modal');
const menuModal = document.getElementById('menu-modal');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const avatarUpload = document.getElementById('avatar-upload');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');
const profileName = document.getElementById('profile-name');
const profileAbout = document.getElementById('profile-about');
const saveProfileBtn = document.getElementById('save-profile-btn');
const contactEmailInput = document.getElementById('contact-email-input');
const contactSearchResults = document.getElementById('contact-search-results');
const addContactBtn = document.getElementById('add-contact-btn');
const userAvatar = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const menuProfile = document.getElementById('menu-profile');
const userStatus = document.getElementById('user-status');
const menuCreateGroup = document.getElementById('menu-create-group');
const menuCreateBroadcast = document.getElementById('menu-create-broadcast');
const menuNotifications = document.getElementById('menu-notifications');
const menuThemes = document.getElementById('menu-themes');
const menuSettings = document.getElementById('menu-settings');
const themeModal = document.getElementById('theme-modal');
const notificationsModal = document.getElementById('notifications-modal');
const settingsModal = document.getElementById('settings-modal');
const createGroupModal = document.getElementById('create-group-modal');
const createBroadcastModal = document.getElementById('create-broadcast-modal');
const groupAvatarUpload = document.getElementById('group-avatar-upload');
const changeGroupAvatarBtn = document.getElementById('change-group-avatar-btn');
const groupNameInput = document.getElementById('group-name');
const groupMembersSearch = document.getElementById('group-members-search');
const membersList = document.getElementById('members-list');
const selectedMembersEl = document.getElementById('selected-members');
const createGroupBtn = document.getElementById('create-group-btn');
const broadcastNameInput = document.getElementById('broadcast-name');
const broadcastMembersSearch = document.getElementById('broadcast-members-search');
const broadcastMembersList = document.getElementById('broadcast-members-list');
const broadcastSelectedMembers = document.getElementById('broadcast-selected-members');
const createBroadcastBtn = document.getElementById('create-broadcast-btn');
const notificationsToggle = document.getElementById('notifications-toggle');
const soundToggle = document.getElementById('sound-toggle');
const themeOptions = document.querySelectorAll('.theme-option');
const qrBtn = document.getElementById('qr-btn');
const qrModal = document.getElementById('qr-modal');
const qrCode = document.getElementById('qr-code');
const downloadQrBtn = document.getElementById('download-qr-btn');

const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%236C3AE8'/%3E%3Ccircle cx='20' cy='15' r='7' fill='white' opacity='0.9'/%3E%3Cellipse cx='20' cy='35' rx='13' ry='10' fill='white' opacity='0.9'/%3E%3C/svg%3E`;

let selectedGroupMembers = new Set();
let selectedBroadcastMembers = new Set();
let userSettings = { theme: 'dark', notifications: true, sound: true };
let pendingGroupAvatarUrl = null;

// ===== INITIALIZATION =====
// KEY FIX: No DOMContentLoaded - called by auth.js after login
function initMain() {
    loadUserSettings();
    setupMainEventListeners();
    updateProfileUI();
    requestPermissionsOnce(); // Fix Bug 19
}

function setupMainEventListeners() {
    if (userProfileBtn) userProfileBtn.addEventListener('click', () => openModal(profileModal));
    if (newChatBtn) newChatBtn.addEventListener('click', () => openModal(addContactModal));
    if (menuBtn) menuBtn.addEventListener('click', () => openModal(menuModal));
    if (qrBtn) qrBtn.addEventListener('click', () => { openModal(qrModal); generateQRCode(); });

    // Close modal buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    // Avatar upload
    if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', () => avatarUpload?.click());
    if (avatarUpload) avatarUpload.addEventListener('change', handleAvatarUpload);

    // Save profile
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

    // Add contact
    if (addContactBtn) addContactBtn.addEventListener('click', addContact);
    if (contactEmailInput) contactEmailInput.addEventListener('input', searchUsers);

    // Menu items
    if (menuProfile) menuProfile.addEventListener('click', () => { closeModals(); openModal(profileModal); });
    if (menuCreateGroup) menuCreateGroup.addEventListener('click', () => { closeModals(); openModal(createGroupModal); loadContactsForGroup(); });
    if (menuCreateBroadcast) menuCreateBroadcast.addEventListener('click', () => { closeModals(); openModal(createBroadcastModal); loadContactsForBroadcast(); });
    if (menuNotifications) menuNotifications.addEventListener('click', () => { closeModals(); openModal(notificationsModal); });
    if (menuThemes) menuThemes.addEventListener('click', () => { closeModals(); openModal(themeModal); });
    if (menuSettings) menuSettings.addEventListener('click', () => { closeModals(); openModal(settingsModal); });
    const menuHelp = document.getElementById('menu-help');
    const helpModal = document.getElementById('help-modal');
    if (menuHelp && helpModal) menuHelp.addEventListener('click', () => { closeModals(); openModal(helpModal); });

    // Theme
    themeOptions.forEach(opt => opt.addEventListener('click', () => changeTheme(opt.dataset.theme)));

    // Group creation
    if (changeGroupAvatarBtn) changeGroupAvatarBtn.addEventListener('click', () => groupAvatarUpload?.click());
    if (groupAvatarUpload) groupAvatarUpload.addEventListener('change', handleGroupAvatarUpload);
    if (groupNameInput) groupNameInput.addEventListener('input', updateCreateGroupButton);
    if (groupMembersSearch) groupMembersSearch.addEventListener('input', () => filterMembersList(groupMembersSearch.value, membersList));
    if (createGroupBtn) createGroupBtn.addEventListener('click', createGroup);

    // Broadcast creation
    if (broadcastNameInput) broadcastNameInput.addEventListener('input', updateCreateBroadcastButton);
    if (broadcastMembersSearch) broadcastMembersSearch.addEventListener('input', () => filterMembersList(broadcastMembersSearch.value, broadcastMembersList));
    if (createBroadcastBtn) createBroadcastBtn.addEventListener('click', createBroadcast);

    // Notification toggles
    if (notificationsToggle) notificationsToggle.addEventListener('change', updateNotificationSettings);
    if (soundToggle) soundToggle.addEventListener('change', updateNotificationSettings);

    // QR download
    if (downloadQrBtn) downloadQrBtn.addEventListener('click', downloadQRCode);

    // Click outside modals
    window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeModals(); });

    // Window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const sb = document.getElementById('sidebar');
            if (sb) sb.classList.remove('hidden');
            const ca = document.getElementById('chat-area');
            if (ca && !window.currentChat) ca.classList.remove('visible');
        }
    });
}

// ===== MODAL FUNCTIONS =====
function openModal(modal) {
    if (!modal) return;
    closeModals();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (modal === profileModal) loadProfileData();
    if (modal === qrModal) generateQRCode();
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.body.style.overflow = '';
    if (contactEmailInput) contactEmailInput.value = '';
    if (contactSearchResults) contactSearchResults.innerHTML = '';
}

// ===== PROFILE =====
function loadProfileData() {
    const user = window.currentUser;
    if (!user) return;
    if (profileAvatarPreview) profileAvatarPreview.src = user.profile?.avatar || DEFAULT_AVATAR;
    if (profileName) profileName.value = user.profile?.name || user.username || '';
    if (profileAbout) profileAbout.value = user.profile?.about || "Hey there! I'm using Nexus Chat";
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => { if (profileAvatarPreview) profileAvatarPreview.src = ev.target.result; };
    reader.readAsDataURL(file);

    try {
        const fd = new FormData();
        fd.append('avatar', file);
        const res = await fetch('/upload-avatar', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.status === 'ok' && window.currentUser) {
            window.currentUser.profile = window.currentUser.profile || {};
            window.currentUser.profile.avatar = data.avatarUrl;
            // Update preview to the real URL (not base64)
            if (profileAvatarPreview) profileAvatarPreview.src = data.avatarUrl;
            localStorage.setItem('nexus_current_user', JSON.stringify(window.currentUser));
            showToast('Avatar updated!', 'success');
        }
    } catch(e) { showToast('Upload failed', 'error'); }
}

async function saveProfile() {
    const user = window.currentUser;
    if (!user) return;
    const saveText = document.getElementById('save-profile-text');
    const saveSpinner = document.getElementById('save-profile-spinner');
    if (saveProfileBtn) saveProfileBtn.disabled = true;
    if (saveText) saveText.style.display = 'none';
    if (saveSpinner) saveSpinner.style.display = 'inline-block';

    try {
        // Always use the stored URL, never send a base64 DataURL
        const avatarToSend = user.profile?.avatar?.startsWith('data:') ? null : (user.profile?.avatar || null);
        const res = await fetch('/update-profile', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, name: profileName?.value, about: profileAbout?.value, avatar: avatarToSend })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            window.currentUser = data.user;
            localStorage.setItem('nexus_current_user', JSON.stringify(data.user));
            updateProfileUI();
            closeModals();
            showToast('Profile saved!', 'success');
        } else {
            showToast(data.msg || 'Error saving profile', 'error');
        }
    } catch(e) { showToast('Error saving profile', 'error'); }
    finally {
        if (saveProfileBtn) saveProfileBtn.disabled = false;
        if (saveText) saveText.style.display = '';
        if (saveSpinner) saveSpinner.style.display = 'none';
    }
}

function updateProfileUI() {
    const user = window.currentUser;
    if (!user) return;
    if (userAvatar && user.profile?.avatar) userAvatar.src = user.profile.avatar;
    if (userStatus) userStatus.className = 'status-indicator online';
}

// ===== CONTACT SEARCH & ADD =====
async function searchUsers() {
    const user = window.currentUser;
    const query = contactEmailInput?.value.trim();
    if (!query || !query.includes('@')) { if (contactSearchResults) contactSearchResults.innerHTML = ''; return; }

    try {
        const res = await fetch('/users');
        const users = await res.json();
        const filtered = users.filter(u => u.email !== user?.email &&
            (u.email.toLowerCase().includes(query.toLowerCase()) || u.profile?.name?.toLowerCase().includes(query.toLowerCase())));

        if (contactSearchResults) {
            if (filtered.length === 0) {
                contactSearchResults.innerHTML = '<div class="no-results">No users found</div>';
            } else {
                contactSearchResults.innerHTML = '';
                filtered.forEach(u => {
                    const el = document.createElement('div');
                    el.className = 'contact-result-item';
                    el.innerHTML = `
                        <img src="${u.profile?.avatar || DEFAULT_AVATAR}" class="contact-result-avatar" style="width:40px;height:40px;border-radius:50%;">
                        <div class="contact-result-info">
                            <div class="contact-result-name">${u.profile?.name || u.email}</div>
                            <div class="contact-result-email">${u.email}</div>
                        </div>
                        <span class="status-dot ${u.online ? 'online' : ''}"></span>`;
                    el.addEventListener('click', () => { if (contactEmailInput) contactEmailInput.value = u.email; contactSearchResults.innerHTML = ''; });
                    contactSearchResults.appendChild(el);
                });
            }
        }
    } catch(e) {}
}

async function addContact() {
    const user = window.currentUser;
    const contactEmail = contactEmailInput?.value.trim();
    if (!contactEmail || !user) return;

    const addText = document.getElementById('add-contact-text');
    const addSpinner = document.getElementById('add-contact-spinner');
    if (addContactBtn) addContactBtn.disabled = true;
    if (addText) addText.style.display = 'none';
    if (addSpinner) addSpinner.style.display = 'inline-block';

    try {
        const res = await fetch('/add-contact', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: user.email, contactEmail })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (window.loadContacts) window.loadContacts();
            closeModals();
            showToast('Contact added!', 'success');
            if (window.openChat && data.contact) setTimeout(() => window.openChat(data.contact), 300);
        } else {
            showToast(data.msg || 'Could not add contact', 'error');
        }
    } catch(e) { showToast('Error adding contact', 'error'); }
    finally {
        if (addContactBtn) addContactBtn.disabled = false;
        if (addText) addText.style.display = '';
        if (addSpinner) addSpinner.style.display = 'none';
    }
}

// ===== GROUP FUNCTIONS =====
async function loadContactsForGroup() {
    const user = window.currentUser;
    if (!user || !membersList) return;
    try {
        const res = await fetch(`/contacts/${user.email}`);
        if (res.ok) {
            const contacts = await res.json();
            renderMembersList(contacts, 'group');
        }
    } catch(e) {}
}

async function loadContactsForBroadcast() {
    const user = window.currentUser;
    if (!user || !broadcastMembersList) return;
    try {
        const res = await fetch(`/contacts/${user.email}`);
        if (res.ok) {
            const contacts = await res.json();
            renderMembersList(contacts, 'broadcast');
        }
    } catch(e) {}
}

function renderMembersList(contacts, type) {
    const container = type === 'group' ? membersList : broadcastMembersList;
    if (!container) return;
    container.innerHTML = '';
    if (!contacts?.length) { container.innerHTML = '<div class="no-results">No contacts found</div>'; return; }
    contacts.forEach(c => {
        const el = document.createElement('div');
        el.className = 'member-item';
        el.dataset.email = c.email;
        el.innerHTML = `<img src="${c.avatar || DEFAULT_AVATAR}" class="member-avatar" style="width:40px;border-radius:50%;"><span class="member-name" style="flex:1;">${c.name}</span><input type="checkbox" class="member-checkbox">`;
        el.querySelector('.member-checkbox').addEventListener('change', (e) => {
            if (e.target.checked) addSelectedMember(c, type);
            else removeSelectedMember(c.email, type);
        });
        container.appendChild(el);
    });
}

function filterMembersList(query, container) {
    if (!container) return;
    container.querySelectorAll('.member-item').forEach(item => {
        const name = item.querySelector('.member-name')?.textContent.toLowerCase() || '';
        const email = (item.dataset.email || '').toLowerCase();
        item.style.display = (name.includes(query.toLowerCase()) || email.includes(query.toLowerCase())) ? '' : 'none';
    });
}

function addSelectedMember(contact, type) {
    const container = type === 'group' ? selectedMembersEl : broadcastSelectedMembers;
    const set = type === 'group' ? selectedGroupMembers : selectedBroadcastMembers;
    if (set.has(contact.email) || !container) return;
    set.add(contact.email);
    const el = document.createElement('div');
    el.className = 'selected-member-chip';
    el.dataset.email = contact.email;
    el.innerHTML = `<img src="${contact.avatar || DEFAULT_AVATAR}" class="selected-member-avatar"><span>${contact.name}</span><button class="remove-member" onclick="window.removeSelectedMember('${contact.email}','${type}')"><i class="fas fa-times"></i></button>`;
    container.appendChild(el);
    type === 'group' ? updateCreateGroupButton() : updateCreateBroadcastButton();
}

window.removeSelectedMember = function(email, type) {
    const container = type === 'group' ? selectedMembersEl : broadcastSelectedMembers;
    const set = type === 'group' ? selectedGroupMembers : selectedBroadcastMembers;
    const listContainer = type === 'group' ? membersList : broadcastMembersList;
    set.delete(email);
    container?.querySelector(`[data-email="${email}"]`)?.remove();
    const cb = listContainer?.querySelector(`[data-email="${email}"] .member-checkbox`);
    if (cb) cb.checked = false;
    type === 'group' ? updateCreateGroupButton() : updateCreateBroadcastButton();
};

function updateCreateGroupButton() {
    if (createGroupBtn) createGroupBtn.disabled = selectedGroupMembers.size === 0 || !groupNameInput?.value.trim();
}

function updateCreateBroadcastButton() {
    if (createBroadcastBtn) createBroadcastBtn.disabled = selectedBroadcastMembers.size === 0 || !broadcastNameInput?.value.trim();
}

async function createGroup() {
    const user = window.currentUser;
    const name = groupNameInput?.value.trim();
    const members = Array.from(selectedGroupMembers);
    if (!name || members.length === 0 || !user) return;
    try {
        const res = await fetch('/create-group', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorEmail: user.email, groupName: name, members, groupAvatar: pendingGroupAvatarUrl })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            closeModals();
            selectedGroupMembers.clear();
            pendingGroupAvatarUrl = null;
            if (selectedMembersEl) selectedMembersEl.innerHTML = '';
            if (groupNameInput) groupNameInput.value = '';
            const avatarPreview = document.getElementById('group-avatar-preview');
            if (avatarPreview) avatarPreview.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237C3AED'%3E%3Cpath d='M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
            if (window.loadGroups) window.loadGroups();
            document.querySelector('[data-tab="groups"]')?.click();
            showToast('Group created!', 'success');
        } else showToast(data.msg || 'Error creating group', 'error');
    } catch(e) { showToast('Error creating group', 'error'); }
}

async function createBroadcast() {
    const user = window.currentUser;
    const name = broadcastNameInput?.value.trim();
    const members = Array.from(selectedBroadcastMembers);
    if (!name || members.length === 0 || !user) return;
    try {
        const res = await fetch('/create-broadcast', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorEmail: user.email, name, members })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            closeModals();
            selectedBroadcastMembers.clear();
            if (broadcastSelectedMembers) broadcastSelectedMembers.innerHTML = '';
            if (broadcastNameInput) broadcastNameInput.value = '';
            if (window.loadBroadcasts) window.loadBroadcasts();
            document.querySelector('[data-tab="broadcasts"]')?.click();
            showToast('Broadcast created!', 'success');
        } else showToast(data.msg || 'Error creating broadcast', 'error');
    } catch(e) { showToast('Error creating broadcast', 'error'); }
}

async function handleGroupAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const preview = document.getElementById('group-avatar-preview');
    const reader = new FileReader();
    reader.onload = (ev) => { if (preview) preview.src = ev.target.result; };
    reader.readAsDataURL(file);

    try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/upload-file', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.status === 'ok') {
            pendingGroupAvatarUrl = data.fileUrl;
        }
    } catch(e) { console.warn('Group avatar upload failed:', e); }
}

// ===== THEME =====
function changeTheme(theme, silent = false) {
    document.body.classList.remove('light-theme', 'dark-theme', 'midnight-theme', 'ocean-theme', 'forest-theme', 'rose-theme');
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.add(isDark ? 'dark-theme' : 'light-theme');
    } else {
        document.body.classList.add(theme + '-theme');
    }
    localStorage.setItem('nexus_theme', theme);
    document.querySelectorAll('.theme-option').forEach(o => o.classList.toggle('active', o.dataset.theme === theme));
    if (!silent) {
        const names = { dark: 'Dark', light: 'Light', midnight: 'Midnight', ocean: 'Ocean', forest: 'Forest', rose: 'Rose', system: 'System' };
        showToast(`Theme: ${names[theme] || theme}`, 'success');
    }
}

// ===== NOTIFICATIONS =====
function updateNotificationSettings() {
    const settings = { sound: soundToggle?.checked ?? true };
    localStorage.setItem('nexus_notif', JSON.stringify(settings));
    window.messageSoundEnabled = settings.sound;
    showToast('Notification settings saved', 'success');
}

// ===== FONT SETTINGS =====
function applyFontSettings(englishFont, urduFont) {
    const ef = englishFont || 'Plus Jakarta Sans';
    const uf = urduFont || 'Noto Nastaliq Urdu';
    const fontVal = `'${uf}', '${ef}', -apple-system, BlinkMacSystemFont, sans-serif`;
    document.documentElement.style.setProperty('--app-font', fontVal);
    document.body.style.fontFamily = fontVal;
}

function loadFontSettings() {
    const savedFonts = localStorage.getItem('nexus_fonts');
    const fonts = savedFonts ? JSON.parse(savedFonts) : { english: 'Plus Jakarta Sans', urdu: 'Noto Nastaliq Urdu' };
    applyFontSettings(fonts.english, fonts.urdu);
    const engSel = document.getElementById('english-font-setting');
    const urdSel = document.getElementById('urdu-font-setting');
    if (engSel) engSel.value = fonts.english;
    if (urdSel) urdSel.value = fonts.urdu;
}

const applyFontBtn = document.getElementById('apply-font-btn');
if (applyFontBtn) {
    applyFontBtn.addEventListener('click', () => {
        const engSel = document.getElementById('english-font-setting');
        const urdSel = document.getElementById('urdu-font-setting');
        const english = engSel?.value || 'Plus Jakarta Sans';
        const urdu = urdSel?.value || 'Noto Nastaliq Urdu';
        localStorage.setItem('nexus_fonts', JSON.stringify({ english, urdu }));
        applyFontSettings(english, urdu);
        showToast('Font applied!', 'success');
    });
}

// ===== SETTINGS =====
function loadUserSettings() {
    const savedTheme = localStorage.getItem('nexus_theme');
    if (savedTheme && savedTheme !== 'dark') changeTheme(savedTheme, true);
    const notifSettings = localStorage.getItem('nexus_notif');
    if (notifSettings) {
        const s = JSON.parse(notifSettings);
        if (soundToggle) soundToggle.checked = s.sound ?? true;
        window.messageSoundEnabled = s.sound ?? true;
    }
    loadFontSettings();
}

// ===== QR CODE =====
function generateQRCode() {
    const user = window.currentUser;
    if (!qrCode || !user) return;
    qrCode.innerHTML = '';
    if (window.QRCode) {
        new QRCode(qrCode, {
            text: JSON.stringify({ email: user.email, name: user.profile?.name || user.username }),
            width: 200, height: 200,
            colorDark: '#7C3AED', colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel?.H || 1
        });
    } else {
        qrCode.innerHTML = '<p>QR unavailable</p>';
    }
}

function downloadQRCode() {
    const canvas = qrCode?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `nexus-qr.png`;
    a.href = canvas.toDataURL();
    a.click();
}

// ===== TOAST (fallback if auth.js not loaded yet) =====
function showToast(msg, type = 'info') {
    if (window.showToast && window.showToast !== showToast) {
        window.showToast(msg, type);
        return;
    }
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3200);
}

// ===== EXPORTS =====
window.initMain = initMain;
window.openModal = openModal;
window.closeModals = closeModals;
window.changeTheme = changeTheme;
window.updateProfileUI = updateProfileUI;
window.handleNewContact = function(contact) {
    if (window.loadContacts) window.loadContacts();
    showToast(`${contact.name} added!`, 'success');
};

/* ===== NEW FEATURES & FIXES ADDED ===== */

// Feature 19: Ask Media Permissions Once
function requestPermissionsOnce() {
    if(localStorage.getItem('nexus_perms_requested')) return;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
            s.getTracks().forEach(t=>t.stop()); // close immediately
            localStorage.setItem('nexus_perms_requested', 'true');
        }).catch(()=>{});
    }
}

// Bug 2: Blocked Users Management
const menuBlocked = document.getElementById('menu-blocked');
const blockedModal = document.getElementById('blocked-users-modal');

if(menuBlocked) {
    menuBlocked.addEventListener('click', () => {
        closeModals();
        openModal(blockedModal);
        loadBlockedUsers();
    });
}

async function loadBlockedUsers() {
    if(!window.currentUser) return;
    const container = document.getElementById('blocked-users-list');
    try {
        const res = await fetch(`/blocked-users/${window.currentUser.email}`);
        const blocked = await res.json();
        container.innerHTML = '';

        if(blocked.length === 0) {
            container.innerHTML = '<div class="no-results" style="text-align:center; padding: 20px; color: var(--nexus-text-muted);">No blocked users found.</div>';
            return;
        }

        blocked.forEach(u => {
            const el = document.createElement('div');
            el.className = 'blocked-user-item';
            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${u.avatar || DEFAULT_AVATAR}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <span style="font-weight: 500;">${u.name}</span>
                </div>
                <button class="nexus-btn secondary" style="padding:6px 12px; width:auto; font-size: 0.8rem;" onclick="unblockUser('${u.email}')">Unblock</button>
            `;
            container.appendChild(el);
        });
    } catch(e) {
        console.error('Error loading blocked users', e);
    }
}

window.unblockUser = async function(email) {
    if(!window.currentUser) return;
    await fetch('/unblock-user', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({userEmail: window.currentUser.email, unblockEmail: email}) 
    });
    loadBlockedUsers();
    showToast('User unblocked', 'success');
};

// Feature 38: Logout Confirmation
const origLogoutBtn = document.getElementById('logout-btn');
const confirmLogoutModal = document.getElementById('logout-confirm-modal');
const finalLogoutBtn = document.getElementById('confirm-logout-btn');

if(origLogoutBtn && confirmLogoutModal) {
    const newLogoutBtn = origLogoutBtn.cloneNode(true);
    origLogoutBtn.parentNode.replaceChild(newLogoutBtn, origLogoutBtn);
    newLogoutBtn.addEventListener('click', () => {
        closeModals();
        openModal(confirmLogoutModal);
    });
}

if(finalLogoutBtn) {
    finalLogoutBtn.addEventListener('click', () => {
        closeModals();
        if(window.logoutUser) window.logoutUser();
    });
}

// Feature 37: Chat Wallpapers
const menuWallpapers = document.getElementById('menu-wallpapers');
const wallpapersModal = document.getElementById('wallpapers-modal');

if(menuWallpapers) {
    menuWallpapers.addEventListener('click', () => {
        closeModals();
        openModal(wallpapersModal);
    });
}

document.querySelectorAll('.wallpaper-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.wallpaper-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');

        const bg = opt.dataset.bg;
        const chatArea = document.getElementById('chat-area');

        if(bg === 'default') {
            chatArea.style.backgroundImage = '';
            localStorage.removeItem('nexus_wallpaper');
        } else {
            chatArea.style.backgroundImage = bg;
            localStorage.setItem('nexus_wallpaper', bg);
        }
        showToast('Wallpaper updated', 'success');
    });
});

// Restore wallpaper on load
document.addEventListener('DOMContentLoaded', () => {
    const savedBg = localStorage.getItem('nexus_wallpaper');
    if(savedBg) {
        document.getElementById('chat-area').style.backgroundImage = savedBg;
    }
});

// Feature 13: Status / Stories Tab Logic
const chatTabsMain = document.querySelectorAll('.chat-tab');
chatTabsMain.forEach(t => {
    t.addEventListener('click', () => {
        const isStatus = t.dataset.tab === 'status';
        const sl = document.getElementById('status-list');
        if(sl) {
            sl.style.display = isStatus ? 'block' : 'none';
            if(isStatus) {
                // Ensure chat lists hide
                document.getElementById('chat-list').style.display = 'none';
                document.getElementById('groups-list').style.display = 'none';
                document.getElementById('broadcasts-list').style.display = 'none';

                // Set avatar
                if(window.currentUser && window.currentUser.profile) {
                    document.getElementById('my-status-avatar').src = window.currentUser.profile.avatar || DEFAULT_AVATAR;
                }
                fetchStatuses();
            }
        }
    });
});

const addNewStatus = document.getElementById('add-new-status');
const statusModal = document.getElementById('status-upload-modal');
if(addNewStatus) {
    addNewStatus.addEventListener('click', () => {
        openModal(statusModal);
    });
}

// Status modal button wiring
const textStatusBtn = document.getElementById('text-status-btn');
const cameraStatusBtn = document.getElementById('camera-status-btn');
const videoStatusBtn = document.getElementById('video-status-btn');
const statusImageUpload = document.getElementById('status-image-upload');
const statusVideoUpload = document.getElementById('status-video-upload');
const textStatusInput = document.getElementById('text-status-input');
const postTextStatusBtn = document.getElementById('post-text-status-btn');

if (textStatusBtn) {
    textStatusBtn.addEventListener('click', () => {
        if (textStatusInput) {
            const isVisible = textStatusInput.style.display !== 'none';
            textStatusInput.style.display = isVisible ? 'none' : 'block';
        }
    });
}

let pendingStatusFileUrl = null;
let pendingStatusType = null;

function showStatusMediaPreview(url, type) {
    const preview = document.getElementById('media-status-preview');
    const img = document.getElementById('status-media-preview-img');
    const vid = document.getElementById('status-media-preview-vid');
    if (!preview) return;
    preview.style.display = 'block';
    if (type === 'image') {
        if (img) { img.src = url; img.style.display = 'block'; }
        if (vid) vid.style.display = 'none';
    } else {
        if (vid) { vid.src = url; vid.style.display = 'block'; }
        if (img) img.style.display = 'none';
    }
}

if (cameraStatusBtn && statusImageUpload) {
    cameraStatusBtn.addEventListener('click', () => statusImageUpload.click());
    statusImageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !window.currentUser) return;
        const localUrl = URL.createObjectURL(file);
        showStatusMediaPreview(localUrl, 'image');
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('/upload-file', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.status === 'ok') { pendingStatusFileUrl = data.fileUrl; pendingStatusType = 'image'; }
        } catch(e) { showToast('Upload failed', 'error'); }
        statusImageUpload.value = '';
    });
}

if (videoStatusBtn && statusVideoUpload) {
    videoStatusBtn.addEventListener('click', () => statusVideoUpload.click());
    statusVideoUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !window.currentUser) return;
        const localUrl = URL.createObjectURL(file);
        showStatusMediaPreview(localUrl, 'video');
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('/upload-file', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.status === 'ok') { pendingStatusFileUrl = data.fileUrl; pendingStatusType = 'video'; }
        } catch(e) { showToast('Upload failed', 'error'); }
        statusVideoUpload.value = '';
    });
}

const postMediaStatusBtn = document.getElementById('post-media-status-btn');
if (postMediaStatusBtn) {
    postMediaStatusBtn.addEventListener('click', async () => {
        if (!pendingStatusFileUrl || !pendingStatusType) { showToast('Please select a file first', 'error'); return; }
        const caption = document.getElementById('status-caption-input')?.value.trim() || '';
        try {
            const type = pendingStatusType;
            await postStatus({ type, url: pendingStatusFileUrl, caption });
            pendingStatusFileUrl = null; pendingStatusType = null;
            const preview = document.getElementById('media-status-preview');
            if (preview) preview.style.display = 'none';
            closeModals();
            showToast(`${type === 'image' ? 'Photo' : 'Video'} status posted!`, 'success');
        } catch(e) { showToast('Failed to post status', 'error'); }
    });
}

if (postTextStatusBtn) {
    postTextStatusBtn.addEventListener('click', async () => {
        const textContent = document.getElementById('status-text-content')?.value.trim();
        if (!textContent) { showToast('Please enter some text', 'error'); return; }
        try {
            await postStatus({ type: 'text', text: textContent });
            closeModals();
            showToast('Status posted!', 'success');
        } catch(e) { showToast('Failed to post status', 'error'); }
    });
}

async function postStatus(content) {
    if (!window.currentUser) return;
    const body = {
        email: window.currentUser.email,
        type: content.type,
        content: content.text || content.url || content.content,
        caption: content.caption || ''
    };
    await fetch('/create-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    setTimeout(() => fetchStatuses(), 500);
}

async function fetchStatuses() {
    if (!window.currentUser) return;
    const container = document.getElementById('friends-status-list');
    const header = document.getElementById('recent-updates-header');
    if (!container) return;

    try {
        const res = await fetch(`/get-statuses/${window.currentUser.email}`);
        const data = await res.json();
        if (data.status !== 'ok') return;

        const statuses = data.statuses;
        const myStatuses = statuses[window.currentUser.email] || [];
        const entries = Object.entries(statuses).filter(([email]) => email !== window.currentUser.email);

        // Update "My Status" row
        const addStatusRow = document.getElementById('add-new-status');
        if (addStatusRow) {
            const mySubtext = addStatusRow.querySelector('div > div:last-child');
            if (mySubtext) {
                if (myStatuses.length > 0) {
                    const latest = myStatuses[myStatuses.length - 1];
                    const timeStr = new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    mySubtext.textContent = `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''} · ${timeStr}`;
                    // Add ring to avatar
                    const myAvatar = document.getElementById('my-status-avatar');
                    if (myAvatar) myAvatar.style.border = '2.5px solid var(--nexus-accent)';
                } else {
                    mySubtext.textContent = 'Tap to add status update';
                }
            }
            addStatusRow.onclick = () => {
                if (myStatuses.length > 0) {
                    const myName = window.currentUser.profile?.name || window.currentUser.email.split('@')[0];
                    const myAvatar = window.currentUser.profile?.avatar || DEFAULT_AVATAR;
                    openStatusViewer(window.currentUser.email, myStatuses, myName, myAvatar, true);
                }
            };
        }

        if (entries.length === 0) {
            if (header) header.style.display = 'none';
            container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--nexus-text-muted);font-size:0.85rem;">No recent updates from contacts</div>`;
            return;
        }

        if (header) header.style.display = '';
        container.innerHTML = '';

        entries.forEach(([email, statusList]) => {
            const latest = statusList[statusList.length - 1];
            const contacts = window.currentUserContacts || [];
            const contact = contacts.find(c => c.email === email);
            const name = contact?.name || email.split('@')[0];
            const avatar = contact?.avatar || DEFAULT_AVATAR;
            const time = new Date(latest.timestamp);
            const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const count = statusList.length;

            const el = document.createElement('div');
            el.className = 'story-item';
            el.style.cursor = 'pointer';
            el.innerHTML = `
                <div style="position:relative;flex-shrink:0;">
                    <img src="${avatar}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2.5px solid var(--nexus-accent);">
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.92rem;margin-bottom:3px;">${name}</div>
                    <div style="font-size:0.78rem;color:var(--nexus-text-secondary);">${count} update${count > 1 ? 's' : ''} · ${timeStr}</div>
                </div>
            `;
            el.addEventListener('click', () => openStatusViewer(email, statusList, name, avatar));
            container.appendChild(el);
        });
    } catch (e) {
        console.error('Failed to fetch statuses:', e);
    }
}

function openStatusViewer(email, statusList, name, avatar, isOwnStatus) {
    const viewer = document.getElementById('status-viewer-modal');
    if (!viewer) return;

    isOwnStatus = isOwnStatus || (email === window.currentUser?.email);
    let currentIndex = 0;

    function recordView(s) {
        if (!isOwnStatus && window.currentUser && s?.id) {
            fetch('/view-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statusId: s.id, ownerEmail: email, viewerEmail: window.currentUser.email })
            }).catch(() => {});
        }
    }

    function stopCurrentVideo() {
        const vid = viewer.querySelector('video');
        if (vid) {
            vid.pause();
            vid.src = '';
            vid.load();
        }
        hideSpinner();
    }

    function showSpinner() {
        let sp = viewer.querySelector('.sv-loading-spinner');
        if (!sp) {
            sp = document.createElement('div');
            sp.className = 'sv-loading-spinner';
            sp.innerHTML = '<div class="sv-spinner-ring"></div>';
            viewer.appendChild(sp);
        }
        sp.style.display = 'flex';
    }

    function hideSpinner() {
        const sp = viewer.querySelector('.sv-loading-spinner');
        if (sp) sp.style.display = 'none';
    }

    function startProgressVisual(durationSec) {
        const progressBar = viewer.querySelector('.sv-progress-fill');
        if (!progressBar) return;
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
        progressBar.getBoundingClientRect();
        progressBar.style.transition = `width ${durationSec}s linear`;
        progressBar.style.width = '100%';
    }

    function renderStatus(index) {
        const s = statusList[index];
        if (!s) return;

        stopCurrentVideo(); // Always stop any playing video before showing next story

        const contentEl = viewer.querySelector('.sv-content');
        const captionEl = viewer.querySelector('.sv-caption');
        const timeEl = viewer.querySelector('.sv-time');
        const progressBar = viewer.querySelector('.sv-progress-fill');
        const nameEl = viewer.querySelector('.sv-name');
        const avatarEl = viewer.querySelector('.sv-avatar');
        const counterEl = viewer.querySelector('.sv-counter');
        const viewsFooter = viewer.querySelector('.sv-views-footer');
        const deleteBtn = viewer.querySelector('.sv-delete-btn');

        if (nameEl) nameEl.textContent = name || email.split('@')[0];
        if (avatarEl) avatarEl.src = avatar || DEFAULT_AVATAR;
        if (counterEl) counterEl.textContent = `${index + 1} / ${statusList.length}`;
        if (timeEl) timeEl.textContent = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (captionEl) captionEl.textContent = s.caption || '';

        if (progressBar) {
            progressBar.style.transition = 'none';
            progressBar.style.width = '0%';
        }

        if (deleteBtn) {
            deleteBtn.style.display = isOwnStatus ? 'flex' : 'none';
            deleteBtn.onclick = async () => {
                if (!confirm('Delete this status?')) return;
                try {
                    const r = await fetch('/delete-status', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: window.currentUser.email, statusId: s.id })
                    });
                    const d = await r.json();
                    if (d.status === 'ok') {
                        statusList.splice(index, 1);
                        if (statusList.length === 0) { viewer.classList.remove('active'); fetchStatuses(); return; }
                        currentIndex = Math.min(index, statusList.length - 1);
                        renderStatus(currentIndex);
                        fetchStatuses();
                    }
                } catch(e) { showToast('Failed to delete status', 'error'); }
            };
        }

        if (viewsFooter) {
            if (isOwnStatus) {
                const viewCount = s.views ? s.views.length : 0;
                viewsFooter.style.display = 'flex';
                viewsFooter.innerHTML = `<i class="fas fa-eye"></i> ${viewCount} view${viewCount !== 1 ? 's' : ''}`;
            } else {
                viewsFooter.style.display = 'none';
            }
        }

        if (contentEl) {
            if (s.type === 'image') {
                showSpinner();
                contentEl.innerHTML = '';
                const img = new Image();
                img.style.cssText = 'max-width:100%;max-height:100vh;object-fit:contain;';
                img.onload = () => { hideSpinner(); startProgressVisual(8); };
                img.onerror = () => { hideSpinner(); startProgressVisual(8); };
                img.src = s.content;
                contentEl.appendChild(img);
            } else if (s.type === 'video') {
                showSpinner();
                contentEl.innerHTML = `<video src="${s.content}" autoplay playsinline preload="auto" style="max-width:100%;max-height:100vh;object-fit:contain;"></video>`;
                const vid = contentEl.querySelector('video');
                // Start playing as soon as possible - hide spinner when first frame ready
                vid.addEventListener('canplay', () => {
                    hideSpinner();
                    vid.play().catch(() => {});
                }, { once: true });
                vid.addEventListener('loadedmetadata', () => {
                    const dur = isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 15;
                    startProgressVisual(dur);
                }, { once: true });
                // Show spinner while buffering, hide when playing resumes
                vid.addEventListener('waiting', () => { showSpinner(); });
                vid.addEventListener('playing', () => { hideSpinner(); });
                vid.addEventListener('error', () => { hideSpinner(); }, { once: true });
            } else {
                hideSpinner();
                contentEl.innerHTML = `<div class="sv-text-status">${s.content || ''}</div>`;
                startProgressVisual(8);
            }
        }

        recordView(s);
    }

    renderStatus(currentIndex);
    viewer.classList.add('active');

    const prevBtn = viewer.querySelector('.sv-prev');
    const nextBtn = viewer.querySelector('.sv-next');
    const closeBtn = viewer.querySelector('.sv-close');

    if (prevBtn) prevBtn.onclick = () => {
        if (currentIndex > 0) { stopCurrentVideo(); currentIndex--; renderStatus(currentIndex); }
    };
    if (nextBtn) nextBtn.onclick = () => {
        if (currentIndex < statusList.length - 1) { stopCurrentVideo(); currentIndex++; renderStatus(currentIndex); }
        else { stopCurrentVideo(); viewer.classList.remove('active'); }
    };
    if (closeBtn) closeBtn.onclick = () => { stopCurrentVideo(); viewer.classList.remove('active'); };

    viewer.onclick = (e) => {
        if (e.target === viewer) { stopCurrentVideo(); viewer.classList.remove('active'); }
    };
}

window.openStatusViewer = openStatusViewer;
window.fetchStatuses = fetchStatuses;