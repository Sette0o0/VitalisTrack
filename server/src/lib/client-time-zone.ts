import type { FastifyRequest } from "fastify";
import { timeZoneSchema } from "@vitalis/contracts";
import { AppError } from "./errors.js";

export function isIanaTimeZone(value: unknown) {
	return typeof value === "string" && !/^[+-]/.test(value) && timeZoneSchema.safeParse(value).success;
}

export function clientTimeZone(request: FastifyRequest) {
	const value = request.headers["x-client-time-zone"];
	if (value === undefined) return "UTC";
	const parsed = timeZoneSchema.safeParse(value);
	if (!parsed.success || !isIanaTimeZone(value)) throw new AppError(400, "INVALID_TIME_ZONE", "Fuso horário inválido");
	return parsed.data;
}
