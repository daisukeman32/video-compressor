// Theme toggle
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
});

// DOM
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const videoPreview = document.getElementById('videoPreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const changeBtn = document.getElementById('changeBtn');
const options = document.getElementById('options');
const qualityOptions = document.querySelectorAll('.quality-option');
const compressBtn = document.getElementById('compressBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const result = document.getElementById('result');
const originalSizeEl = document.getElementById('originalSize');
const compressedSizeEl = document.getElementById('compressedSize');
const reductionEl = document.getElementById('reduction');
const downloadBtn = document.getElementById('downloadBtn');
const errorEl = document.getElementById('error');

// State
let selectedFile = null;
let selectedQuality = 'medium';
let downloadUrl = null;

// Format file size
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show error
function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
}

// Hide error
function hideError() {
    errorEl.classList.remove('show');
}

// Handle file select
function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('Please select a video file');
        return;
    }

    hideError();
    selectedFile = file;

    // Show preview
    const url = URL.createObjectURL(file);
    videoPreview.src = url;
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);

    dropZone.classList.add('hidden');
    preview.classList.add('show');
    options.classList.add('show');
    compressBtn.classList.add('show');
    result.classList.remove('show');
}

// Drop zone events
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

// Change button
changeBtn.addEventListener('click', () => {
    videoPreview.src = '';
    selectedFile = null;
    fileInput.value = '';
    dropZone.classList.remove('hidden');
    preview.classList.remove('show');
    options.classList.remove('show');
    compressBtn.classList.remove('show');
    result.classList.remove('show');
});

// Quality select
qualityOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        qualityOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedQuality = opt.dataset.quality;
    });
});

// Compress
compressBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    hideError();
    compressBtn.disabled = true;
    progressContainer.classList.add('show');
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading...';
    result.classList.remove('show');

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('quality', selectedQuality);

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 50);
                progressFill.style.width = pct + '%';
                progressText.textContent = `Uploading... ${pct * 2}%`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    downloadUrl = data.downloadUrl;

                    originalSizeEl.textContent = formatSize(data.originalSize);
                    compressedSizeEl.textContent = formatSize(data.compressedSize);
                    const reduction = ((1 - data.compressedSize / data.originalSize) * 100).toFixed(1);
                    reductionEl.textContent = reduction + '%';

                    progressContainer.classList.remove('show');
                    result.classList.add('show');
                } else {
                    showError(data.error || 'Compression failed');
                    progressContainer.classList.remove('show');
                }
            } else {
                showError('Server error');
                progressContainer.classList.remove('show');
            }
            compressBtn.disabled = false;
        });

        xhr.addEventListener('error', () => {
            showError('Network error');
            progressContainer.classList.remove('show');
            compressBtn.disabled = false;
        });

        // Simulate compression progress after upload
        xhr.addEventListener('loadend', () => {
            if (xhr.status === 200 && !JSON.parse(xhr.responseText).success) return;
        });

        xhr.open('POST', '/compress');
        xhr.send(formData);

        // Animate progress during server processing
        let progress = 50;
        const interval = setInterval(() => {
            if (progress < 95) {
                progress += Math.random() * 3;
                progressFill.style.width = progress + '%';
                progressText.textContent = 'Compressing...';
            }
        }, 500);

        xhr.addEventListener('loadend', () => clearInterval(interval));

    } catch (err) {
        showError('Error: ' + err.message);
        progressContainer.classList.remove('show');
        compressBtn.disabled = false;
    }
});

// Download
downloadBtn.addEventListener('click', () => {
    if (downloadUrl) {
        window.location.href = downloadUrl;
    }
});
