class FileManager {
    constructor() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.tableBody = document.querySelector('#filesTable tbody');
        this.spaceInfo = document.querySelector('.space-info');
        this.progressFill = document.querySelector('.progress-fill');

        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressElement = this.uploadProgress.querySelector('.progress');
        this.percentageElement = this.uploadProgress.querySelector('.percentage');
        this.speedElement = this.uploadProgress.querySelector('.speed');
        this.timeRemainingElement = this.uploadProgress.querySelector('.time-remaining');
        
        this.startTime = null;
        this.lastLoaded = 0;
        this.modal = document.getElementById('previewModal');
        this.previewVideo = this.modal.querySelector('video');
        this.init();

    }

    init() {
        this.loadFiles();
        this.loadDiskSpace();

        // Event handlers
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        
        // Drag & drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            this.dropZone.addEventListener(event, this.preventDefaults);
        });

        ['dragenter', 'dragover'].forEach(event => {
            this.dropZone.addEventListener(event, () => this.highlight());
        });

        ['dragleave', 'drop'].forEach(event => {
            this.dropZone.addEventListener(event, () => this.unhighlight());
        });

        this.dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });

        // Sort handlers
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.sortTable(th.dataset.sort));
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePreview();
        });
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closePreview();
        });
    }

    async loadFiles() {
        try {
            const response = await fetch('/api/files');
            const files = await response.json();
            this.renderFiles(files);
        } catch (err) {
            this.showError('Failed to load files');
        }
    }

    async loadDiskSpace() {
        try {
            const response = await fetch('/api/disk-space');
            const { total, used, free } = await response.json();
            
            const format = (bytes) => 
                (bytes / 1024 ** 3).toLocaleString('en', { maximumFractionDigits: 2 }) + ' GB';

            this.spaceInfo.textContent = `
                Used: ${format(used)} / Total: ${format(total)}
            `;
            this.progressFill.style.width = `${(used / total * 100).toFixed(1)}%`;
        } catch (err) {
            this.showError('Failed to load disk info');
        }
    }

    async handleFiles(files) {
        if (files.length === 0) return;
        
        const formData = new FormData();
        formData.append('file', files[0]);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error);
            }

            this.loadFiles();
            this.loadDiskSpace();
        } catch (err) {
            this.showError(err.message);
        }
    }

    async deleteFile(filename) {
        if (!confirm('Are you sure you want to delete this file?')) return;
        
        try {
            await fetch(`/api/files/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            
            this.loadFiles();
            this.loadDiskSpace();
        } catch (err) {
            this.showError('Failed to delete file');
        }
    }

    renderFiles(files) {
        this.tableBody.innerHTML = files.map(file => `
            <tr>
                <td>${file.name.split('-').slice(2).join('-')}</td>
                <td>${this.formatSize(file.size)}</td>
                <td>${new Date(file.uploadedAt).toLocaleDateString()}</td>
                <td>
                    <button class="copy" onclick="fileManager.copyLink('${file.downloadUrl}')">Copy Link</button>
                    <button class="preview" onclick="fileManager.previewFile('${file.downloadUrl}')">Preview</button>
                    <a href="${file.downloadUrl}" download>
                        <button>Download</button>
                    </a>
                    <button class="delete" onclick="fileManager.deleteFile('${file.name}')">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    formatSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Byte';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / 1024 ** i).toFixed(2) + ' ' + sizes[i];
    }

    sortTable(column) {
        // Implement sorting logic here
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlight() {
        this.dropZone.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
    }

    unhighlight() {
        this.dropZone.style.backgroundColor = '';
    }


    async handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        this.showUploadProgress();
        this.resetProgress();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                const currentTime = Date.now();
                const elapsedTime = (currentTime - this.startTime) / 1000;
                const speed = e.loaded / elapsedTime; // bytes per second
                const remainingTime = (e.total - e.loaded) / speed;

                this.updateProgress({
                    loaded: e.loaded,
                    total: e.total,
                    progress,
                    speed,
                    remainingTime
                });
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                this.loadFiles();
                this.loadDiskSpace();
            } else {
                this.showError(xhr.responseText || 'Upload failed');
            }
            this.hideUploadProgress();
        });

        xhr.addEventListener('error', () => {
            this.showError('Upload failed');
            this.hideUploadProgress();
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    }

    showUploadProgress() {
        this.uploadProgress.style.display = 'block';
        this.startTime = Date.now();
        this.lastLoaded = 0;
    }

    hideUploadProgress() {
        setTimeout(() => {
            this.uploadProgress.style.display = 'none';
            this.progressElement.style.width = '0%';
        }, 500);
    }

    resetProgress() {
        this.progressElement.style.width = '0%';
        this.progressElement.style.backgroundColor = '#4CAF50';
        this.percentageElement.textContent = '0%';
        this.speedElement.textContent = '0 MB/s';
        this.timeRemainingElement.textContent = '0s remaining';
    }

    updateProgress({ loaded, total, progress, speed, remainingTime }) {
        // Анимация прогресса
        this.progressElement.style.width = `${progress}%`;
        
        // Рассчет скорости в MB/s
        const speedMB = (speed / 1024 / 1024).toFixed(1);
        
        // Форматирование оставшегося времени
        const formatTime = (seconds) => {
            if (seconds > 60) {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}m ${secs}s`;
            }
            return `${Math.ceil(seconds)}s`;
        };

        // Обновление данных
        this.percentageElement.textContent = `${Math.round(progress)}%`;
        this.speedElement.textContent = `${speedMB} MB/s`;
        this.timeRemainingElement.textContent = `${formatTime(remainingTime)} remaining`;

        // Изменение цвета при приближении к завершению
        if (progress > 95) {
            this.progressElement.style.backgroundColor = '#8BC34A';
        }
    }

    copyLink(url) {
        navigator.clipboard.writeText(window.location.origin + url)
            .then(() => alert('Link copied to clipboard!'))
            .catch(() => alert('Failed to copy link'));
    }

    previewFile(url) {
        this.previewVideo.src = url;
        this.modal.style.display = 'flex';
        this.previewVideo.play();
    }

    closePreview() {
        this.modal.style.display = 'none';
        this.previewVideo.pause();
        this.previewVideo.currentTime = 0;
    }
}

const fileManager = new FileManager();