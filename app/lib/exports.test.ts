jest.mock("./session", () => ({ sessionRevision: () => 0, loadTokens: async () => ({ accessToken: "fixture" }), tokenClaims: () => ({ sub: "00000000-0000-4000-8000-000000000001" }) }));
import { File, Paths, nativeFiles, dispose } from "@/testing/export-io";
import { exportAccountBackup, exportCsv, exportPdf } from "./exports";
import { initDatabase, getDatabase, saveState, rememberProfiles, setValue } from "./local-database";
import { initialState } from "@/state/reducer";
import { saveWellbeing } from "./wellbeing-store";
import { saveDocument, findDocument, deleteDocument, receiveDocuments } from "./document-store";
import { importDocument, ensureDocumentFile, pruneDocumentFiles } from "./document-files";
import { backupSchema, buildHealthReport } from "@vitalis/contracts";
import { apiResponse } from "./api";
import { fileTools, saveFileAs, shareFile, cleanTemporaryExports, exportDirectory } from "./file-tools";
import * as Sharing from "expo-sharing";
import { StorageAccessFramework } from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import type { AppState } from "@/state/types";
jest.mock("expo-sqlite", () => jest.requireActual("@/testing/export-io").sqlite);
jest.mock("expo-file-system", () => jest.requireActual("@/testing/export-io"));
jest.mock("expo", () => ({ requireOptionalNativeModule: jest.fn(() => jest.requireActual("@/testing/export-io").nativeFiles) }));
jest.mock("expo-print", () => ({ printToFileAsync: jest.fn(async () => { const io = jest.requireActual("@/testing/export-io"), file = new io.File(io.Paths.cache, "printed.pdf"); file.write("%PDF-1.7 fixture"); return { uri: file.uri }; }) }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({ StorageAccessFramework: { requestDirectoryPermissionsAsync: jest.fn(async () => ({ granted: false })), createFileAsync: jest.fn() } }));
jest.mock("./sync-engine", () => ({ synchronizeAccount: jest.fn() }));
jest.mock("./api", () => ({ apiRequest: jest.fn(), apiResponse: jest.fn() }));
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { fetch: jest.fn(async () => ({ isConnected: false })) } }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), profile = id(2);
const state = (profileId = owner): AppState => ({ ...initialState, userId: owner, profileId, authenticated: true, meals: [{ id: id(10), name: '=SUM(1,2),"QA"', date: "2026-11-08", time: "12:00", quantity: 20, unit: "g", calories: 50 }], activities: [{ id: id(11), date: "2026-11-08", type: "walk", durationMinutes: 10, distanceKm: 1, calories: 100, route: [{ latitude: 1, longitude: 2, timestamp: "2026-11-08T12:00:00Z" }] }] });
beforeEach(async () => {
    jest.clearAllMocks();
    await initDatabase();
    const db = await getDatabase();
    await db.execAsync("DELETE FROM kv;DELETE FROM health_records;DELETE FROM wellbeing_records;DELETE FROM medical_documents;DELETE FROM outbox_v2;");
    Paths.availableDiskSpace = 1024 * 1024 * 1024;
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
    await rememberProfiles(owner, [{ id: owner, name: "Principal", isPrimary: true, updatedAt: new Date().toISOString() }, { id: profile, name: "Familiar", isPrimary: false, updatedAt: new Date().toISOString() }]);
    for (const p of [owner, profile]) {
        await saveState(state(p));
        await setValue("documents-cursor", "0", owner, p);
        await setValue("wellbeing-cursor", "0", owner, p);
    }
    await setValue("account-sync-complete", "yes", owner, owner);
    await setValue("backup-friendships", "[]", owner, owner);
});
afterAll(async () => { await dispose(); });
test("full offline JSON contains two profiles, routes, wellbeing, photo/document bytes and valid hashes without credentials", async () => {
    const photo = new File(Paths.document, "avatar.png");
    photo.write(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]));
    await saveState({ ...state(), profile: { ...state().profile, avatar: photo.uri, avatarRemoteUrl: "http://private/SECRET" } });
    await saveWellbeing(owner, profile, { id: id(20), kind: "sleep", data: { date: "2026-11-08", durationMinutes: 480 } });
    const source = new File(Paths.cache, "fixture.pdf");
    source.write("%PDF-1.7\nfixture\n%%EOF");
    const info = await nativeFiles.info(source.uri);
    const document = { id: id(21), profileId: profile, name: "QA.pdf", mimeType: "application/pdf" as const, size: info.size, sha256: info.sha256, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null, revision: "1" };
    await saveDocument(owner, profile, document, source.uri);
    const uri = await exportAccountBackup(owner), text = await new File(uri).text(), backup = backupSchema.parse(JSON.parse(text));
    expect(backup.profiles).toHaveLength(2);
    expect(backup.profiles[0].activities[0]).toMatchObject({ durationSeconds: 600, distanceMeters: 1000, route: [{ latitude: 1, longitude: 2, timestamp: expect.any(String) }] });
    expect(backup.profiles[1].wellbeing).toHaveLength(1);
    expect(backup.blobs).toHaveLength(2);
    expect(backup.profiles[1].documents[0].id).toBe(document.id);
    const crypto = jest.requireActual("node:crypto");
    for (const blob of backup.blobs) {
        const bytes = Buffer.from(blob.base64, "base64");
        expect(bytes.length).toBe(blob.size);
        expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(blob.sha256);
    }
    expect(text).not.toMatch(/SECRET|accessToken|refreshToken|password|localUri|authenticated/);
});
test("missing account completeness or unavailable attachment blocks publication and releases the export lock", async () => {
    await setValue("account-sync-complete", "", owner, owner);
    await expect(exportAccountBackup(owner)).rejects.toThrow("primeira cópia");
    await setValue("account-sync-complete", "yes", owner, owner);
    const info = { id: id(30), profileId: owner, name: "missing.pdf", mimeType: "application/pdf" as const, size: 20, sha256: "a".repeat(64), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null, revision: "0" };
    await saveDocument(owner, owner, info, "file:///missing.pdf");
    (apiResponse as jest.Mock).mockRejectedValue(new Error("offline"));
    await expect(exportAccountBackup(owner)).rejects.toThrow("offline");
    await deleteDocument(owner, owner, id(30));
    expect(await exportAccountBackup(owner)).toMatch(/\.json$/);
});
test("native validation/import, cached files and corrupted downloads", async () => {
    const source = new File(Paths.cache, "picked.pdf");
    source.write("%PDF-1.7\nfixture");
    const created = await importDocument(owner, owner, { uri: source.uri, name: "picked.pdf", mimeType: "application/pdf" });
    const local = (await findDocument(owner, owner, created.id))!;
    expect(await ensureDocumentFile(owner, owner, local)).toBe(local.localUri);
    await expect(importDocument(owner, owner, { uri: source.uri, name: "bad.png", mimeType: "image/png" })).rejects.toThrow("conteúdo");
    await expect(importDocument(owner, owner, { uri: source.uri, name: "x", mimeType: "text/html" })).rejects.toThrow("Escolha");
    await expect(importDocument(owner, owner, { uri: source.uri, name: "x", mimeType: "application/pdf", size: 20 * 1024 * 1024 })).rejects.toThrow("10 MiB");
    const remote = { ...local, id: id(40), localUri: null };
    (apiResponse as jest.Mock).mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    await expect(ensureDocumentFile(owner, owner, remote)).rejects.toThrow("íntegro");
});
test("CSV writes real escaped UTF8 bytes, PDF creates the returned private file; share/save cancellation are handled", async () => {
    const uri = await exportCsv(owner, owner), text = await new File(uri).text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"\'=SUM(1,2),""QA"""');
    expect(text).toContain('"600","1000"');
    const report = buildHealthReport({ water: [], meals: [], activities: [], weights: [], steps: [] }, "day", "2026-11-08", state().goals);
    expect(await exportPdf(report, state())).toMatch(/\.pdf$/);
    expect(await saveFileAs(uri, "QA.csv", "text/csv")).toBe(false);
    await shareFile(uri, "text/csv");
    expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: "text/csv" }));
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await expect(shareFile(uri, "text/csv")).rejects.toThrow("Não há aplicativo");
    expect(fileTools()).toBe(nativeFiles);
    expect(StorageAccessFramework.requestDirectoryPermissionsAsync).toHaveBeenCalled();
    cleanTemporaryExports();
    expect(exportDirectory().exists).toBe(true);
});
test("deleted attachment bytes are retained while their mutations are pending", async () => {
    const file = new File(Paths.cache, "retain.pdf");
    file.write("%PDF-fixture");
    const info = await nativeFiles.info(file.uri);
    await saveDocument(owner, owner, { id: id(50), profileId: owner, name: "retain.pdf", mimeType: "application/pdf", size: info.size, sha256: info.sha256, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null, revision: "0" }, file.uri);
    await deleteDocument(owner, owner, id(50));
    await pruneDocumentFiles(owner);
    expect(file.exists).toBe(true);
    await (await getDatabase()).runAsync("DELETE FROM outbox_v2 WHERE user_id=?", owner);
    await pruneDocumentFiles(owner);
    expect(file.exists).toBe(false);
});

