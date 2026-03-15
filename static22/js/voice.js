// =====================================
// NEXUS CHAT - VOICE MODULE v3.0 - FIXED
// =====================================

let voiceRecorder = null;
let isRecording = false;
let voiceStream = null;
let voiceTimer = null;
let voiceSeconds = 0;
let voiceInitialized = false;
let micPermission = false;
let recordedChunks = [];

function initVoiceModule() {
    if (voiceInitialized) return;
    voiceInitialized = true;

    const voiceBtn = document.getElementById('voice-record-btn');
    const voiceRecording = document.getElementById('voice-recording');
    const cancelVoice = document.getElementById('cancel-voice');
    const sendVoice = document.getElementById('send-voice');
    const voiceTimerEl = document.getElementById('voice-timer');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');

    if (!voiceBtn) return;

    // Check mic permission
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                micPermission = true;
                stream.getTracks().forEach(t => t.stop());
                voiceBtn.title = 'Hold to record voice message';
            })
            .catch(() => {
                micPermission = false;
                voiceBtn.title = 'Microphone access blocked';
                voiceBtn.style.opacity = '0.5';
            });
    }

    // Long press to record
    let pressTimer;
    voiceBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!micPermission) {
            showVoiceToast('Microphone permission denied');
            return;
        }
        pressTimer = setTimeout(() => {
            startVoiceRecording();
        }, 300);
    });

    voiceBtn.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
        if (isRecording) {
            stopVoiceRecording(true);
        }
    });

    voiceBtn.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
        if (isRecording) {
            stopVoiceRecording(false);
        }
    });

    // Touch events for mobile
    voiceBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!micPermission) return;
        pressTimer = setTimeout(() => {
            startVoiceRecording();
        }, 300);
    }, { passive: false });

    voiceBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        clearTimeout(pressTimer);
        if (isRecording) {
            stopVoiceRecording(true);
        }
    });

    voiceBtn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        clearTimeout(pressTimer);
        if (isRecording) {
            stopVoiceRecording(false);
        }
    });

    if (cancelVoice) {
        cancelVoice.addEventListener('click', () => stopVoiceRecording(false));
    }

    if (sendVoice) {
        sendVoice.addEventListener('click', () => stopVoiceRecording(true));
    }
}

async function startVoiceRecording() {
    const voiceBtn = document.getElementById('voice-record-btn');
    const voiceRecording = document.getElementById('voice-recording');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');

    try {
        voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        recordedChunks = [];

        const options = { mimeType: 'audio/webm' };
        voiceRecorder = new MediaRecorder(voiceStream, options);

        voiceRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        voiceRecorder.onstop = async () => {
            if (recordedChunks.length === 0) return;
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            await sendVoiceMessage(blob, voiceSeconds);
        };

        voiceRecorder.start();
        isRecording = true;

        // UI: hide input, show recording
        if (messageInput) messageInput.style.display = 'none';
        if (sendBtn) sendBtn.style.display = 'none';
        voiceBtn.innerHTML = '<i class="fas fa-stop-circle"></i>';
        voiceBtn.classList.add('recording');
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
    const waveEl = document.getElementById('voice-wave');

    // Restore UI
    if (messageInput) messageInput.style.display = '';
    if (sendBtn) sendBtn.style.display = '';
    voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    voiceBtn.classList.remove('recording');
    if (voiceRecording) voiceRecording.style.display = 'none';
    if (waveEl) waveEl.innerHTML = '';

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
            recordedChunks = [];
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
    for (let i = 0; i < 30; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.animationDelay = `${i * 0.05}s`;
        wave.appendChild(bar);
    }
}

async function sendVoiceMessage(blob, durationSeconds) {
    if (!navigator.onLine) {
        showVoiceToast('You are offline. Cannot send voice message.');
        return;
    }

    if (!window.currentUser || !window.currentChat) return;

    const m = Math.floor(durationSeconds / 60);
    const s = (durationSeconds % 60).toString().padStart(2, '0');
    const duration = `${m}:${s}`;

    showVoiceToast('Sending voice message...');

    try {
        const formData = new FormData();
        formData.append('audio', blob, `voice_${Date.now()}.webm`);
        formData.append('duration', duration);

        const uploadRes = await fetch('/upload-voice', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (uploadData.status === 'ok') {
            const res = await fetch('/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: window.currentUser.email,
                    to: window.currentChat.email,
                    message: uploadData.fileUrl,
                    type: 'voice',
                    duration: duration,
                    fileSize: uploadData.fileSize
                })
            });
            const data = await res.json();
            if (data.status === 'ok') {
                if (!window.chats) window.chats = {};
                if (!window.chats[window.currentChat.email]) {
                    window.chats[window.currentChat.email] = { messages: [] };
                }
                window.chats[window.currentChat.email].messages.push(data.message);

                if (window.addMessageToUI) {
                    window.addMessageToUI(data.message, true);
                }

                const s = document.getElementById('message-sent-sound');
                if (s) { s.currentTime = 0; s.play().catch(() => {}); }

                showVoiceToast('Voice message sent!');
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

window.initVoiceModule = initVoiceModule;