// =====================================
// NEXUS CHAT - MEDIA MODULE
// Complete Media Upload, Download, Preview, and Management
// =====================================

// DOM Elements
const mediaViewerModal = document.getElementById('media-viewer-modal');
const mediaContainer = document.getElementById('media-container');
const mediaInfo = document.getElementById('media-info');
const downloadMediaBtn = document.getElementById('download-media-btn');
const shareMediaBtn = document.getElementById('share-media-btn');
const closeMediaBtn = document.querySelector('.close-media');

// Media state
let currentMediaUrl = null;
let currentMediaType = null;
let currentMediaName = null;

// ===== INITIALIZATION =====
function initMediaModule() {
    setupMediaViewer();
    setupFileUpload();
    setupImageCompression();
}

// ===== MEDIA VIEWER =====

// Setup media viewer
function setupMediaViewer() {
    if (closeMediaBtn) {
        closeMediaBtn.addEventListener('click', closeMediaViewer);
    }

    if (downloadMediaBtn) {
        downloadMediaBtn.addEventListener('click', () => {
            if (currentMediaUrl) {
                downloadMedia(currentMediaUrl, currentMediaName || 'media');
            }
        });
    }

    if (shareMediaBtn) {
        shareMediaBtn.addEventListener('click', shareMedia);
    }

    // Close on click outside
    mediaViewerModal.addEventListener('click', (e) => {
        if (e.target === mediaViewerModal) {
            closeMediaViewer();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mediaViewerModal.classList.contains('active')) {
            closeMediaViewer();
        }
    });
}

// View media
function viewMedia(url, type, name = '') {
    if (!url || !mediaContainer) return;

    currentMediaUrl = url;
    currentMediaType = type;
    currentMediaName = name;

    // Clear container
    mediaContainer.innerHTML = '';

    // Create media element based on type
    if (type === 'image' || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = name || 'Image';
        img.loading = 'lazy';

        // Show loading state
        img.style.opacity = '0';
        img.onload = () => {
            img.style.opacity = '1';
            updateMediaInfo(name, 'image');
        };

        mediaContainer.appendChild(img);
    } 
    else if (type === 'video' || url.match(/\.(mp4|webm|ogg|mov)$/i)) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.autoplay = false;
        video.preload = 'metadata';

        mediaContainer.appendChild(video);
        updateMediaInfo(name, 'video');
    }
    else if (type === 'audio' || url.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) {
        const audio = document.createElement('audio');
        audio.src = url;
        audio.controls = true;
        audio.autoplay = false;

        mediaContainer.appendChild(audio);
        updateMediaInfo(name, 'audio');
    }
    else {
        // Document or other file
        showDocumentPreview(url, name);
    }

    // Show modal
    mediaViewerModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Show document preview
function showDocumentPreview(url, name) {
    const extension = name.split('.').pop().toLowerCase();

    const docPreview = document.createElement('div');
    docPreview.className = 'document-preview';

    // Get appropriate icon
    const icon = getFileIcon(extension);

    docPreview.innerHTML = `
        <i class="fas ${icon}" style="font-size: 80px; margin-bottom: 20px;"></i>
        <h3>${name}</h3>
        <p>Click download to view this file</p>
    `;

    mediaContainer.appendChild(docPreview);
    updateMediaInfo(name, 'document');
}

// Update media info
function updateMediaInfo(name, type) {
    if (!mediaInfo) return;

    const fileSize = getFileSizeFromUrl(currentMediaUrl);

    mediaInfo.innerHTML = `
        <div class="media-name">${name || 'Untitled'}</div>
        <div class="media-type">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
        ${fileSize ? `<div class="media-size">${fileSize}</div>` : ''}
    `;
}

// Close media viewer
function closeMediaViewer() {
    mediaViewerModal.classList.remove('active');
    document.body.style.overflow = '';

    // Pause any playing media
    const media = mediaContainer.querySelector('video, audio');
    if (media) {
        media.pause();
    }

    // Clear container after animation
    setTimeout(() => {
        mediaContainer.innerHTML = '';
    }, 300);
}

// ===== MEDIA DOWNLOAD =====

// Download media
async function downloadMedia(url, filename) {
    try {
        showToast('Downloading...', 'info');

        const response = await fetch(url);
        const blob = await response.blob();

        // Create download link
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || getFilenameFromUrl(url);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        window.URL.revokeObjectURL(blobUrl);

        showToast('Download complete', 'success');
    } catch (error) {
        console.error('Error downloading:', error);
        showToast('Download failed', 'error');
    }
}

// Share media (Web Share API)
async function shareMedia() {
    if (!currentMediaUrl) return;

    if (navigator.share) {
        try {
            const response = await fetch(currentMediaUrl);
            const blob = await response.blob();
            const file = new File([blob], currentMediaName || 'media', { type: blob.type });

            await navigator.share({
                title: 'Nexus Chat Media',
                text: 'Check out this media from Nexus Chat',
                files: [file]
            });

            showToast('Shared successfully', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                showToast('Sharing failed', 'error');
            }
        }
    } else {
        // Fallback - copy link to clipboard
        navigator.clipboard.writeText(currentMediaUrl);
        showToast('Link copied to clipboard', 'success');
    }
}

