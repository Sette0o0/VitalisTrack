// Node-backed storage for exercising real exported bytes and SQL snapshots in Jest.
const fs = jest.requireActual("node:fs"), path = jest.requireActual("node:path"), os = jest.requireActual("node:os"), crypto = jest.requireActual("node:crypto");
const { DatabaseSync, backup } = jest.requireActual("node:sqlite");
export const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "vitalis-export-test-"));
const filePath = (uri: string) => uri.startsWith("file://") ? decodeURIComponent(new URL(uri).pathname) : uri;
const uriPath = (p: string) => "file://" + p;
class Entry {
    path: string;
    constructor(...parts: (string | Entry)[]) { this.path = path.join(...parts.map(p => p instanceof Entry ? p.path : filePath(p))); }
    get uri() { return uriPath(this.path); }
    get name() { return path.basename(this.path); }
    get exists() { return fs.existsSync(this.path); }
}
export class File extends Entry {
    get size() { return this.exists ? fs.statSync(this.path).size : 0; }
    get modificationTime() { return this.exists ? fs.statSync(this.path).mtimeMs : null; }
    get type() { return ({ ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" } as Record<string, string>)[path.extname(this.path)] ?? "application/octet-stream"; }
    create() { fs.closeSync(fs.openSync(this.path, "wx")); }
    write(data: Uint8Array | string) { fs.writeFileSync(this.path, data); }
    copy(target: File) { fs.copyFileSync(this.path, target.path); }
    move(target: File) { fs.renameSync(this.path, target.path); this.path = target.path; }
    delete() { fs.unlinkSync(this.path); }
    async text() { return fs.readFileSync(this.path, "utf8"); }
}
export class Directory extends Entry {
    create(options: {
        intermediates?: boolean;
        idempotent?: boolean;
    } = {}) { if (!this.exists || !options.idempotent)
        fs.mkdirSync(this.path, { recursive: !!options.intermediates }); }
    list() { return fs.readdirSync(this.path).map((name: string) => fs.statSync(path.join(this.path, name)).isDirectory() ? new Directory(this, name) : new File(this, name)); }
    delete() { fs.rmSync(this.path, { recursive: true }); }
}
export const Paths = { cache: new Directory(root, "cache"), document: new Directory(root, "files"), availableDiskSpace: 1024 * 1024 * 1024 };
Paths.cache.create();
Paths.document.create();
export const nativeFiles = {
    async info(uri: string) { const bytes: Buffer = fs.readFileSync(filePath(uri)); return { size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), headerHex: bytes.subarray(0, 16).toString("hex") }; },
    async appendText(uri: string, text: string) { fs.appendFileSync(filePath(uri), text); },
    async appendBase64(source: string, destination: string) { fs.appendFileSync(filePath(destination), fs.readFileSync(filePath(source)).toString("base64")); },
    async copyToUri(source: string, destination: string) { fs.copyFileSync(filePath(source), filePath(destination)); },
    async open() { },
};
const dbs = new Map<string, any>();
function open(name: string, directory = root): any {
    const filename = path.join(filePath(directory), name);
    if (dbs.has(filename))
        return dbs.get(filename);
    const native = new DatabaseSync(filename);
    const db = {
        native, filename,
        execAsync: async (sql: string) => native.exec(sql),
        runAsync: async (sql: string, ...params: unknown[]) => native.prepare(sql).run(...params),
        getFirstAsync: async (sql: string, ...params: unknown[]) => native.prepare(sql).get(...params),
        getAllAsync: async (sql: string, ...params: unknown[]) => native.prepare(sql).all(...params),
        withExclusiveTransactionAsync: async (fn: (tx: unknown) => Promise<unknown>) => { native.exec("BEGIN IMMEDIATE"); try {
            await fn(db);
            native.exec("COMMIT");
        }
        catch (e) {
            native.exec("ROLLBACK");
            throw e;
        } },
        closeAsync: async () => { native.close(); dbs.delete(filename); },
    };
    dbs.set(filename, db);
    return db;
}
export const sqlite = { openDatabaseAsync: async (name: string, _options?: unknown, directory?: string) => open(name, directory), backupDatabaseAsync: async ({ sourceDatabase, destDatabase }: any) => { await backup(sourceDatabase.native, destDatabase.filename); } };
export async function dispose() { for (const db of [...dbs.values()])
    await db.closeAsync(); fs.rmSync(root, { recursive: true, force: true }); }
