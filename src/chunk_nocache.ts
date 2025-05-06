
type FileClientMeta = {
    path: string;
    size: number;
    type: string;
    lastModified: number;
};

const groupIntoRanges = (arr) => {
    if (arr.length === 0) return [];

    const ranges = [];
    let start = arr[0];
    let end = arr[0];

    for (let i = 1, len = arr.length; i < len; i++) {
        const n = arr[i];
        if (n === end || n === end + 1) {
            end = n;
        } else {
            ranges.push([start, end]);
            start = end = n;
        }
    }

    ranges.push([start, end]);
    return ranges;
};

export class ChunkManager {
    chunkId = 0;
    chunksMap = new Map<number, any>();

    chunkPromisesMaps: Map<string, Map<number, Promise<Buffer>>> = new Map();
    cacheHistory = new Map<number, any>();

    createChunkId = () => {
        return this.chunkId >= Number.MAX_SAFE_INTEGER ? 0 : this.chunkId++;
    }

    setData = (chunkId, data) => {
        this.chunksMap.get(chunkId)(data);
        this.chunksMap.delete(chunkId);

        this.cacheHistory.get(chunkId).resolved = true;
    }

    getChunk = async (file, chunkIndex) => {

        const promiseMap = this.chunkPromisesMaps.get(file.path);

        const chunkPromise = promiseMap?.get(chunkIndex)

        if (chunkPromise) {
            return chunkPromise
        }

        const chunkId = this.createChunkId();

        const promise = new Promise<Buffer<ArrayBufferLike>>((resolve, reject) => {
            this.chunksMap.set(chunkId, resolve);

            this.eventListeners["chunk"]?.forEach((listener) => listener({
                path: file.path,
                chunkId,
                chunkIndex
            }));
        })


        while (this.cacheHistory.size > 300) {
            for (const [key, value] of this.cacheHistory) {
                if (!value.resolved) {
                    continue
                }

                this.cacheHistory.delete(key);
                const chunkPromises = this.chunkPromisesMaps.get(value.path);
                chunkPromises?.delete(value.chunkIndex);
                if (chunkPromises?.size === 0) {
                    this.chunkPromisesMaps.delete(value.path)
                }

                break;
            }
        }

        if (promiseMap) {
            promiseMap.set(chunkIndex, promise);
        } else {
            this.chunkPromisesMaps.set(file.path, new Map([[chunkIndex, promise]]));
        }

        this.cacheHistory.set(chunkId, {
            path: file.path,
            chunkId,
            chunkIndex
        })

        return promise
    }


    read = async (file: FileClientMeta, rangeStart: number, rangeEnd: number) => {
        const CHUNK_SIZE = 2_000_000;
        const startChunk = Math.floor(rangeStart / CHUNK_SIZE);
        const endChunk = Math.ceil((rangeEnd) / CHUNK_SIZE);

        const chunksPromises: Promise<Buffer>[] = [];

        for (let index = startChunk; index <= endChunk; index++) {
            chunksPromises.push(this.getChunk(file, index));
        }

        const buffers = Buffer.concat(await Promise.all(chunksPromises));
        const offsetStart = rangeStart - (startChunk * CHUNK_SIZE);
        const offsetEnd = offsetStart + (rangeEnd - rangeStart);

        return buffers.subarray(offsetStart, offsetEnd + 1);
    };

    eventListeners = {};
    addEventListener = (type, listener, options) => {
        this.eventListeners[type] ||= [];
        this.eventListeners[type].push(listener);
    }

    removeEventListener = (type, listener, options) => {
        if (!this.eventListeners[type]) return;
        this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
    };
}