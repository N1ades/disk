const immediate = (fn) => new Promise<void>(async (resolve, reject) => {
    setTimeout(async () => {
        try {
            await fn()
            resolve()
        } catch (error) {
            reject(error)
        }
    }, 0);
})

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

const getAllFileEntries = async (dataTransferItemList) => {
    let fileEntries = [];
    // Use BFS to traverse entire directory/file structure
    let queue = [];
    // Unfortunately dataTransferItemList is not iterable i.e. no forEach
    for (let i = 0; i < dataTransferItemList.length; i++) {
        // Note webkitGetAsEntry a non-standard feature and may change
        // Usage is necessary for handling directories
        queue.push(dataTransferItemList[i].webkitGetAsEntry());
    }
    while (queue.length > 0) {
        let entry = queue.shift();
        if (entry.isFile) {
            // const file = await new Promise((resolve, reject) => { entry.file(resolve, reject); });
            // file.webkitRelativePath = entry.webkitRelativePath;
            // console.log(file);

            fileEntries.push(entry);
        } else if (entry.isDirectory) {
            queue.push(...await readAllDirectoryEntries(entry.createReader()));
        }
    }
    return fileEntries;
}

// Get all the entries (files or sub-directories) in a directory 
// by calling readEntries until it returns empty array
const readAllDirectoryEntries = async (directoryReader) => {
    let entries = [];
    let readEntries = await readEntriesPromise(directoryReader);
    while (readEntries.length > 0) {
        entries.push(...readEntries);
        readEntries = await readEntriesPromise(directoryReader);
    }
    return entries;
}

// Wrap readEntries in a promise to make working with readEntries easier
// readEntries will return only some of the entries in a directory
// e.g. Chrome returns at most 100 entries at a time
const readEntriesPromise = async (directoryReader) => {
    try {
        return await new Promise((resolve, reject) => {
            directoryReader.readEntries(resolve, reject);
        });
    } catch (err) {
        console.log(err);
    }
}



export class FileManager {
    files = new Map();
    filesInfo = new Map();
    eventListeners = {};

    addFile = async (entry) => {
        // console.log('add file', entry);

        const file = entry?.file ? await new Promise((resolve, reject) => {
            entry?.file(resolve, reject)
        }) : entry;

        const path = entry.fullPath || entry.webkitRelativePath || file.webkitRelativePath || file.fullPath || file.name;

        const meta = {
            path: 'All/' + path.replace(/^\/+/, ''),
            info: {
                name: path.split('/').pop(),
                lastModified: file.lastModified,
                size: file.size,
                type: file.type,
            },
            file: file,
        }

        const metaHash = JSON.stringify(meta.info)
        if (this.files.has(meta.path)) {
            this.files.delete(meta.path);
            this.filesInfo.delete(metaHash)
        }

        const existsFileInfo = this.filesInfo.get(metaHash)
        if (existsFileInfo) {
            this.files.delete(existsFileInfo.path);
            this.filesInfo.delete(metaHash)
        }

        this.files.set(meta.path, meta);
        this.filesInfo.set(JSON.stringify(meta.info), meta);
        this.updateList();
    }

    updateList = debounce(async () => {
        this.eventListeners["change"]?.forEach((listener) => listener(this.files));
    }, 100);



    dropzoneEventHandler = async (event, progressCallback) => {
        event.preventDefault();
        immediate(() => progressCallback(0.01))
        let files = await getAllFileEntries(event.dataTransfer.items);
        console.log(files.length);
        let i = 0;
        for (const file of files) {
            i++;
            if (i % 1000 === 0) {
                await immediate(() => progressCallback(i / files.length))
            }

            await this.addFile(file);
        }
    }

    fileChangeEventHandler = async (event, progressCallback) => {
        event.preventDefault();
        let files = Array.from(event.currentTarget.files);
        immediate(() => progressCallback(0.01))

        try {
            let i = 0;
            for (const file of files) {
                i++;
                if (i % 1000 === 0) {
                    await immediate(() => progressCallback(i / files.length))
                }
                this.addFile(file);
            }
        } finally {
            event.currentTarget.value = null;
        }
    }

    addEventListener = (type, listener, options) => {
        // this.eventListeners[type] = listener;
        this.eventListeners[type] ||= [];
        this.eventListeners[type].push(listener);
    }
}
