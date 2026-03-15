// =====================================
// NEXUS CHAT - EMOJI PICKER v3.0
// Fixed: no auto-init on DOMContentLoaded, called after login
// =====================================

const EMOJI_CATEGORIES = {
    'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐'],
    'Gestures': ['👍','👎','👌','✌️','🤞','🤟','🤘','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','👏','🙌','🤲','🙏','✍️','💪','🦾','🤝','💅'],
    'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','♾️'],
    'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗'],
    'Food': ['🍎','🍊','🍋','🍇','🍓','🍒','🍑','🥭','🍍','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥦','🧄','🧅','🍄','🥜','🌰','🍞','🥐','🥖','🧀','🍖','🍗','🥩','🍔','🍟','🌭','🌮','🌯','🍕','🍣','🍱','🍜','🍝','🍛','🍲','🥘','🍿','🧆','🥚','🍳','🧇','🥞','🧈','🍰','🎂','🍩','🍪','🍫','🍬','🍭','🍮','☕','🍵','🧃','🥤','🍺','🍷'],
    'Travel': ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🛻','🚐','🛵','🏍️','🚲','🛴','🚁','✈️','🛸','🚀','🛶','⛵','🚢','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏭','🗼','🗽','⛪','🕌','🕍','⛩️','🛕','🗿','🗺️','🌋','⛰️','🏔️','🌁','🏕️','🏖️','🏜️','🏝️','🏞️'],
    'Objects': ['📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','🎥','📷','📸','📹','📟','📠','☎️','📞','📺','📻','🎙️','🎚️','🎛️','⏰','⏱️','⏲️','⏰','🕰️','⌚','📡','🔋','🔌','💡','🔦','🕯️','💰','💴','💵','💶','💷','💸','💳','🪙','🛒','💎','⚖️','🔧','🔨','⚒️','🛠️','⛏️','🔩','🗜️','💊','🩺','🔬','🔭','📡','🪤','🧲','🪣','🚪','🪑','🛋️','🚿','🛁','🧴','🧹','🧺','🧻','🧼','🪥'],
    'Symbols': ['❤️','✅','❌','⚠️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▶️','⏸️','⏭️','⏮️','⏩','⏪','⏫','⏬','🔀','🔁','🔂','▶️','⏩','⏹️','⏺️','🎦','🔅','🔆','📶','📳','📴','📵','📳','🚫','🔞','📵','🚯','🚱','🚳','🔕','🔇','🔈','🔉','🔊','📢','📣','🔔','🔕','🎵','🎶']
};

let emojiPickerInitialized = false;

function initEmojiPicker() {
    if (emojiPickerInitialized) return; // Never double-init

    const btn = document.getElementById('emoji-picker-btn');
    const container = document.getElementById('emoji-picker');

    if (!btn || !container) return;

    emojiPickerInitialized = true;

    // Build the picker
    buildEmojiPicker(container);

    // Click to toggle - single listener
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = container.style.display === 'none' || container.style.display === '';
        container.style.display = isHidden ? 'block' : 'none';
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            container.style.display = 'none';
        }
    });
}

function buildEmojiPicker(container) {
    container.innerHTML = '';
    container.className = 'emoji-picker-box';

    // Tab buttons
    const tabBar = document.createElement('div');
    tabBar.className = 'emoji-tab-bar';
    const categoryIcons = {
        'Smileys': '😊', 'Gestures': '👍', 'Hearts': '❤️', 'Animals': '🐶',
        'Food': '🍕', 'Travel': '✈️', 'Objects': '💻', 'Symbols': '🔵'
    };

    let activeCategory = 'Smileys';
    const gridContainer = document.createElement('div');
    gridContainer.className = 'emoji-grid';

    function showCategory(cat) {
        activeCategory = cat;
        gridContainer.innerHTML = '';
        (EMOJI_CATEGORIES[cat] || []).forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'emoji-btn';
            btn.textContent = emoji;
            btn.title = emoji;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                insertEmoji(emoji);
            });
            gridContainer.appendChild(btn);
        });
        // Update active tab
        tabBar.querySelectorAll('.emoji-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.cat === cat);
        });
    }

    Object.keys(EMOJI_CATEGORIES).forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'emoji-tab';
        tab.dataset.cat = cat;
        tab.textContent = categoryIcons[cat] || cat[0];
        tab.title = cat;
        tab.addEventListener('click', (e) => { e.stopPropagation(); showCategory(cat); });
        tabBar.appendChild(tab);
    });

    container.appendChild(tabBar);
    container.appendChild(gridContainer);

    showCategory('Smileys');
}

function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;
    input.value = value.substring(0, start) + emoji + value.substring(end);
    input.selectionStart = input.selectionEnd = start + emoji.length;
    input.focus();

    // Trigger input event for send button toggle
    input.dispatchEvent(new Event('input'));

    // Hide picker after inserting
    const picker = document.getElementById('emoji-picker');
    if (picker) picker.style.display = 'none';
}

// Called by auth.js after login - NOT on DOMContentLoaded
window.initEmojiPicker = initEmojiPicker;

/* ===== BUG FIXES ADDED BELOW (NO ORIGINAL CODE REMOVED) ===== */
// Bug 6 & 41: iOS Style Emoji Fix
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = '.emoji-btn { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif !important; }';
    document.head.appendChild(style);
});