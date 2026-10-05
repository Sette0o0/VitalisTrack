import {
	brazilianDateInput, filterByDateRange, parseBrazilianDate,
	recentDateRange, validDateRange,
} from "./date-filter";

test("períodos incluem as duas extremidades e podem representar um dia", () => {
	const rows = ["2026-04-01", "2026-04-02", "2026-04-05", "2026-04-08", "2026-04-09"]
		.map((date) => ({ date }));
	expect(filterByDateRange(rows, { start: "2026-04-02", end: "2026-04-08" }))
		.toEqual(rows.slice(1, 4));
	expect(filterByDateRange(rows, { start: "2026-04-08", end: "2026-04-08" }))
		.toEqual([rows[3]]);
	expect(filterByDateRange(rows, null)).toEqual(rows);
	expect(filterByDateRange(rows, null)).not.toBe(rows);
});
test("intervalos invertidos ou datas inválidas não são aplicados", () => {
	for (const range of [
		{ start: "2026-04-09", end: "2026-04-08" },
		{ start: "2026-02-29", end: "2026-04-08" },
		{ start: "", end: "2026-04-08" },
	]) {
		expect(validDateRange(range)).toBe(false);
		expect(filterByDateRange([{ date: "2026-04-08" }], range)).toEqual([]);
	}
});
test("atalhos incluem hoje e atravessam mês, ano e ano bissexto", () => {
	expect(recentDateRange(1, "2026-10-03")).toEqual({ start: "2026-10-03", end: "2026-10-03" });
	expect(recentDateRange(7, "2026-01-03")).toEqual({ start: "2025-12-28", end: "2026-01-03" });
	expect(recentDateRange(7, "2024-03-01")).toEqual({ start: "2024-02-24", end: "2024-03-01" });
});
test("nascimento digitado recebe máscara e preserva a data real no formato ISO", () => {
	expect(brazilianDateInput("08042000")).toBe("08/04/2000");
	expect(brazilianDateInput("08/04/2000")).toBe("08/04/2000");
	expect(parseBrazilianDate("08/04/2000")).toBe("2000-04-08");
	expect(parseBrazilianDate("29/02/2000")).toBe("2000-02-29");
	expect(parseBrazilianDate("29/02/2001")).toBeNull();
	expect(parseBrazilianDate("31/04/2000")).toBeNull();
	expect(parseBrazilianDate("08/04/20")).toBeNull();
});
