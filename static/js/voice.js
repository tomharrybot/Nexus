// =====================================
// NEXUS CHAT - VOICE MODULE v3.0
// Fixed: no DOMContentLoaded auto-init, called once by auth.js after login
// =====================================

let voiceRecorder = null;
let isRecording = false;
let voiceStream = null;
let voiceTimer = null;
let voiceSeconds = 0;
let voiceInitialized = false;
let micPermission = false;
let pendingVoiceTempId = null; // Tracks the temp bubble shown immediately on send

function initVoiceModule() {
    if (voiceInitialized) return; // KEY FIX: Never double-init
    voiceInitialized = true;

    const voiceBtn = document.getElementById('voice-record-btn');
    const voiceRecording = document.getElementById('voice-recording');
    const cancelVoice = document.getElementById('cancel-voice');
    const sendVoice = document.getElementById('send-voice');
    const voiceTimerEl = document.getElementById('voice-timer');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');

    if (!voiceBtn) return;

    // Check mic permission only if not previously granted
    const micGranted = localStorage.getItem('nexus_mic_permission');
    if (micGranted === 'granted') {
        micPermission = true;
        voiceBtn.title = 'Tap to record voice message';
    } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                micPermission = true;
                localStorage.setItem('nexus_mic_permission', 'granted');
                stream.getTracks().forEach(t => t.stop());
                voiceBtn.title = 'Tap to record voice message';
            })
            .catch(() => {
                micPermission = false;
                voiceBtn.title = 'Microphone access blocked';
                voiceBtn.style.opacity = '0.5';
            });
    }

    // Click to start/stop recording
    voiceBtn.addEventListener('click', async () => {
        if (!micPermission) {
            showVoiceToast('Microphone permission denied');
            return;
        }
        if (isRecording) {
            createVoiceSendingBubble(); // Show immediately on send click
            stopVoiceRecording(true);
        } else {
            await startVoiceRecording();
        }
    });

    if (cancelVoice) {
        cancelVoice.addEventListener('click', () => stopVoiceRecording(false));
    }

    if (sendVoice) {
        sendVoice.addEventListener('click', () => {
            createVoiceSendingBubble(); // Show immediately on send click
            stopVoiceRecording(true);
        });
    }
}

// Create a temp bubble immediately when user clicks send - before upload starts
function createVoiceSendingBubble() {
    const m = Math.floor(voiceSeconds / 60);
    const s = (voiceSeconds % 60).toString().padStart(2, '0');
    const duration = `${m}:${s}`;
    pendingVoiceTempId = 'voice-sending-' + Date.now();
    const messagesDiv = document.getElementById('messages-container');
    if (messagesDiv) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper message-outgoing';
        wrapper.id = 'wrapper-' + pendingVoiceTempId;
        wrapper.innerHTML = `<div class="message-bubble">
            <div class="voice-player">
                <button class="play-btn loading" aria-label="Sending" disabled><i class="fas fa-spinner fa-spin"></i></button>
                <div class="voice-waveform-wrap">
                    <div class="voice-waveform" style="flex:1;height:36px;background:rgba(255,255,255,0.15);border-radius:4px;"></div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
            <div class="msg-meta">
                <span class="msg-time" style="font-size:11px;opacity:0.7;">Sending...</span>
                <i class="fas fa-clock" style="font-size:10px;opacity:0.6;margin-left:4px;"></i>
            </div>
        </div>`;
        messagesDiv.appendChild(wrapper);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

async function startVoiceRecording() {
    const voiceBtn = document.getElementById('voice-record-btn');
    const voiceRecording = document.getElementById('voice-recording');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');

    try {
        voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? { mimeType: 'audio/webm;codecs=opus' }
            : MediaRecorder.isTypeSupported('audio/webm')
                ? { mimeType: 'audio/webm' }
                : {};

        voiceRecorder = new MediaRecorder(voiceStream, options);
        const chunks = [];
        // Capture mimeType NOW — voiceRecorder will be null by the time onstop fires
        const capturedMime = options.mimeType || 'audio/webm';

        voiceRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        voiceRecorder.onstop = async () => {
            if (chunks.length === 0) return;
            const blob = new Blob(chunks, { type: capturedMime });
            await window.sendVoiceMessage(blob, voiceSeconds);
        };

        voiceRecorder.start(100);
        isRecording = true;

        // UI: hide input, show recording
        if (messageInput) messageInput.style.display = 'none';
        if (sendBtn) sendBtn.style.display = 'none';
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="fas fa-stop-circle"></i>';
            voiceBtn.classList.add('recording-active');
        }
        if (voiceRecording) voiceRecording.style.display = 'flex';

        // Timer
        voiceSeconds = 0;
        updateVoiceTimer();
        voiceTimer = setInterval(() => {
            voiceSeconds++;
            updateVoiceTimer();
            if (voiceSeconds >= 300) stopVoiceRecording(true); // max 5 min
        }, 1000);

        // Animate waveform
        animateVoiceWave();

    } catch(e) {
        isRecording = false;
        showVoiceToast('Could not access microphone');
        console.error('Voice recording error:', e);
    }
}

