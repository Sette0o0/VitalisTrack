import type { FoodProduct } from "@vitalis/contracts";
import { getValue, setValue } from "./local-database";
let writes: Promise<void> = Promise.resolve();
export async function savedFoods(): Promise<FoodProduct[]> {
	const value = await getValue("food-cache", null, null);
	return value ? JSON.parse(value) : [];
}
export function cacheFoods(products: FoodProduct[]) {
	const operation = writes.then(async () => {
		const old = await savedFoods();
		const rows = [...new Map([...old, ...products].map((p) => [p.code, p])).values()].slice(-500);
		await setValue("food-cache", JSON.stringify(rows), null, null);
	});
	writes = operation.catch(() => {});
	return operation;
}
