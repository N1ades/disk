export class ChunkManager {
    chunkId = 0;
    chunksMap = new Map<number, any>();

    createChunk = (cb) => {
        const chunkId = this.chunkId >= Number.MAX_SAFE_INTEGER ? 0 : this.chunkId++;
        this.chunksMap.set(chunkId, cb);
        return { chunkId };
    }

    setData = (chunkId, data) => {
        this.chunksMap.get(chunkId)(data);
        this.chunksMap.delete(chunkId);
    }


    read = (path: string, rangeStart: number, rangeEnd: number) => {
        return new Promise<void>((resolve, reject) => {
            const { chunkId } = this.createChunk(resolve);
            this.eventListeners["chunk"]?.forEach((listener) => listener({
                path,
                chunkId,
                rangeStart,
                rangeEnd
            }));
        })
    }

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