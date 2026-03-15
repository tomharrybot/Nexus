// =====================================
// NEXUS CHAT - MAIN MODULE v4.0 FIXED
// All bugs fixed: QR, groups, search, themes, wallpapers, status, permissions
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

// ===== INITIALIZATION =====
function initMain() {
    loadUserSettings();
    setupMainEventListeners();
    updateProfileUI();
    requestPermissionsOnce();
    restoreWallpaper();
}

function setupMainEventListeners() {
    if (userProfileBtn) userProfileBtn.addEventListener('click', () => openModal(profileModal));
    if (newChatBtn) newChatBtn.addEventListener('click', () => openModal(addContactModal));
    if (menuBtn) menuBtn.addEventListener('click', () => openModal(menuModal));

    // QR Button
    if (qrBtn) qrBtn.addEventListener('click', () => { openModal(qrModal); setTimeout(generateQRCode, 200); });

    // Close modal buttons
    document.querySelectorAll('.close, [data-close-modal]').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    // Avatar upload
    if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', () => avatarUpload?.click());
    if (avatarUpload) avatarUpload.addEventListener('change', handleAvatarUpload);

    // Save profile
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

    // Add contact — FIX: search on input with debounce
    if (contactEmailInput) contactEmailInput.addEventListener('input', debounce(searchUsers, 300));
    if (addContactBtn) addContactBtn.addEventListener('click', addContact);

    // Menu items
    if (menuProfile) menuProfile.addEventListener('click', () => { closeModals(); openModal(profileModal); });
    if (menuCreateGroup) menuCreateGroup.addEventListener('click', () => { closeModals(); openModal(createGroupModal); loadContactsForGroup(); });
    if (menuCreateBroadcast) menuCreateBroadcast.addEventListener('click', () => { closeModals(); openModal(createBroadcastModal); loadContactsForBroadcast(); });
    if (menuNotifications) menuNotifications.addEventListener('click', () => { closeModals(); openModal(notificationsModal); });
    if (menuThemes) menuThemes.addEventListener('click', () => { closeModals(); openModal(themeModal); });
    if (menuSettings) menuSettings.addEventListener('click', () => { closeModals(); openModal(settingsModal); });

    // Theme options
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

    // Click outside modals to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeModals();
    });

    // Window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const sb = document.getElementById('sidebar');
            if (sb) sb.classList.remove('hidden');
        }
    });

    // Logout button
    const logoutBtnEl = document.getElementById('logout-btn');
    if (logoutBtnEl) {
        logoutBtnEl.addEventListener('click', () => {
            const confirmModal = document.getElementById('logout-confirm-modal');
            if (confirmModal) { closeModals(); openModal(confirmModal); }
            else if (confirm('Logout?')) { if (window.logoutUser) window.logoutUser(); }
        });
    }

    // Confirm logout
    const finalLogoutBtn = document.getElementById('confirm-logout-btn');
    if (finalLogoutBtn) {
        finalLogoutBtn.addEventListener('click', () => {
            closeModals();
            if (window.logoutUser) window.logoutUser();
        });
    }

    // Blocked users menu
    const menuBlocked = document.getElementById('menu-blocked');
    const blockedModal = document.getElementById('blocked-users-modal');
    if (menuBlocked) {
        menuBlocked.addEventListener('click', () => { closeModals(); openModal(blockedModal); loadBlockedUsers(); });
    }

    // Wallpapers
    const menuWallpapers = document.getElementById('menu-wallpapers');
    const wallpapersModal = document.getElementById('wallpapers-modal');
    if (menuWallpapers) {
        menuWallpapers.addEventListener('click', () => { closeModals(); openModal(wallpapersModal); });
    }
    document.querySelectorAll('.wallpaper-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.wallpaper-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const bg = opt.dataset.bg;
            const chatArea = document.getElementById('chat-area');
            if (!chatArea) return;
            if (bg === 'default' || !bg) {
                chatArea.style.backgroundImage = '';
                localStorage.removeItem('nexus_wallpaper');
            } else {
                chatArea.style.backgroundImage = bg;
                localStorage.setItem('nexus_wallpaper', bg);
            }
            showToast('Wallpaper updated', 'success');
        });
    });

    // Status/Stories tab
    const chatTabsMain = document.querySelectorAll('.chat-tab');
    chatTabsMain.forEach(t => {
        t.addEventListener('click', () => {
            const tab = t.dataset.tab;
            const statusList = document.getElementById('status-list');
            if (statusList) {
                statusList.style.display = tab === 'status' ? 'block' : 'none';
                if (tab === 'status' && window.currentUser?.profile) {
                    const myStatusAvatar = document.getElementById('my-status-avatar');
                    if (myStatusAvatar) myStatusAvatar.src = window.currentUser.profile.avatar || DEFAULT_AVATAR;
                    loadStatuses();
                }
            }
        });
    });

    // Add new status
    const addNewStatus = document.getElementById('add-new-status');
    const statusModal = document.getElementById('status-upload-modal');
    if (addNewStatus && statusModal) {
        addNewStatus.addEventListener('click', () => openModal(statusModal));
    }

    // Status upload form
    const statusTextInput = document.getElementById('status-text-input');
    const statusImageInput = document.getElementById('status-image-input');
    const uploadStatusBtn = document.getElementById('upload-status-btn');
    if (uploadStatusBtn) {
        uploadStatusBtn.addEventListener('click', () => uploadStatus(statusTextInput, statusImageInput));
    }

    // Help and Support
    const menuHelp = document.getElementById('menu-help');
    if (menuHelp) {
        menuHelp.addEventListener('click', () => {
            closeModals();
            const helpModal = document.getElementById('help-modal');
            if (helpModal) openModal(helpModal);
            else showToast('Help: Contact support@nexuschat.app', 'info');
        });
    }
}

