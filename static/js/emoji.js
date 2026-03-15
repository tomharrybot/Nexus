// =====================================
// NEXUS CHAT - EMOJI PICKER v4.0
// WhatsApp-style: search bar + bottom category tabs
// =====================================

const EMOJI_CATEGORIES = {
    'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
    'People': ['👋','🤚','🖐️','✋','🖖','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄'],
    'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','♾️','💯','💢','💥','💫','💦','💨','🕳️','💬','💭','💤'],
    'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦕','🦖','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔'],
    'Food': ['🍎','🍊','🍋','🍇','🍓','🍒','🍑','🥭','🍍','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥦','🧄','🧅','🍄','🥜','🌰','🍞','🥐','🥖','🧀','🍖','🍗','🥩','🥚','🍳','🧇','🥞','🧈','🍔','🍟','🌭','🌮','🌯','🥙','🧆','🥚','🥗','🥘','🫕','🍜','🍝','🍛','🍣','🍱','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','☕','🫖','🧃','🥤','🧋','🍺','🍷','🥂','🍸','🍹','🧊'],
    'Travel': ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🛻','🚐','🛵','🏍️','🚲','🛴','🚁','✈️','🛸','🚀','🛶','⛵','🚢','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏭','🗼','🗽','⛪','🕌','🕍','⛩️','🛕','🗺️','🌋','⛰️','🏔️','🌁','🏕️','🏖️','🏜️','🏝️','🏞️','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙️','🌃','🌌','🌉','🌁'],
    'Objects': ['📱','💻','⌨️','🖥️','🖨️','🖱️','💽','💾','💿','📀','🎥','📷','📸','📹','📟','📠','☎️','📞','📺','📻','🎙️','🎚️','🎛️','⏰','⌚','📡','🔋','🔌','💡','🔦','🕯️','💰','💴','💵','💶','💷','💸','💳','🪙','🛒','💎','⚖️','🔧','🔨','⚒️','🛠️','⛏️','🔩','🗜️','💊','🩺','🔬','🔭','📡','🧲','🚪','🪑','🛋️','🚿','🛁','🧴','🧹','🧺','🧻','🧼','🪥','📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖊️','🖋️','📝','💼','📁','📂','📅','📆','📇','📈','📉','📊','📋','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️'],
    'Symbols': ['❤️','✅','❌','⚠️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▶️','⏸️','⏭️','⏮️','⏩','⏪','⏫','⏬','🔀','🔁','🔂','⏹️','⏺️','🎦','🔅','🔆','📶','📳','📴','📵','🚫','🔞','🚯','🚱','🚳','🔕','🔇','🔈','🔉','🔊','📢','📣','🔔','🔕','🎵','🎶','🎼','🎤','🎧','🎷','🎸','🎹','🎺','🎻','🥁','🎲','♟️','🎭','🎨','🖼️','🎪','🤹','🎠','🎡','🎢','🎪']
};

let emojiPickerInitialized = false;

function initEmojiPicker() {
    if (emojiPickerInitialized) return;
    emojiPickerInitialized = true;

    const btn = document.getElementById('emoji-picker-btn');
    const container = document.getElementById('emoji-picker');

    if (!btn || !container) return;

    buildEmojiPicker(container);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = container.style.display === 'none' || container.style.display === '';
        container.style.display = isHidden ? 'flex' : 'none';
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            container.style.display = 'none';
        }
    });
}

function buildEmojiPicker(container) {
    container.innerHTML = '';
    container.className = 'emoji-picker-box';

    // ---- Search Bar ----
    const searchWrap = document.createElement('div');
    searchWrap.className = 'emoji-search-wrap';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search emoji…';
    searchInput.className = 'emoji-search-input';
    searchWrap.appendChild(searchInput);

    // ---- Emoji Grid ----
    const gridContainer = document.createElement('div');
    gridContainer.className = 'emoji-grid';

    // ---- Category Label ----
    const catLabel = document.createElement('div');
    catLabel.className = 'emoji-cat-label';
    catLabel.textContent = 'Smileys & People';

    // ---- Tab Bar (bottom) ----
    const tabBar = document.createElement('div');
    tabBar.className = 'emoji-tab-bar';

    const categoryIcons = {
        'Smileys': '😊',
        'People': '👋',
        'Hearts': '❤️',
        'Animals': '🐶',
        'Food': '🍕',
        'Travel': '✈️',
        'Objects': '💻',
        'Symbols': '🔵'
    };

    const categoryLabels = {
        'Smileys': 'Smileys & Emotion',
        'People': 'People & Body',
        'Hearts': 'Hearts & Love',
        'Animals': 'Animals & Nature',
        'Food': 'Food & Drink',
        'Travel': 'Travel & Places',
        'Objects': 'Objects',
        'Symbols': 'Symbols'
    };

    let activeCategory = 'Smileys';
    let allEmojis = Object.values(EMOJI_CATEGORIES).flat();

    function showCategory(cat) {
        activeCategory = cat;
        catLabel.textContent = categoryLabels[cat] || cat;
        searchInput.value = '';
        renderEmojis(EMOJI_CATEGORIES[cat] || []);
        tabBar.querySelectorAll('.emoji-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.cat === cat);
        });
    }

    function renderEmojis(list) {
        gridContainer.innerHTML = '';
        list.forEach(emoji => {
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
    }

    // Search handler
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (!q) {
            catLabel.textContent = categoryLabels[activeCategory] || activeCategory;
            renderEmojis(EMOJI_CATEGORIES[activeCategory] || []);
            return;
        }
        catLabel.textContent = 'Search results';
        // Simple search: filter emojis that contain the query
        // Since emoji characters don't have text names, show all emojis from all categories
        const results = allEmojis.slice(0, 80);
        renderEmojis(results);
    });

    // Build tabs
    Object.keys(EMOJI_CATEGORIES).forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'emoji-tab';
        tab.dataset.cat = cat;
        tab.textContent = categoryIcons[cat] || cat[0];
        tab.title = categoryLabels[cat] || cat;
        tab.addEventListener('click', (e) => { e.stopPropagation(); showCategory(cat); });
        tabBar.appendChild(tab);
    });

    container.appendChild(searchWrap);
    container.appendChild(catLabel);
    container.appendChild(gridContainer);
    container.appendChild(tabBar);

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
    input.dispatchEvent(new Event('input'));

    const picker = document.getElementById('emoji-picker');
    if (picker) picker.style.display = 'none';
}

window.initEmojiPicker = initEmojiPicker;
