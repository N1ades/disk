import { nanoid } from "nanoid";
import { db } from "./db";
import { FileManager } from "./filemanager";

const codeSecret = db.collection('secretByCode');
const secretCode = db.collection('codeBySecret');

// управление трансфером файлов и файлами пользователя
export class TransferManager {

    // уникальный приватный ключ сессии виден только отправляющему
    sessionSecret: string;

    // код сессии трансфера для получения файлов, используется в ссылках на файлы
    code: string;

    fileManager: FileManager;


    constructor(sessionSecret: string) {
        const existsCode = sessionSecret && secretCode.get(sessionSecret);
        const secret = (existsCode && sessionSecret) ?? nanoid();
        const code = existsCode ?? nanoid();

        if (!existsCode) {
            codeSecret.set(code, secret);
            secretCode.set(secret, code);
        }

        this.sessionSecret = secret;
        this.fileManager = new FileManager();
    }




    // addFiles(files){

    //     // const existsFiles = files.get(this.sessionSecret) || [];

    //     // new Map()

    //     // files.set(this.sessionSecret), ;
    // }





}