// ===== MODAL FUNCTIONS =====
function openModal(modal) {
    if (!modal) return;
    closeModals();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (modal === profileModal) loadProfileData();
    if (modal === qrModal) setTimeout(generateQRCode, 150);
    if (modal === createGroupModal) loadContactsForGroup();
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

function updateProfileUI() {
    const user = window.currentUser;
    if (!user) return;
    if (userAvatar) userAvatar.src = user.profile?.avatar || DEFAULT_AVATAR;
    if (userStatus) userStatus.className = 'status-indicator online';
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
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
            if (userAvatar) userAvatar.src = data.avatarUrl;
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
        const res = await fetch('/update-profile', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, name: profileName?.value, about: profileAbout?.value, avatar: profileAvatarPreview?.src })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (!user.profile) user.profile = {};
            user.profile.name = profileName?.value;
            user.profile.about = profileAbout?.value;
            window.currentUser = user;
            localStorage.setItem('nexus_current_user', JSON.stringify(user));
            updateProfileUI();
            closeModals();
            showToast('Profile saved!', 'success');
        } else showToast(data.msg || 'Error saving profile', 'error');
    } catch(e) { showToast('Error saving profile', 'error'); }
    finally {
        if (saveProfileBtn) saveProfileBtn.disabled = false;
        if (saveText) saveText.style.display = '';
        if (saveSpinner) saveSpinner.style.display = 'none';
    }
}

// ===== ADD CONTACT WITH IMPROVED SEARCH =====
let searchDebounceTimer = null;

