// =====================================
// NEXUS CHAT - AUTH MODULE v3.0
// Fixed: session persistence, screen switching, no overlap
// =====================================

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const splashScreen = document.getElementById('splash-screen');
const emailInput = document.getElementById('email-input');
const usernameInput = document.getElementById('username-input');
const otpInputs = document.querySelectorAll('.otp-digit');
const otpContainer = document.getElementById('otp-container');
const sendOtpBtn = document.getElementById('send-otp-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const authMessage = document.getElementById('auth-message');
const sendOtpText = document.getElementById('send-otp-text');
const sendOtpSpinner = document.getElementById('send-otp-spinner');
const verifyOtpText = document.getElementById('verify-otp-text');
const verifyOtpSpinner = document.getElementById('verify-otp-spinner');
const agreeContinueBtn = document.getElementById('agree-continue-btn');
const agreeContinueText = document.getElementById('agree-continue-text');
const agreeContinueSpinner = document.getElementById('agree-continue-spinner');
const termsContainer = document.getElementById('terms-container');
const termsCheckbox = document.getElementById('terms-checkbox');
const loadingSteps = document.getElementById('loading-steps');

// State
let currentUser = null;
let otpCode = '';
let otpCountdown = 60;
let countdownInterval = null;
let heartbeatInterval = null;
let chatInitialized = false;

// OTP UI elements
const resendLink = document.createElement('a');
const otpTimer = document.createElement('div');
otpTimer.className = 'otp-timer';
otpTimer.innerHTML = '<span>Resend in </span><span id="countdown">60</span><span>s</span>';
resendLink.className = 'resend-link';
resendLink.textContent = 'Resend OTP';
resendLink.style.display = 'none';
resendLink.href = '#';

// Input focus effects
document.querySelectorAll('.input-group').forEach(group => {
    const input = group.querySelector('input');
    if (!input) return;
    input.addEventListener('focus', () => group.classList.add('focused'));
    input.addEventListener('blur', () => { if (!input.value) group.classList.remove('focused'); });
});

// Event listeners
sendOtpBtn.addEventListener('click', sendOTP);
verifyOtpBtn.addEventListener('click', verifyOTP);
agreeContinueBtn.addEventListener('click', handleAgreeContinue);
resendLink.addEventListener('click', handleResendOTP);
termsCheckbox.addEventListener('change', () => { agreeContinueBtn.disabled = !termsCheckbox.checked; });

// OTP inputs
otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        const value = e.target.value.replace(/\D/g, '');
        e.target.value = value;
        if (value.length === 1 && index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
        }
        otpCode = Array.from(otpInputs).map(i => i.value).join('');
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            otpInputs[index - 1].focus();
            otpInputs[index - 1].value = '';
            otpCode = Array.from(otpInputs).map(i => i.value).join('');
        }
    });
    if (index === 0) {
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
            pasted.split('').forEach((digit, i) => {
                if (otpInputs[i]) otpInputs[i].value = digit;
            });
            otpCode = pasted;
            if (otpInputs[Math.min(pasted.length, 5)]) otpInputs[Math.min(pasted.length, 5)].focus();
        });
    }
});

// ===== INITIALIZATION =====
function init() {
    // Splash screen
    setTimeout(() => {
        if (splashScreen) {
            splashScreen.classList.add('fade-out');
            setTimeout(() => { splashScreen.style.display = 'none'; }, 600);
        }
    }, 2000);

    // Session restore - check localStorage
    const savedUser = localStorage.getItem('nexus_current_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (currentUser && currentUser.email) {
                window.currentUser = currentUser;
                showMainScreen();
                loadUserData();
                return;
            }
        } catch (e) {
            localStorage.removeItem('nexus_current_user');
        }
    }

    // Apply theme
    applyTheme();
}

function applyTheme() {
    const savedTheme = localStorage.getItem('nexus_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-theme');
        if (!savedTheme) localStorage.setItem('nexus_theme', 'dark');
    }
}