function stopVoiceRecording(send) {
    if (!isRecording) return;
    isRecording = false;

    clearInterval(voiceTimer);
    voiceTimer = null;

    const voiceBtn = document.getElementById('voice-record-btn');
    const voiceRecording = document.getElementById('voice-recording');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');

    // Restore UI
    if (messageInput) messageInput.style.display = '';
    if (voiceBtn) {
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.classList.remove('recording-active');
    }
    if (voiceRecording) voiceRecording.style.display = 'none';
    // Restore proper send/mic toggle state
    if (window.toggleSendButton) window.toggleSendButton();
    else if (sendBtn) sendBtn.style.display = 'none';

    if (voiceStream) {
        voiceStream.getTracks().forEach(t => t.stop());
        voiceStream = null;
    }

    if (voiceRecorder && voiceRecorder.state !== 'inactive') {
        if (send) {
            voiceRecorder.stop();
        } else {
            voiceRecorder.ondataavailable = null;
            voiceRecorder.onstop = null;
            voiceRecorder.stop();
        }
    }
    voiceRecorder = null;
}

function updateVoiceTimer() {
    const el = document.getElementById('voice-timer');
    if (el) {
        const m = Math.floor(voiceSeconds / 60);
        const s = (voiceSeconds % 60).toString().padStart(2, '0');
        el.textContent = `${m}:${s}`;
    }
}

function animateVoiceWave() {
    const wave = document.getElementById('voice-wave');
    if (!wave) return;
    wave.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.animationDelay = `${i * 0.05}s`;
        wave.appendChild(bar);
    }
}

async function sendVoiceMessage(blob, durationSeconds) {
    if (!window.currentUser || !window.currentChat) return;

    const m = Math.floor(durationSeconds / 60);
    const s = (durationSeconds % 60).toString().padStart(2, '0');
    const duration = `${m}:${s}`;

    showVoiceToast('Sending voice message...');

    try {
        const formData = new FormData();
        const ext = blob.type.includes('ogg') ? '.ogg' : '.webm';
        formData.append('file', blob, `voice${ext}`);

        const uploadRes = await fetch('/upload-file', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (uploadData.status === 'ok') {
            // Send via chat module
            const res = await fetch('/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: window.currentUser.email,
                    to: window.currentChat.email,
                    message: uploadData.fileUrl,
                    type: 'voice',
                    duration
                })
            });
            const data = await res.json();
            if (data.status === 'ok') {
                // Add to chat data and render
                const chatEmail = window.currentChat.email;
                if (!window.chats) window.chats = {};
                if (!window.chats[chatEmail]) window.chats[chatEmail] = { messages: [] };

                if (window.addMessageToUI) {
                    window.addMessageToUI(data.message, true);
                } else if (window.handleNewMessage) {
                    window.handleNewMessage(data.message);
                }

                // Play sent sound
                const s = document.getElementById('message-sent-sound');
                if (s) { s.currentTime = 0; s.play().catch(() => {}); }
            }
        } else {
            showVoiceToast('Failed to send voice message');
        }
    } catch(e) {
        showVoiceToast('Error sending voice message');
        console.error('Voice send error:', e);
    }
}

