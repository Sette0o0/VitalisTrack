// Replace only the native filesystem bridge, retaining copy/size/cleanup behavior.
export function filesystemBridge() {
	const files = new Map<string, number>();
	const folders = new Set<string>();
	const uri = (...parts: (string | { uri: string })[]) => parts.map((p, i) => {
		const value = typeof p === "string" ? p : p.uri;
		return i ? value.replace(/^\/+|\/+$/g, "") : value.replace(/\/+$/g, "");
	}).join("/");
	class File {
		uri: string;
		constructor(...parts: (string | { uri: string })[]) { this.uri = uri(...parts); }
		get exists() { return files.has(this.uri); }
		get size() { return files.get(this.uri) ?? 0; }
		copy(target: File) { if (!this.exists) throw new Error("Arquivo ausente"); files.set(target.uri, this.size); }
		delete() { files.delete(this.uri); }
		create() { files.set(this.uri, 1); }
	}
	class Directory {
		uri: string;
		constructor(...parts: (string | { uri: string })[]) { this.uri = uri(...parts); }
		get exists() { return folders.has(this.uri); }
		create() { folders.add(this.uri); }
		list() { return [...files.keys()].filter((p) => p.startsWith(`${this.uri}/`)).map((p) => new File(p)); }
	}
	const reset = () => {
		files.clear(); folders.clear();
		files.set("file://picked.jpg", 100); files.set("file://second.jpg", 200);
	};
	reset();
	return { File, Directory, Paths: { document: "file:///documents" }, __reset: reset, __files: files };
}