// ===== SCREEN MANAGEMENT =====
// KEY FIX: Use position:fixed on main-screen to guarantee it covers auth-screen
function showMainScreen() {
    if (splashScreen) splashScreen.style.display = 'none';

    // Hide auth, show main - ensure no overlap
    authScreen.classList.remove('active');
    authScreen.style.display = 'none';
    mainScreen.classList.add('active');
    mainScreen.style.display = 'flex';

    window.currentUser = currentUser;

    // Init chat only ONCE
    if (!chatInitialized) {
        chatInitialized = true;
        if (window.initChat) window.initChat();
        if (window.initMain) window.initMain();
        if (window.initVoiceModule) window.initVoiceModule();
        if (window.initEmojiPicker) window.initEmojiPicker();
    }

    startHeartbeat();
}

function showAuthScreen() {
    chatInitialized = false;
    mainScreen.classList.remove('active');
    mainScreen.style.display = 'none';
    authScreen.classList.add('active');
    authScreen.style.display = '';
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
}

// ===== AUTH FLOW =====
emailInput.addEventListener('blur', () => {
    const email = emailInput.value.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        termsContainer.style.display = 'block';
        agreeContinueBtn.style.display = 'block';
        sendOtpBtn.style.display = 'none';
    }
});

emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (agreeContinueBtn.style.display !== 'none') handleAgreeContinue();
        else if (sendOtpBtn.style.display !== 'none') sendOTP();
    }
});

function handleAgreeContinue() {
    const email = emailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAuthMessage('Please enter a valid email address', 'error');
        shakeElement(emailInput); return;
    }
    if (!termsCheckbox.checked) {
        showAuthMessage('Please agree to Terms of Service', 'error');
        shakeElement(termsContainer); return;
    }
    agreeContinueBtn.style.display = 'none';
    termsContainer.style.display = 'none';
    sendOtpBtn.style.display = 'block';
    sendOTP();
}

function handleResendOTP(e) { e.preventDefault(); sendOTP(); }

function shakeElement(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
}

function startOTPTimer() {
    otpCountdown = 60;
    if (countdownInterval) clearInterval(countdownInterval);
    const cdEl = document.getElementById('countdown');
    countdownInterval = setInterval(() => {
        otpCountdown--;
        if (cdEl) cdEl.textContent = otpCountdown;
        if (otpCountdown <= 0) {
            clearInterval(countdownInterval);
            otpTimer.style.display = 'none';
            resendLink.style.display = 'block';
        }
    }, 1000);
}

