class FileManager {
    constructor() {
        this.initResumable();
        this.initDropZone();
        this.loadFiles();
        this.initSorting();
        setInterval(() => this.updateDiskSpace(), 5000);
    }

    initResumable() {
        this.resumable = new Resumable({
            target: '/upload',
            chunkSize: 1*1024*1024,
            simultaneousUploads: 3,
            testChunks: false
        });

        this.resumable.assignBrowse(document.getElementById('fileInput'));
        this.resumable.assignDrop(document.getElementById('dropZone'));

        this.resumable.on('fileAdded', (file) => {
            this.showProgress(file);
            this.resumable.upload();
        });

        this.resumable.on('fileProgress', (file) => {
            this.updateProgress(file);
        });

        this.resumable.on('fileSuccess', () => {
            this.loadFiles();
            this.updateDiskSpace();
        });
    }

    initDropZone() {
        const dropZone = document.getElementById('dropZone');
        
        dropZone.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        ['dragover', 'drop'].forEach(event => {
            dropZone.addEventListener(event, e => e.preventDefault());
        });

        dropZone.addEventListener('dragover', () => {
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('dragover');
            this.resumable.addFiles(e.dataTransfer.files);
        });
    }

    async loadFiles() {
        const response = await fetch('/files');
        const files = await response.json();
        this.renderFiles(files);
    }

    renderFiles(files) {
        const tbody = document.querySelector('#filesTable tbody');
        tbody.innerHTML = files.map(file => `
            <tr>
                <td>${file.name}</td>
                <td>${this.formatSize(file.size)}</td>
                <td>${file.type}</td>
                <td>${new Date(file.uploaded).toLocaleDateString()}</td>
                <td>
                    <button class="button download-btn" onclick="location.href='/download/${file.name}'">Download</button>
                    <button class="button copy-btn" onclick="navigator.clipboard.writeText(location.origin + '/download/${file.name}')">Copy URL</button>
                    <button class="button delete-btn" onclick="this.confirmDelete('${file.name}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async updateDiskSpace() {
        const response = await fetch('/disk-space');
        const { free, used, total } = await response.json();
        const percent = (used / total * 100).toFixed(1);
        
        document.querySelector('.progress').style.width = `${percent}%`;
        document.querySelector('.disk-stats').innerHTML = `
            Used: ${this.formatSize(used)} / 
            Total: ${this.formatSize(total)} 
            (${percent}%)
        `;
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unit = 0;
        
        while(size >= 1024 && unit < units.length-1) {
            size /= 1024;
            unit++;
        }
        
        return `${size.toFixed(1)} ${units[unit]}`;
    }

    showProgress(file) {
        const progress = document.createElement('div');
        progress.className = 'upload-progress';
        progress.innerHTML = `
            <div>${file.fileName} - <span class="percent">0%</span></div>
            <div>Speed: <span class="speed">0 MB/s</span></div>
            <div>Time left: <span class="time">--</span></div>
        `;
        document.querySelector('.container').appendChild(progress);
        file.progressElement = progress;
    }

    updateProgress(file) {
        const progress = file.progress();
        const elapsed = (Date.now() - file.timeStart) / 1000;
        const speed = (progress * file.size) / elapsed / 1024 / 1024;
        const remaining = (file.size - progress * file.size) / (speed * 1024 * 1024);
        
        file.progressElement.querySelector('.percent').textContent = 
            `${Math.round(progress * 100)}%`;
        file.progressElement.querySelector('.speed').textContent = 
            `${speed.toFixed(1)} MB/s`;
        file.progressElement.querySelector('.time').textContent = 
            `${remaining.toFixed(1)}s`;
    }

    confirmDelete(filename) {
        if(confirm(`Delete ${filename}?`)) {
            fetch(`/files/${filename}`, { method: 'DELETE' })
                .then(() => this.loadFiles())
                .then(() => this.updateDiskSpace());
        }
    }

    initSorting() {
        document.querySelectorAll('#filesTable th').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.cellIndex;
                const tbody = document.querySelector('#filesTable tbody');
                const rows = Array.from(tbody.rows);
                
                rows.sort((a, b) => {
                    const aVal = a.cells[column].textContent;
                    const bVal = b.cells[column].textContent;
                    
                    if(column === 1 || column === 3) {
                        return parseFloat(aVal) - parseFloat(bVal);
                    }
                    return aVal.localeCompare(bVal);
                });
                
                tbody.append(...rows);
            });
        });
    }
}

new FileManager();