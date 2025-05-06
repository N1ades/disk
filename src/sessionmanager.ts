import { codeSecret, TransferManager } from "./transfermanager.ts";

// управление сессиями трансфера файлов пользователей
export class SessionManager {
    transferManagers = new Map();

    constructor() {

    }


    getTransferManager(sessionSecret): TransferManager {
        if (!this.transferManagers.has(sessionSecret)) {
            this.transferManagers.set(sessionSecret, new TransferManager(sessionSecret))
        }

        return this.transferManagers.get(sessionSecret);
    }

    getTransferManagerByCode(code): TransferManager {
        const sessionSecret = codeSecret.get(code);

        return this.transferManagers.get(sessionSecret);
    }



}