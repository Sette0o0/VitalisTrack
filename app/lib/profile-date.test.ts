import { birthDateError, calendarDate, createProfileUpdateSchema, timeZoneSchema } from "@vitalis/contracts";
afterEach(() => jest.useRealTimers());
test.each([
 ["2026-10-04T00:30:00Z", "America/Sao_Paulo", "2026-10-03"],
 ["2026-10-04T03:00:00Z", "America/Sao_Paulo", "2026-10-04"],
 ["2026-10-04T00:30:00Z", "Asia/Tokyo", "2026-10-04"],
 ["2026-10-04T10:30:00Z", "Pacific/Kiritimati", "2026-10-05"],
 ["2026-10-04T00:30:00Z", "UTC", "2026-10-04"],
])("dia civil em %s / %s", (instant, zone, date) => {
 jest.useFakeTimers(); jest.setSystemTime(new Date(instant));
 expect(calendarDate(zone)).toBe(date);
 expect(createProfileUpdateSchema(zone).safeParse({ birthDate: date }).success).toBe(true);
 const tomorrow = new Date(`${date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
 expect(createProfileUpdateSchema(zone).safeParse({ birthDate: tomorrow.toISOString().slice(0,10) }).success).toBe(false);
});
test("data impossível, bissexto e atualização da referência na mesma instância", () => {
 jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-04T00:30:00Z"));
 const schema = createProfileUpdateSchema("America/Sao_Paulo");
 expect(schema.safeParse({ birthDate: "2026-10-04" }).success).toBe(false);
 jest.setSystemTime(new Date("2026-10-04T03:00:00Z"));
 expect(schema.safeParse({ birthDate: "2026-10-04" }).success).toBe(true);
 expect(birthDateError("2000-02-29")).toBeUndefined();
 expect(birthDateError("2001-02-29")).toContain("válida");
 expect(timeZoneSchema.safeParse("Fuso/Inexistente").success).toBe(false);
});
