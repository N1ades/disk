import { nanoid } from "nanoid";
import { db } from "./db.ts";
import { FileManager } from "./filemanager.ts";
import { ChunkManager } from "./chunk.ts";
import WebSocket from "ws";

export const codeSecret = db.collection('secretByCode');
const secretCode = db.collection('codeBySecret');

// управление трансфером файлов и файлами пользователя
export class TransferManager {

    // уникальный приватный ключ сессии виден только отправляющему
    sessionSecret: string;

    // код сессии трансфера для получения файлов, используется в ссылках на файлы
    code: string;

    fileManager: FileManager;
    chunkManager: ChunkManager;

    constructor(sessionSecret: string) {
        const existsCode = sessionSecret && secretCode.get(sessionSecret);
        const secret = (existsCode && sessionSecret) ?? nanoid();
        const code = existsCode ?? nanoid();

        if (!existsCode) {
            console.log('codeSecret.set', code, secret);
            
            codeSecret.set(code, secret);
            secretCode.set(secret, code);
        }
        
        this.code = code;
        this.sessionSecret = secret;
        this.fileManager = new FileManager();
        this.chunkManager = new ChunkManager();
    }

    
}