async function sendOTP() {
    const email = emailInput.value.trim();
    if (!email) { showAuthMessage('Enter your email', 'error'); return; }

    try {
        sendOtpText.style.display = 'none';
        sendOtpSpinner.style.display = 'block';
        sendOtpBtn.disabled = true;

        const res = await fetch('/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        sendOtpText.style.display = 'block';
        sendOtpSpinner.style.display = 'none';
        sendOtpBtn.disabled = false;

        if (data.status === 'ok') {
            showAuthMessage('OTP sent to your email ✓', 'success');
            otpContainer.style.display = 'block';
            verifyOtpBtn.style.display = 'block';
            sendOtpBtn.style.display = 'none';
            if (!otpContainer.contains(otpTimer)) otpContainer.appendChild(otpTimer);
            if (!otpContainer.contains(resendLink)) otpContainer.appendChild(resendLink);
            otpTimer.style.display = 'block';
            resendLink.style.display = 'none';
            startOTPTimer();
            otpInputs[0].focus();
            showToast('OTP sent!', 'success');
        } else {
            showAuthMessage(data.msg || 'Failed to send OTP', 'error');
        }
    } catch (err) {
        sendOtpText.style.display = 'block';
        sendOtpSpinner.style.display = 'none';
        sendOtpBtn.disabled = false;
        showAuthMessage('Connection error. Try again.', 'error');
    }
}

async function verifyOTP() {
    const email = emailInput.value.trim();
    const code = Array.from(otpInputs).map(i => i.value).join('');
    const username = usernameInput.value.trim() || undefined;

    if (!email || code.length !== 6) {
        showAuthMessage('Enter your email and complete 6-digit OTP', 'error'); return;
    }

    try {
        verifyOtpText.style.display = 'none';
        verifyOtpSpinner.style.display = 'block';
        verifyOtpBtn.disabled = true;
        loadingSteps.style.display = 'block';
        updateLoadingSteps(0);

        const res = await fetch('/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, username })
        });
        const data = await res.json();

        if (data.status === 'ok') {
            updateLoadingSteps(1);
            setTimeout(() => {
                updateLoadingSteps(2);
                setTimeout(() => {
                    currentUser = data.user;
                    // KEY FIX: Use different localStorage key to avoid conflicts
                    localStorage.setItem('nexus_current_user', JSON.stringify(currentUser));
                    window.currentUser = currentUser;
                    showMainScreen();
                    loadUserData();
                    showToast('Welcome to Nexus! 🎉', 'success');
                    otpInputs.forEach(i => i.value = '');
                    otpCode = '';
                    resetAuthForm();
                }, 800);
            }, 800);
        } else {
            verifyOtpText.style.display = 'block';
            verifyOtpSpinner.style.display = 'none';
            verifyOtpBtn.disabled = false;
            loadingSteps.style.display = 'none';
            showAuthMessage(data.msg || 'Invalid OTP', 'error');
            otpInputs.forEach(i => i.value = '');
            otpCode = '';
            otpInputs[0].focus();
        }
    } catch (err) {
        verifyOtpText.style.display = 'block';
        verifyOtpSpinner.style.display = 'none';
        verifyOtpBtn.disabled = false;
        loadingSteps.style.display = 'none';
        showAuthMessage('Connection error. Try again.', 'error');
    }
}

function updateLoadingSteps(stepIndex) {
    const steps = loadingSteps.querySelectorAll('.loading-step');
    steps.forEach((step, i) => {
        const icon = step.querySelector('i');
        if (i < stepIndex) icon.className = 'fas fa-check-circle step-completed';
        else if (i === stepIndex) icon.className = 'fas fa-spinner fa-spin step-loading';
        else icon.className = 'fas fa-circle step-pending';
    });
}

function resetAuthForm() {
    emailInput.value = '';
    usernameInput.value = '';
    otpInputs.forEach(i => i.value = '');
    otpCode = '';
    otpContainer.style.display = 'none';
    verifyOtpBtn.style.display = 'none';
    sendOtpBtn.style.display = 'block';
    termsContainer.style.display = 'none';
    agreeContinueBtn.style.display = 'none';
    loadingSteps.style.display = 'none';
    termsCheckbox.checked = false;
    agreeContinueBtn.disabled = true;
    if (countdownInterval) clearInterval(countdownInterval);
    document.querySelectorAll('.input-group').forEach(g => g.classList.remove('focused'));
}

// ===== LOAD USER DATA =====
async function loadUserData() {
    if (!currentUser) return;
    try {
        // Set default profile if needed
        if (!currentUser.profile) {
            currentUser.profile = {
                name: currentUser.username || currentUser.email.split('@')[0],
                about: "Hey there! I'm using Nexus Chat",
                avatar: null,
                lastSeen: new Date().toISOString()
            };
            localStorage.setItem('nexus_current_user', JSON.stringify(currentUser));
        }

        // Mark online
        fetch('/online-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, online: true })
        }).catch(() => {});

        // Connect socket
        connectSocket();

        // Load contacts
        const res = await fetch(`/contacts/${currentUser.email}`);
        if (res.ok) {
            const contacts = await res.json();
            if (window.setContacts) window.setContacts(contacts);
        }
    } catch (err) {
        console.error('loadUserData error:', err);
    }
}

