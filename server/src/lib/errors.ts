export class AppError extends Error {
	constructor(
		public readonly statusCode: number,
		public readonly code: string,
		message: string,
		public readonly details?: unknown,
	) {
		super(message);
	}
}

export const notFound = (message = "Registro não encontrado") =>
	new AppError(404, "NOT_FOUND", message);
export const forbidden = () => new AppError(403, "FORBIDDEN", "Acesso negado");
