import { decimalInput, formatDate, formatNumber } from "./format";
import { parseDecimal } from "./validation";

test("datas brasileiras preservam o dia, inclusive ano bissexto", () => {
	expect(formatDate("2026-04-08")).toBe("08/04/2026");
	expect(formatDate("2024-02-29")).toBe("29/02/2024");
	expect(formatDate("2026-02-29")).toBe("Data inválida");
	expect(formatDate("2026-04-31")).toBe("Data inválida");
	expect(formatDate("")).toBe("Não informada");
});
test("números usam milhares com ponto e decimal com vírgula", () => {
	expect(formatNumber(1234.5)).toBe("1.234,5");
	expect(formatNumber(70, 1)).toBe("70,0");
	expect(formatNumber(1.75, 2)).toBe("1,75");
	expect(formatNumber(-0.75, 1)).toBe("-0,8");
	expect(formatNumber(1234.56, 0)).toBe("1.235");
	expect(formatNumber(NaN)).toBe("—");
});
test("inteiros não pedem casas extras ao ICU antigo do Android", () => {
	const format = jest.spyOn(Number.prototype, "toLocaleString");
	expect(formatNumber(2000)).toBe("2.000");
	expect(format).toHaveBeenLastCalledWith("pt-BR", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
	expect(formatNumber(0.0000001)).toBe("0,0000001");
	expect(formatNumber(1234.56789)).toBe("1.234,56789");
	format.mockRestore();
});
test.each([70.5, 1.234, 1000.5, 1234.56789, 0])(
	"reabrir um campo brasileiro não arredonda nem altera %s",
	(value) => {
		expect(decimalInput(value)).not.toContain(".");
		expect(parseDecimal(decimalInput(value))).toBe(value);
	},
);