// ===== SOCKET CONNECTION =====
function connectSocket() {
    if (window.socket && window.socket.connected) return;

    window.socket = io({ transports: ['websocket', 'polling'] });

    window.socket.on('connect', () => {
        console.log('✅ Socket connected');
        window.socket.emit('user-login', currentUser.email);
    });

    window.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
    });

    window.socket.on('new-message', (msg) => {
        if (window.handleNewMessage) window.handleNewMessage(msg);
    });

    window.socket.on('message-status-updated', (data) => {
        if (window.updateMessageStatus) window.updateMessageStatus(data.messageId, data.status);
    });

    window.socket.on('user-online', (email) => {
        if (window.handleUserStatusUpdate) window.handleUserStatusUpdate({ email, online: true });
    });

    window.socket.on('user-offline', (data) => {
        const email = typeof data === 'string' ? data : data.email;
        const lastSeen = typeof data === 'object' ? data.lastSeen : null;
        if (window.handleUserStatusUpdate) window.handleUserStatusUpdate({ email, online: false, lastSeen: lastSeen || new Date().toISOString() });
    });

    window.socket.on('typing', (data) => {
        if (window.handleTypingIndicator) window.handleTypingIndicator(data);
    });

    window.socket.on('messages-seen', (data) => {
        if (window.handleMessagesSeen) window.handleMessagesSeen(data);
    });

    window.socket.on('user-status-updated', (data) => {
        if (window.handleUserStatusUpdate) window.handleUserStatusUpdate(data);
    });

    window.socket.on('screenshot-taken', (data) => {
        if (window.handleScreenshotReceived) window.handleScreenshotReceived(data);
    });

    // Register additional events from chat.js
    if (window.registerSocketEvents) window.registerSocketEvents(window.socket);
}

// ===== ONLINE STATUS =====
function updateOnlineStatus(isOnline) {
    if (!currentUser) return;
    fetch('/online-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, online: isOnline })
    }).catch(() => {});
}

document.addEventListener('visibilitychange', () => {
    if (!currentUser) return;
    updateOnlineStatus(!document.hidden);
});

window.addEventListener('beforeunload', () => {
    if (!currentUser) return;
    navigator.sendBeacon('/online-status',
        new Blob([JSON.stringify({ email: currentUser.email, online: false })], { type: 'application/json' })
    );
});

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (currentUser && !document.hidden) updateOnlineStatus(true);
    }, 25000);
}

// ===== TOAST =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

// ===== AUTH MESSAGE =====
function showAuthMessage(msg, type) {
    authMessage.textContent = msg;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
    if (type === 'success') setTimeout(() => { authMessage.style.display = 'none'; }, 3000);
}

// ===== LOGOUT (called from main.js) =====
function logoutUser() {
    if (currentUser) updateOnlineStatus(false);
    if (window.socket) { window.socket.disconnect(); window.socket = null; }
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    currentUser = null;
    window.currentUser = null;
    chatInitialized = false;
    localStorage.removeItem('nexus_current_user');
    // Clear chat caches
    Object.keys(localStorage).forEach(k => { if (k.startsWith('nexus_chat_')) localStorage.removeItem(k); });
    showAuthScreen();
    showToast('Logged out successfully', 'info');
}

// ===== EXPORTS =====
window.showToast = showToast;
window.showAuthMessage = showAuthMessage;
window.logoutUser = logoutUser;
window.loadUserData = loadUserData;
window.showMainScreen = showMainScreen;
window.showAuthScreen = showAuthScreen;

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', init);

/* ===== BUG FIXES ADDED BELOW (NO ORIGINAL CODE REMOVED) ===== */
// Bug 10 & 35: Account Security System - Multiple logins detection
document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        if(window.socket && !window.socket.securityListenerAdded) {
            window.socket.securityListenerAdded = true;
            window.socket.on('security-alert', (data) => {
                const banner = document.getElementById('security-alert-banner');
                if(banner) {
                    banner.style.display = 'block';
                    banner.innerHTML = `<i class="fas fa-shield-alt"></i> ${data.msg} (IP: ${data.ip || 'Unknown'}) <a href="#" style="color:white; text-decoration:underline;">Review</a>`;
                    setTimeout(() => { banner.style.display = 'none'; }, 12000);
                }
            });
        }
    }, 2000);
});