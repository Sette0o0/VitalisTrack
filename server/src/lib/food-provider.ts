import { foodProductSchema, type FoodProduct } from "@vitalis/contracts";
import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
const base = process.env.OFF_BASE_URL ?? "https://world.openfoodfacts.org";
const userAgent =
	process.env.OFF_USER_AGENT ?? "VitalisTrack/1.0 (https://github.com/Sette0o0/VitalisTrack)";
const fields =
	"code,product_name,brands,nutriments,nutrition_data_per,quantity,product_quantity_unit";
const windows = { search: [] as number[], product: [] as number[] };
const flights = new Map<string, Promise<FoodProduct[]>>();
export function normalizeFood(p: Record<string, unknown>): FoodProduct | null {
	const n = (p.nutriments ?? {}) as Record<string, unknown>;
	const value = (key: string) =>
		typeof n[key] === "number" && Number.isFinite(n[key]) && (n[key] as number) >= 0
			? (n[key] as number)
			: null;
	if (
		typeof p.code !== "string" ||
		!/^\d{8,14}$/.test(p.code) ||
		typeof p.product_name !== "string" ||
		!p.product_name.trim()
	)
		return null;
	// OFF's _100g keys also represent 100 mL for liquids. Infer only from explicit quantity units.
	const u =
		typeof p.product_quantity_unit === "string" ? p.product_quantity_unit.toLowerCase() : "";
	const q = typeof p.quantity === "string" ? p.quantity.toLowerCase() : "";
	const basisUnit =
		["ml", "l", "cl"].includes(u) || /\b\d+(?:[.,]\d+)?\s*(ml|cl|l)\b/.test(q)
			? "mL"
			: ["g", "kg"].includes(u) || /\b\d+(?:[.,]\d+)?\s*(g|kg)\b/.test(q)
				? "g"
				: null;
	const kcal = value("energy-kcal_100g");
	const kj = value("energy-kj_100g");
	const normalized = foodProductSchema.safeParse({
		code: p.code,
		name: p.product_name,
		brand: typeof p.brands === "string" ? p.brands : null,
		basisUnit,
		values: {
			calories: kcal ?? (kj == null ? null : kj / 4.184),
			proteins: value("proteins_100g"),
			carbohydrates: value("carbohydrates_100g"),
			fat: value("fat_100g"),
		},
		source: "openfoodfacts",
		fetchedAt: new Date().toISOString(),
	});
	return normalized.success ? normalized.data : null;
}
export async function foods(kind: "search" | "product", term: string): Promise<FoodProduct[]> {
	const key = `off:${kind}:${term.toLowerCase()}`;
	const cached = await prisma.foodCache.findUnique({ where: { key } });
	if (cached && cached.expiresAt > new Date()) return cached.value as unknown as FoodProduct[];
	const flight = flights.get(key);
	if (flight) return flight;
	const request = (async () => {
		const now = Date.now();
		windows[kind] = windows[kind].filter((t) => t > now - 60000);
		if (windows[kind].length >= (kind === "search" ? 10 : 15))
			throw new AppError(
				429,
				"FOOD_RATE_LIMIT",
				"Limite de consultas atingido. Tente novamente em um minuto.",
			);
		windows[kind].push(now);
		const url = new URL(
			kind === "product" ? `/api/v3/product/${encodeURIComponent(term)}.json` : "/cgi/search.pl",
			base,
		);
		url.searchParams.set("fields", fields);
		if (kind === "search")
			for (const [k, v] of Object.entries({
				search_terms: term,
				search_simple: "1",
				action: "process",
				json: "1",
				page_size: "20",
			}))
				url.searchParams.set(k, v);
		let response: Response;
		try {
			response = await fetch(url, {
				headers: { "User-Agent": userAgent },
				signal: AbortSignal.timeout(1800),
			});
		} catch {
			throw new AppError(
				503,
				"FOOD_UNAVAILABLE",
				"Catálogo indisponível. Consulte os alimentos salvos ou registre manualmente.",
			);
		}
		if (!response.ok && response.status !== 404)
			throw new AppError(
				response.status === 429 ? 429 : 503,
				"FOOD_UNAVAILABLE",
				"Catálogo temporariamente indisponível.",
			);

		let data: { product?: Record<string, unknown>; products?: Record<string, unknown>[] };
		try {
			const parsed: unknown = response.status === 404 ? {} : await response.json();
			if (!parsed || typeof parsed !== "object") throw new Error("Formato inválido");
			data = parsed;
		} catch {
			throw new AppError(503, "FOOD_UNAVAILABLE", "Catálogo temporariamente indisponível.");
		}
		const candidates =
			kind === "product"
				? data.product
					? [data.product]
					: []
				: Array.isArray(data.products)
					? data.products
					: [];
		const rows = candidates
			.filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
			.map(normalizeFood)
			.filter((p): p is FoodProduct => p !== null);

		await prisma.foodCache.upsert({
			where: { key },
			create: { key, value: rows, expiresAt: new Date(now + (rows.length ? 86400000 : 300000)) },
			update: { value: rows, expiresAt: new Date(now + (rows.length ? 86400000 : 300000)) },
		});
		return rows;
	})().finally(() => flights.delete(key));
	flights.set(key, request);
	return request;
}
