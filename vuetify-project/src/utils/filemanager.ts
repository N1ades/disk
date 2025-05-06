import { throttle } from 'throttle-debounce';


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

// const debounce = (func, delay) => {
//     let timeoutId;
//     return (...args) => {
//         clearTimeout(timeoutId);
//         timeoutId = setTimeout(() => func(...args), delay);
//     };
// };

const getAllFileEntries = async (dataTransferItemList) => {
    let fileEntries = [];
    // Use BFS to traverse entire directory/file structure
    let queue = [];
    // Unfortunately dataTransferItemList is not iterable i.e. no forEach
    for (let i = 0; i < dataTransferItemList.length; i++) {
        // Note webkitGetAsEntry a non-standard feature and may change
        // Usage is necessary for handling directories

        const entry = await dataTransferItemList[i].webkitGetAsEntry();

        if (!entry) {
            let fallbackFile;
            try {
                fallbackFile = await dataTransferItemList[i].getAsFile()
            } catch (error) {
                console.error(error);
            }

            if (!fallbackFile) {
                const confirmation = confirm('Oops! Something went wrong. Please make sure the file is accessible and that you have read permissions. Continue?');
                if (!confirmation) {
                    break
                }

                continue
            }


            if (fallbackFile.size === 0 && !confirm(
                'The dragged file has zero size. This can happen if you drag a folder directly from an unextracted archive. Please press "Cancel" and extract the archive first or drag entire archive.\n\nDo you want to continue and add this as an empty file?'
            )) { continue }

            fileEntries.push(fallbackFile);

            continue;
        }


        queue.push(entry);
    }
    while (queue.length > 0) {
        let entry = queue.shift();
        if (entry.isFile) {
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
    changedFiles = new Map();
    rawFiles = new Map();
    // filesInfo = new Map();

    addFile = async (entry) => {

        const file = entry?.file ? await new Promise((resolve, reject) => {
            entry?.file(resolve, reject)
        }) : entry;

        const path = entry.fullPath || entry.webkitRelativePath || file.webkitRelativePath || file.fullPath || file.name;

        const meta = {
            path: 'files/' + path.replace(/^\/+/, ''),
            info: {
                name: path.split('/').pop(),
                lastModified: file.lastModified,
                size: file.size,
                type: file.type,
            },
            file: file,
        }
        this.rawFiles.set(meta.path, file);

        // const metaHash = JSON.stringify(meta.info)
        // if (this.files.has(meta.path)) {
        //     this.files.delete(meta.path);
        //     // this.filesInfo.delete(metaHash)
        // }

        // const existsFileInfo = this.filesInfo.get(metaHash)
        // if (existsFileInfo) {
        //     this.files.delete(existsFileInfo.path);
        //     this.filesInfo.delete(metaHash)
        // }

        this.changedFiles.set(meta.path, meta);

        this.updateList();
    }

    // deleteFile = async (path) => {
    //     this.files.delete(path);
    //     // this.updateList();
    // }

    // linkFile = async (path, link) => {
    //     const file = this.files.get(path);
    //     if (!file) return
    //     file.link = link;
    //     // this.updateList();
    // }

    updateList = throttle(1000, async () => {
        const changedFiles = Array.from(this.changedFiles.values())
        this.changedFiles.clear();

        this.eventListeners["change"]?.forEach((listener) => {
            listener(changedFiles)
        });
    });



    dropzoneEventHandler = async (event, progressCallback) => {
        event.preventDefault();
        progressCallback(0.01);
        let files = await getAllFileEntries(event.dataTransfer.items);
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
        progressCallback(0.01);
        let files = Array.from(event.currentTarget.files);

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

    eventListeners: any = {};
    addEventListener = (type: string, listener: () => any) => {
        // this.eventListeners[type] = listener;
        this.eventListeners[type] ||= [];
        this.eventListeners[type].push(listener);
    }
}