async function searchUsers() {
    const user = window.currentUser;
    const query = contactEmailInput?.value.trim();

    if (!contactSearchResults) return;
    if (!query || query.length < 2) { contactSearchResults.innerHTML = ''; return; }

    // Show loading
    contactSearchResults.innerHTML = `<div style="text-align:center;padding:12px;color:var(--nexus-text-muted);font-size:0.85rem;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>`;

    try {
        const res = await fetch('/users');
        const users = await res.json();
        const filtered = users.filter(u =>
            u.email !== user?.email &&
            (u.email.toLowerCase().includes(query.toLowerCase()) ||
             (u.profile?.name || u.username || '').toLowerCase().includes(query.toLowerCase()))
        );

        if (filtered.length === 0) {
            contactSearchResults.innerHTML = `<div style="text-align:center;padding:14px;color:var(--nexus-text-muted);font-size:0.85rem;">No users found for "${query}"</div>`;
            return;
        }

        contactSearchResults.innerHTML = '';
        filtered.forEach(u => {
            const el = document.createElement('div');
            el.className = 'contact-result-item';
            // FIX: Proper CSS for search result items
            el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;border:1px solid var(--nexus-border);margin-bottom:8px;background:var(--nexus-bg-card);transition:background 0.2s;';
            el.innerHTML = `
                <div style="position:relative;flex-shrink:0;">
                    <img src="${u.profile?.avatar || DEFAULT_AVATAR}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--nexus-border-active);" onerror="this.src='${DEFAULT_AVATAR}'">
                    <span style="position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:${u.online ? 'var(--nexus-teal)' : 'var(--nexus-offline)'};border:2px solid var(--nexus-bg-secondary);"></span>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.profile?.name || u.username || u.email.split('@')[0]}</div>
                    <div style="font-size:0.78rem;color:var(--nexus-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.email}</div>
                </div>
                <div style="font-size:0.7rem;color:${u.online ? 'var(--nexus-teal)' : 'var(--nexus-text-muted)'};">${u.online ? 'Online' : 'Offline'}</div>`;
            el.addEventListener('mouseenter', () => el.style.background = 'rgba(139,92,246,0.1)');
            el.addEventListener('mouseleave', () => el.style.background = 'var(--nexus-bg-card)');
            el.addEventListener('click', () => {
                if (contactEmailInput) contactEmailInput.value = u.email;
                contactSearchResults.innerHTML = '';
                // Show confirmation
                contactSearchResults.innerHTML = `
                    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);">
                        <img src="${u.profile?.avatar || DEFAULT_AVATAR}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                        <div>
                            <div style="font-weight:600;font-size:0.88rem;">${u.profile?.name || u.username || u.email.split('@')[0]}</div>
                            <div style="font-size:0.75rem;color:var(--nexus-teal);">✓ Selected</div>
                        </div>
                    </div>`;
            });
            contactSearchResults.appendChild(el);
        });
    } catch(e) {
        contactSearchResults.innerHTML = `<div style="text-align:center;padding:12px;color:var(--nexus-busy);font-size:0.85rem;">Search failed. Please try again.</div>`;
    }
}