// ===== FILE UPLOAD =====

// Setup file upload
function setupFileUpload() {
    const fileUpload = document.getElementById('file-upload');
    if (!fileUpload) return;

    fileUpload.addEventListener('change', handleFileSelect);
}

// Handle file select
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);

    if (files.length === 0) return;

    // Show preview for first file
    const file = files[0];

    if (file.type.startsWith('image/')) {
        previewImage(file);
    } else if (file.type.startsWith('video/')) {
        previewVideo(file);
    } else if (file.type.startsWith('audio/')) {
        previewAudio(file);
    } else {
        previewDocument(file);
    }

    // Show selected files count
    if (files.length > 1) {
        showToast(`${files.length} files selected`, 'info');
    }
}

// Preview image before upload
function previewImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        // Create preview element
        const previewContainer = document.createElement('div');
        previewContainer.className = 'file-preview';
        previewContainer.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <div class="preview-overlay">
                <span>${file.name}</span>
                <span>${formatFileSize(file.size)}</span>
            </div>
            <button class="remove-preview" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Insert before message input
        const inputContainer = document.querySelector('.message-input-container');
        document.querySelector('.chat-area').insertBefore(previewContainer, inputContainer);
    };
    reader.readAsDataURL(file);
}

// Preview video
function previewVideo(file) {
    const url = URL.createObjectURL(file);
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview video-preview';
    previewContainer.innerHTML = `
        <video src="${url}" controls></video>
        <div class="preview-overlay">
            <span>${file.name}</span>
            <span>${formatFileSize(file.size)}</span>
        </div>
        <button class="remove-preview" onclick="this.parentElement.remove(); URL.revokeObjectURL('${url}')">
            <i class="fas fa-times"></i>
        </button>
    `;

    const inputContainer = document.querySelector('.message-input-container');
    document.querySelector('.chat-area').insertBefore(previewContainer, inputContainer);
}

// Preview audio
function previewAudio(file) {
    const url = URL.createObjectURL(file);
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview audio-preview';
    previewContainer.innerHTML = `
        <i class="fas fa-music"></i>
        <audio src="${url}" controls></audio>
        <div class="preview-overlay">
            <span>${file.name}</span>
            <span>${formatFileSize(file.size)}</span>
        </div>
        <button class="remove-preview" onclick="this.parentElement.remove(); URL.revokeObjectURL('${url}')">
            <i class="fas fa-times"></i>
        </button>
    `;

    const inputContainer = document.querySelector('.message-input-container');
    document.querySelector('.chat-area').insertBefore(previewContainer, inputContainer);
}

// Preview document
function previewDocument(file) {
    const icon = getFileIcon(file.name.split('.').pop());
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview document-preview';
    previewContainer.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="document-info">
            <div class="doc-name">${file.name}</div>
            <div class="doc-size">${formatFileSize(file.size)}</div>
        </div>
        <button class="remove-preview" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    const inputContainer = document.querySelector('.message-input-container');
    document.querySelector('.chat-area').insertBefore(previewContainer, inputContainer);
}

// ===== IMAGE COMPRESSION =====

// Setup image compression
function setupImageCompression() {
    // This will be used when uploading images
}

// Compress image
async function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', quality);
            };

            img.onerror = reject;
        };

        reader.onerror = reject;
    });
}

// ===== UTILITY FUNCTIONS =====

// Get file icon based on extension
function getFileIcon(extension) {
    const icons = {
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'ppt': 'fa-file-powerpoint',
        'pptx': 'fa-file-powerpoint',
        'txt': 'fa-file-alt',
        'zip': 'fa-file-archive',
        'rar': 'fa-file-archive',
        '7z': 'fa-file-archive',
        'mp3': 'fa-file-audio',
        'wav': 'fa-file-audio',
        'mp4': 'fa-file-video',
        'mov': 'fa-file-video',
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image'
    };

    return icons[extension.toLowerCase()] || 'fa-file';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get filename from URL
function getFilenameFromUrl(url) {
    return url.split('/').pop() || 'download';
}

// Get file size from URL (if possible)
function getFileSizeFromUrl(url) {
    // This would require a HEAD request
    return null;
}

// Use global showToast from main.js - already defined there

// ===== EXPORT FUNCTIONS =====
window.viewMedia = viewMedia;
window.downloadMedia = downloadMedia;
window.shareMedia = shareMedia;
window.compressImage = compressImage;
window.formatFileSize = formatFileSize;
window.getFileIcon = getFileIcon;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initMediaModule);

/* ===== BUG FIXES ADDED BELOW (NO ORIGINAL CODE REMOVED) ===== */
// Bug 16: Clear file upload preview after sending
const originalClearMessageInput = window.clearMessageInput;
window.clearMessageInput = function() {
    if(originalClearMessageInput) originalClearMessageInput();
    document.querySelectorAll('.file-preview').forEach(el => el.remove());
    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) fileUpload.value = '';
};

document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-message-btn');
    if(sendBtn) {
        sendBtn.addEventListener('click', () => {
            setTimeout(() => {
                document.querySelectorAll('.file-preview').forEach(el => el.remove());
                const fileUpload = document.getElementById('file-upload');
                if (fileUpload) fileUpload.value = '';
            }, 300);
        });
    }
});