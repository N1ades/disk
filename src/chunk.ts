


export class ChunkManager {
    chunkId = 0;
    chunksMap = new Map<number, any>();

    createChunk = (cb) => {
        const chunkId = this.chunkId >= Number.MAX_SAFE_INTEGER ? 0 : this.chunkId++;
        this.chunksMap.set(chunkId, cb);
        // console.log('createChunk', chunkId);
        return { chunkId };
    }

    setData = (chunkId, data) => {
        // console.log('setData', chunkId);

        this.chunksMap.get(chunkId)(data);
        this.chunksMap.delete(chunkId);
    }
}