function debounce(fn, delay) {
    return function(...args) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function addContact() {
    const user = window.currentUser;
    const contactEmail = contactEmailInput?.value.trim();
    if (!contactEmail || !user) { showToast('Please enter or select an email', 'error'); return; }

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
    membersList.innerHTML = `<div style="text-align:center;padding:16px;color:var(--nexus-text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading contacts...</div>`;
    try {
        const res = await fetch(`/contacts/${user.email}`);
        if (res.ok) {
            const contacts = await res.json();
            renderMembersList(contacts, 'group');
        } else {
            membersList.innerHTML = `<div style="text-align:center;padding:16px;color:var(--nexus-text-muted);">No contacts found. Add contacts first.</div>`;
        }
    } catch(e) {
        membersList.innerHTML = `<div style="text-align:center;padding:16px;color:var(--nexus-busy);">Failed to load contacts.</div>`;
    }
}

async function loadContactsForBroadcast() {
    const user = window.currentUser;
    if (!user || !broadcastMembersList) return;
    broadcastMembersList.innerHTML = `<div style="text-align:center;padding:16px;color:var(--nexus-text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
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
    if (!contacts?.length) {
        container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--nexus-text-muted);font-size:0.88rem;">No contacts found. Add contacts first to create a group.</div>`;
        return;
    }
    contacts.forEach(c => {
        const el = document.createElement('div');
        el.className = 'member-item';
        el.dataset.email = c.email;
        el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background 0.15s;';
        el.innerHTML = `
            <img src="${c.avatar || DEFAULT_AVATAR}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src='${DEFAULT_AVATAR}'">
            <div style="flex:1;min-width:0;">
                <div class="member-name" style="font-weight:600;font-size:0.9rem;">${c.name || c.email.split('@')[0]}</div>
                <div style="font-size:0.75rem;color:var(--nexus-text-muted);">${c.email}</div>
            </div>
            <label style="display:flex;align-items:center;">
                <input type="checkbox" class="member-checkbox" style="width:18px;height:18px;accent-color:var(--nexus-accent);cursor:pointer;">
            </label>`;
        const checkbox = el.querySelector('.member-checkbox');
        el.addEventListener('click', (e) => {
            if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
            if (checkbox.checked) addSelectedMember(c, type);
            else removeSelectedMember(c.email, type);
            el.style.background = checkbox.checked ? 'rgba(139,92,246,0.1)' : '';
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
    el.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:4px 10px 4px 6px;margin:4px;font-size:0.82rem;';
    el.innerHTML = `<img src="${contact.avatar || DEFAULT_AVATAR}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;"><span>${contact.name || contact.email.split('@')[0]}</span><button style="background:none;border:none;cursor:pointer;color:var(--nexus-text-muted);padding:0;font-size:0.8rem;" onclick="window.removeSelectedMember('${contact.email}','${type}')"><i class="fas fa-times"></i></button>`;
    container.appendChild(el);
    type === 'group' ? updateCreateGroupButton() : updateCreateBroadcastButton();
}

window.removeSelectedMember = function(email, type) {
    const container = type === 'group' ? selectedMembersEl : broadcastSelectedMembers;
    const set = type === 'group' ? selectedGroupMembers : selectedBroadcastMembers;
    const listContainer = type === 'group' ? membersList : broadcastMembersList;
    set.delete(email);
    container?.querySelector(`[data-email="${email}"]`)?.remove();
    const item = listContainer?.querySelector(`[data-email="${email}"]`);
    if (item) {
        const cb = item.querySelector('.member-checkbox');
        if (cb) cb.checked = false;
        item.style.background = '';
    }
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
    if (!name) { showToast('Enter a group name', 'error'); return; }
    if (members.length === 0) { showToast('Select at least one member', 'error'); return; }
    if (!user) return;
    if (createGroupBtn) createGroupBtn.disabled = true;
    try {
        const res = await fetch('/create-group', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorEmail: user.email, groupName: name, members })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            closeModals();
            selectedGroupMembers.clear();
            if (selectedMembersEl) selectedMembersEl.innerHTML = '';
            if (groupNameInput) groupNameInput.value = '';
            if (window.loadGroups) window.loadGroups();
            document.querySelector('[data-tab="groups"]')?.click();
            showToast('Group created! 🎉', 'success');
        } else showToast(data.msg || 'Error creating group', 'error');
    } catch(e) { showToast('Error creating group', 'error'); }
    finally { if (createGroupBtn) createGroupBtn.disabled = false; }
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

function handleGroupAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const prev = document.getElementById('group-avatar-preview');
        if (prev) prev.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

// ===== THEME (5 themes) =====
const THEMES = ['dark', 'light', 'purple', 'ocean', 'midnight'];

function changeTheme(theme) {
    document.body.classList.remove(...THEMES.map(t => t + '-theme'));
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.add(isDark ? 'dark-theme' : 'light-theme');
    } else {
        document.body.classList.add(theme + '-theme');
    }
    localStorage.setItem('nexus_theme', theme);
    themeOptions.forEach(o => o.classList.toggle('active', o.dataset.theme === theme));
    showToast(`Theme: ${theme}`, 'success');
}

// ===== NOTIFICATIONS =====
function updateNotificationSettings() {
    const settings = { notifications: notificationsToggle?.checked ?? true, sound: soundToggle?.checked ?? true };
    localStorage.setItem('nexus_notif', JSON.stringify(settings));
    window.messageSoundEnabled = settings.sound;
    showToast('Settings saved', 'success');
}

// ===== SETTINGS =====
function loadUserSettings() {
    const savedTheme = localStorage.getItem('nexus_theme') || 'dark';
    changeTheme(savedTheme);
    const notifSettings = localStorage.getItem('nexus_notif');
    if (notifSettings) {
        try {
            const s = JSON.parse(notifSettings);
            if (notificationsToggle) notificationsToggle.checked = s.notifications ?? true;
            if (soundToggle) soundToggle.checked = s.sound ?? true;
            window.messageSoundEnabled = s.sound ?? true;
        } catch(e) {}
    }
}

// ===== WALLPAPER RESTORE =====
function restoreWallpaper() {
    const savedBg = localStorage.getItem('nexus_wallpaper');
    if (savedBg) {
        const chatArea = document.getElementById('chat-area');
        if (chatArea) chatArea.style.backgroundImage = savedBg;
    }
}

// ===== QR CODE — FIXED =====
function generateQRCode() {
    const user = window.currentUser;
    if (!qrCode || !user) return;
    qrCode.innerHTML = '';

    const qrData = JSON.stringify({
        app: 'NexusChat',
        email: user.email,
        name: user.profile?.name || user.username || user.email.split('@')[0]
    });

    if (window.QRCode) {
        try {
            new QRCode(qrCode, {
                text: qrData,
                width: 200, height: 200,
                colorDark: '#7C3AED', colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel?.H || 1
            });
        } catch(e) {
            qrCode.innerHTML = `<div style="text-align:center;padding:20px;color:var(--nexus-text-muted);">QR generation failed</div>`;
        }
    } else {
        // Fallback: load QRCode.js dynamically
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.onload = () => {
            new QRCode(qrCode, { text: qrData, width: 200, height: 200, colorDark: '#7C3AED', colorLight: '#ffffff' });
        };
        script.onerror = () => {
            qrCode.innerHTML = `<div style="text-align:center;padding:20px;">
                <i class="fas fa-qrcode" style="font-size:4rem;color:var(--nexus-accent);opacity:0.4;"></i>
                <p style="margin-top:12px;font-size:0.85rem;color:var(--nexus-text-muted);">Your QR code ID:<br><strong style="color:var(--nexus-accent);">${user.email}</strong></p>
            </div>`;
        };
        document.head.appendChild(script);
    }
}

function downloadQRCode() {
    const canvas = qrCode?.querySelector('canvas');
    if (!canvas) { showToast('QR code not ready', 'error'); return; }
    const a = document.createElement('a');
    a.download = `nexus-qr-${window.currentUser?.email || 'code'}.png`;
    a.href = canvas.toDataURL();
    a.click();
}

// ===== STATUS / STORIES =====
async function loadStatuses() {
    if (!window.currentUser) return;
    const statusList = document.getElementById('status-list');
    if (!statusList) return;
    try {
        const res = await fetch(`/get-statuses/${window.currentUser.email}`);
        if (!res.ok) return;
        const statuses = await res.json();
        const container = statusList.querySelector('.contacts-statuses') || statusList;
        const existingItems = container.querySelectorAll('.status-contact-item');
        existingItems.forEach(el => el.remove());
        statuses.forEach(s => {
            const el = document.createElement('div');
            el.className = 'status-contact-item chat-item';
            el.style.cssText = 'cursor:pointer;';
            el.innerHTML = `
                <div class="chat-avatar-wrap">
                    <img src="${s.avatar || DEFAULT_AVATAR}" class="chat-avatar" style="border:3px solid var(--nexus-accent);" onerror="this.src='${DEFAULT_AVATAR}'">
                </div>
                <div class="chat-info">
                    <div class="chat-name-row"><span class="chat-name">${s.name}</span><span class="chat-time">${formatStatusTime(s.timestamp)}</span></div>
                    <div class="chat-preview-row"><span class="chat-last-msg">${s.type === 'image' ? '📷 Photo' : s.text || 'Status update'}</span></div>
                </div>`;
            el.addEventListener('click', () => viewStatus(s));
            container.appendChild(el);
        });
    } catch(e) {}
}

function formatStatusTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', hour12: true });
}

function viewStatus(status) {
    showToast(`${status.name}'s status`, 'info');
}

async function uploadStatus(textInput, imageInput) {
    if (!window.currentUser) return;
    const text = textInput?.value.trim();
    const file = imageInput?.files[0];
    if (!text && !file) { showToast('Add text or image for status', 'error'); return; }
    try {
        let statusData = { userEmail: window.currentUser.email, text, type: 'text' };
        if (file) {
            const fd = new FormData();
            fd.append('file', file);
            const uploadRes = await fetch('/upload-file', { method: 'POST', body: fd });
            const uploadData = await uploadRes.json();
            if (uploadData.status === 'ok') { statusData.imageUrl = uploadData.fileUrl; statusData.type = 'image'; }
        }
        const res = await fetch('/upload-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(statusData) });
        const data = await res.json();
        if (data.status === 'ok') {
            closeModals();
            showToast('Status updated! ✓', 'success');
            loadStatuses();
        } else showToast('Failed to update status', 'error');
    } catch(e) { showToast('Error uploading status', 'error'); }
}

// ===== BLOCKED USERS =====
async function loadBlockedUsers() {
    if (!window.currentUser) return;
    const container = document.getElementById('blocked-users-list');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--nexus-text-muted);"><i class="fas fa-spinner fa-spin"></i></div>`;
    try {
        const res = await fetch(`/blocked-users/${window.currentUser.email}`);
        const blocked = await res.json();
        container.innerHTML = '';
        if (!blocked.length) {
            container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--nexus-text-muted);">No blocked users found.</div>`;
            return;
        }
        blocked.forEach(u => {
            const el = document.createElement('div');
            el.className = 'blocked-user-item';
            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${u.avatar || DEFAULT_AVATAR}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div>
                        <div style="font-weight:500;font-size:0.9rem;">${u.name || u.email.split('@')[0]}</div>
                        <div style="font-size:0.75rem;color:var(--nexus-text-muted);">${u.email}</div>
                    </div>
                </div>
                <button class="nexus-btn secondary" style="padding:6px 14px;width:auto;font-size:0.8rem;" onclick="window.unblockUser('${u.email}')">Unblock</button>`;
            container.appendChild(el);
        });
    } catch(e) {
        container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--nexus-busy);">Failed to load blocked users.</div>`;
    }
}

window.unblockUser = async function(email) {
    if (!window.currentUser) return;
    try {
        await fetch('/unblock-user', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: window.currentUser.email, unblockEmail: email })
        });
        loadBlockedUsers();
        showToast('User unblocked', 'success');
    } catch(e) { showToast('Failed to unblock user', 'error'); }
};

// ===== PERMISSIONS (ask only once) =====
function requestPermissionsOnce() {
    if (localStorage.getItem('nexus_perms_requested')) return;
    if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(s => { s.getTracks().forEach(t => t.stop()); localStorage.setItem('nexus_perms_requested', 'true'); })
            .catch(() => {});
    }
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(() => {});
    }
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
    if (window.showToast && window.showToast !== showToast) { window.showToast(msg, type); return; }
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
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
window.generateQRCode = generateQRCode;
window.loadStatuses = loadStatuses;
window.handleNewContact = function(contact) {
    if (window.loadContacts) window.loadContacts();
    showToast(`${contact.name || 'Contact'} added!`, 'success');
};