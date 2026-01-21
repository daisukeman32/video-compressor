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

// FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;
let ffmpeg = null;

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
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// State
let selectedFile = null;
let selectedQuality = 'medium';
let compressedBlob = null;

// Initialize FFmpeg
async function initFFmpeg() {
    loadingOverlay.classList.add('show');
    loadingText.textContent = 'Loading FFmpeg...';

    ffmpeg = createFFmpeg({
        log: true,
        progress: ({ ratio }) => {
            const percent = Math.round(ratio * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `Compressing... ${percent}%`;
        }
    });

    try {
        await ffmpeg.load();
        console.log('FFmpeg loaded successfully');
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        showError('Failed to load FFmpeg. Please reload the page.');
    } finally {
        loadingOverlay.classList.remove('show');
    }
}

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
    if (!selectedFile || !ffmpeg) return;

    hideError();
    compressBtn.disabled = true;
    progressContainer.classList.add('show');
    progressFill.style.width = '0%';
    progressText.textContent = 'Loading file...';
    result.classList.remove('show');

    // CRF values (lower = higher quality)
    const crfValues = {
        high: 23,
        medium: 28,
        low: 35
    };
    const crf = crfValues[selectedQuality];

    try {
        // Get file extension
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        const inputName = `input.${ext}`;
        const outputName = 'output.mp4';

        // Write file to FFmpeg
        ffmpeg.FS('writeFile', inputName, await fetchFile(selectedFile));

        // Run compression
        progressText.textContent = 'Compressing...';
        await ffmpeg.run(
            '-i', inputName,
            '-c:v', 'libx264',
            '-crf', crf.toString(),
            '-preset', 'medium',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-y',
            outputName
        );

        // Read output file
        progressText.textContent = 'Preparing download...';
        const data = ffmpeg.FS('readFile', outputName);
        compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });

        // Show results
        const originalSize = selectedFile.size;
        const compressedSize = compressedBlob.size;
        const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        originalSizeEl.textContent = formatSize(originalSize);
        compressedSizeEl.textContent = formatSize(compressedSize);
        reductionEl.textContent = reduction + '%';

        progressContainer.classList.remove('show');
        result.classList.add('show');

        // Cleanup
        ffmpeg.FS('unlink', inputName);
        ffmpeg.FS('unlink', outputName);

    } catch (error) {
        console.error('Compression error:', error);
        showError('Compression error: ' + error.message);
        progressContainer.classList.remove('show');
    } finally {
        compressBtn.disabled = false;
    }
});

// Download
downloadBtn.addEventListener('click', () => {
    if (!compressedBlob) return;

    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compressed_' + (selectedFile?.name || 'video.mp4');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Initialize
initFFmpeg();