test("successful private download remains on disk and is reused offline",async()=>{
 const bytes=Uint8Array.from([37,80,68,70,45,49,46,55,10]);
 const crypto=jest.requireActual("node:crypto"),sha256=crypto.createHash("sha256").update(bytes).digest("hex");
 const record={id:id(70),profileId:owner,name:"download.pdf",mimeType:"application/pdf" as const,size:bytes.length,sha256,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),deletedAt:null,revision:"1"};
 await receiveDocuments(owner,owner,{records:[record],cursor:"1",hasMore:false});
 (apiResponse as jest.Mock).mockResolvedValue({arrayBuffer:async()=>bytes.buffer});
 const uri=await ensureDocumentFile(owner,owner,(await findDocument(owner,owner,record.id))!);
 expect(new File(uri).exists).toBe(true);
 expect(await ensureDocumentFile(owner,owner,(await findDocument(owner,owner,record.id))!)).toBe(uri);
 expect(apiResponse).toHaveBeenCalledTimes(1);
});

test("a profile created during backup preparation prevents publishing an incomplete account", async () => {
 const db=await getDatabase();
 const row=await db.getFirstAsync<{value:string}>("SELECT value FROM kv WHERE key=?",owner+":profiles");
 const profiles=JSON.parse(row!.value);profiles.push({id:id(90),name:"New profile",isPrimary:false,updatedAt:new Date().toISOString()});
 let changed=false;
 await expect(exportAccountBackup(owner,(label)=>{
  if(label==="Preparando uma cópia consistente…"){
   changed=true;
   // The Node-backed adapter performs this statement synchronously before returning its Promise.
   void db.runAsync("UPDATE kv SET value=? WHERE key=?",JSON.stringify(profiles),owner+":profiles");
  }
 })).rejects.toThrow("perfis foram alterados");
 expect(changed).toBe(true);
});
