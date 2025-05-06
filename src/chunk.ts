
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
        const endChunk = Math.floor(rangeEnd / CHUNK_SIZE); // use floor here to exclude extra chunk

        const chunksPromises: Promise<Buffer>[] = [];

        for (let index = startChunk; index <= endChunk; index++) {
            chunksPromises.push(this.getChunk(file, index));
        }

        const chunks = await Promise.all(chunksPromises);
        const result: Buffer[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const isFirst = i === 0;
            const isLast = i === chunks.length - 1;

            let chunk = chunks[i];

            if (isFirst) {
                const offset = rangeStart % CHUNK_SIZE;
                chunk = chunk.subarray(offset);
            }

            if (isLast) {
                const length = (rangeEnd % CHUNK_SIZE) + 1;
                chunk = chunk.subarray(0, length);
            }

            result.push(chunk);
        }

        return result; // array of Buffers
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