function showVoiceToast(msg) {
    if (window.showToast) window.showToast(msg, 'info');
}

// Called by auth.js after login - NOT on DOMContentLoaded
window.initVoiceModule = initVoiceModule;
window.startVoiceRecording = startVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;

/* ===== BUG FIXES ADDED BELOW (NO ORIGINAL CODE REMOVED) ===== */
// Bug 4 & 25: Voice Recording bug fix and Offline behavior support
window.sendVoiceMessage = async function(blob, durationSeconds) {
    if (!navigator.onLine) {
        showVoiceToast('You are offline. Voice message cannot be sent right now.');
        return;
    }
    if (!window.currentUser || !window.currentChat) return;

    const m = Math.floor(durationSeconds / 60);
    const s = (durationSeconds % 60).toString().padStart(2, '0');
    const duration = `${m}:${s}`;

    // Use the temp bubble already created by createVoiceSendingBubble(),
    // or fall back to creating one now if somehow not yet created
    const tempId = pendingVoiceTempId || (() => {
        createVoiceSendingBubble();
        return pendingVoiceTempId;
    })();
    pendingVoiceTempId = null; // Clear so it's only used once

    try {
        const formData = new FormData();
        const ext = blob.type.includes('ogg') ? '.ogg' : '.webm';
        formData.append('audio', blob, `voice_${Date.now()}${ext}`);
        formData.append('duration', duration);

        const uploadRes = await fetch('/upload-voice', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (uploadData.status === 'ok') {
            const chat = window.currentChat;
            let res, endpoint, body;
            if (chat.isGroup) {
                endpoint = '/send-group-message';
                body = { groupId: chat.email, from: window.currentUser.email, message: uploadData.fileUrl, type: 'voice', duration };
            } else if (chat.isBroadcast) {
                endpoint = '/send-broadcast';
                body = { broadcastId: chat.email, from: window.currentUser.email, message: uploadData.fileUrl, type: 'voice', duration };
            } else {
                endpoint = '/send-message';
                body = { from: window.currentUser.email, to: chat.email, message: uploadData.fileUrl, type: 'voice', duration, fileSize: uploadData.fileSize };
            }
            res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.status === 'ok') {
                const chatEmail = chat.email;
                if (chat.isGroup) {
                    if (!window.groupChats) window.groupChats = {};
                    if (!window.groupChats[chatEmail]) window.groupChats[chatEmail] = [];
                    window.groupChats[chatEmail].push(data.message);
                } else if (chat.isBroadcast) {
                    if (!window.broadcastChats) window.broadcastChats = {};
                    if (!window.broadcastChats[chatEmail]) window.broadcastChats[chatEmail] = [];
                    window.broadcastChats[chatEmail].push(data.message);
                } else if (window.chats) {
                    if (!window.chats[chatEmail]) window.chats[chatEmail] = { messages: [] };
                    window.chats[chatEmail].messages.push(data.message);
                }

                // Remove temp sending bubble
                const tempEl = document.getElementById('wrapper-' + tempId);
                if (tempEl) tempEl.remove();

                if (window.addMessageToUI) {
                    window.addMessageToUI(data.message, true);
                } else if (window.handleNewMessage) {
                    window.handleNewMessage(data.message);
                }

                showVoiceToast('Voice message sent!');
                const s = document.getElementById('message-sent-sound');
                if (s) { s.currentTime = 0; s.play().catch(() => {}); }
            } else {
                // Remove temp bubble on failure
                const tempEl = document.getElementById('wrapper-' + tempId);
                if (tempEl) tempEl.remove();
                showVoiceToast(data.msg || 'Failed to send voice message');
            }
        } else {
            const tempEl = document.getElementById('wrapper-' + tempId);
            if (tempEl) tempEl.remove();
            showVoiceToast(uploadData.msg || 'Failed to upload voice message');
        }
    } catch(e) {
        const tempEl = document.getElementById('wrapper-' + tempId);
        if (tempEl) tempEl.remove();
        showVoiceToast('Error sending voice message');
        console.error('Voice send error:', e);
    }
};