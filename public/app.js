// ========================================
// SOLDOWN - Frontend Application Logic
// ========================================

// State Management
let currentFormats = [];
let selectedFormat = null;

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const mainApp = document.getElementById('main-app');
const urlInput = document.getElementById('video-url');
const downloadBtn = document.getElementById('download-btn');
const statusMessage = document.getElementById('status-message');
const formatSelection = document.getElementById('format-selection');
const formatOptions = document.getElementById('format-options');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const installBtn = document.getElementById('install-btn');
let deferredPrompt;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed'));
    }
    
    // Show splash screen for 2-3 seconds
    setTimeout(() => {
        splashScreen.style.animation = 'fadeOut 0.8s ease-out';
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
        }, 800);
    }, 2500);
});

// PWA Install Handler
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        deferredPrompt = null;
        installBtn.classList.add('hidden');
    }
});

// Hide install button if already installed
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    installBtn.classList.add('hidden');
    deferredPrompt = null;
});

// URL Validation
function isValidURL(url) {
    try {
        const urlObj = new URL(url);
        // Check if it's a supported platform
        const supportedDomains = [
            'youtube.com',
            'youtu.be',
            'vimeo.com',
            'twitter.com',
            'x.com',
            'instagram.com',
            'tiktok.com',
            'fb.com',
            'facebook.com'
        ];

        return supportedDomains.some(domain =>
            urlObj.hostname.includes(domain)
        );
    } catch (e) {
        return false;
    }
}

// Show Status Message
function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 5000);
}

// Show Progress
function showProgress(percentage, text) {
    if (percentage > 0) {
        progressSection.classList.remove('hidden');
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = text;
    } else {
        progressSection.classList.add('hidden');
    }
}

// Reset UI
function resetUI() {
    formatSelection.classList.add('hidden');
    progressSection.classList.add('hidden');
    statusMessage.classList.add('hidden');
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = '<span class="btn-text">Download</span>';
    currentFormats = [];
    selectedFormat = null;
}

// Format Selection Handler
function renderFormatOptions(formats) {
    currentFormats = formats;
    formatOptions.innerHTML = '';

    formats.forEach((format, index) => {
        const option = document.createElement('div');
        option.className = 'format-option';
        option.dataset.index = index;

        option.innerHTML = `
            <div class="format-info">
                <div class="format-name">${format.format} • ${format.quality}</div>
                <div class="format-details">${format.codec || 'Available'} • itag ${format.itag}</div>
            </div>
            <div class="format-size">${format.size || 'N/A'}</div>
        `;

        option.addEventListener('click', () => {
            document.querySelectorAll('.format-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            selectedFormat = format;
        });

        formatOptions.appendChild(option);
    });

    formatSelection.classList.remove('hidden');

    // Select first option by default
    if (formats.length > 0) {
        formats[0].selected = true;
        document.querySelectorAll('.format-option')[0].classList.add('selected');
        selectedFormat = formats[0];
    }
}

// Download Button Handler
downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();

    // Validation
    if (!url) {
        showStatus('Please paste a video URL', 'error');
        return;
    }

    if (!isValidURL(url)) {
        showStatus('Invalid or unsupported URL. Please check the URL and try again.', 'error');
        return;
    }

    // If format is already selected, proceed with download
    if (selectedFormat) {
        await performDownload(url, selectedFormat);
        return;
    }

    // Otherwise, analyze the URL first
    await analyzeURL(url);
});

// Analyze URL
async function analyzeURL(url) {
    try {
        // Update UI
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="btn-loader">⚙️ Analyzing Link...</span>';

        // Reset UI
        resetUI();

        // Call backend API
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to analyze URL');
        }

        // Show format options
        showStatus(`Found ${data.formats.length} format(s) available`, 'success');
        renderFormatOptions(data.formats);

        // Update button
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span class="btn-text">Download</span>';

    } catch (error) {
        console.error('Error analyzing URL:', error);
        showStatus(error.message || 'Failed to analyze URL. Please try again.', 'error');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span class="btn-text">Download</span>';
    }
}

// Perform Download
async function performDownload(url, format) {
    try {
        // Update UI
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="btn-loader">⚙️ Converting...</span>';
        formatSelection.classList.add('hidden');
        showProgress(30, 'Converting to selected format...');

        // Call backend API
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url,
                format: format.format,
                quality: format.quality,
                itag: format.itag
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Download failed');
        }

        // Get file info
        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'video.' + (format.format === 'MP3' ? 'mp3' : 'mp4');

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }

        // Update progress
        showProgress(90, 'Preparing download...');

        // Download file
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        // Success
        showProgress(100, 'Download complete!');
        showStatus('Download started successfully!', 'success');

        // Reset after delay
        setTimeout(() => {
            resetUI();
            urlInput.value = '';
        }, 3000);

    } catch (error) {
        console.error('Error downloading:', error);
        showStatus(error.message || 'Download failed. Please try again.', 'error');
        showProgress(0);
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span class="btn-text">Download</span>';
    }
}

// Enter key handler
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !downloadBtn.disabled) {
        downloadBtn.click();
    }
});

// Paste handler for better UX
urlInput.addEventListener('paste', (e) => {
    setTimeout(() => {
        const pastedUrl = e.target.value.trim();
        if (isValidURL(pastedUrl)) {
            showStatus('URL detected! Click Download to continue.', 'success');
        }
    }, 100);
});

