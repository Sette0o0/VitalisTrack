// Only explicitly authored UI messages are safe to present verbatim.
export class UserFacingError extends Error {}

export class RequestFailure extends Error {
	constructor(public kind: "network" | "timeout" | "cancelled" | "response") {
		super(kind);
	}
}

const messages: Record<string, string> = {
 INVALID_FILE_TYPE:"Escolha um arquivo PDF, JPEG, PNG ou WebP válido.",
 FILE_TOO_LARGE:"O arquivo excede o limite permitido. Confira o tamanho e tente novamente.",
 FILE_UNAVAILABLE:"O arquivo está indisponível. Conecte e tente baixá-lo novamente.",
 ACTIVE_FASTING:"Já existe um jejum ativo neste perfil.",
 INVALID_INVITE:"Convite inválido, expirado ou já utilizado.",
 INVALID_REFERENCE:"Uma associação está indisponível. Confira os registros escolhidos.",
	INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
	EMAIL_IN_USE: "Este e-mail já está cadastrado.",
	FOOD_UNAVAILABLE: "Catálogo temporariamente indisponível. Tente novamente mais tarde.",
	FOOD_RATE_LIMIT: "Muitas consultas ao catálogo. Aguarde e tente novamente.",
	STALE_SESSION: "A sessão foi alterada. Entre novamente.",
};

export function userError(error: unknown, context: "save" | "sync" | "load" = "save") {
	if (error instanceof UserFacingError) return error.message;
	if (error instanceof RequestFailure) {
		if (error.kind === "timeout") return "O servidor demorou para responder. Tente novamente.";
		if (error.kind === "cancelled") return "Operação cancelada.";
		if (error.kind === "response")
			return "Não foi possível interpretar a resposta do servidor. Tente novamente.";
		return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
	}
	const api = error as { status?: number; code?: string } | null;
	if (api?.code && Object.hasOwn(messages, api.code)) return messages[api.code];
	if (api?.status === 401)
		return "Sua sessão expirou. Entre com e-mail e senha para continuar.";
	if (api?.status === 403) return "Você não tem permissão para realizar esta operação.";
	if (api?.status === 404) return "Registro não encontrado.";
	if (api?.status === 429) return "Muitas tentativas. Aguarde e tente novamente.";
	if (api?.status && api.status >= 500)
		return "O servidor está indisponível. Tente novamente mais tarde.";
	if (api?.status === 400 || api?.status === 422)
		return "Revise os dados informados e tente novamente.";
	if (context === "sync")
		return "Não foi possível sincronizar. As alterações salvas neste aparelho aguardam uma nova tentativa.";
	if (context === "load")
		return "Não foi possível carregar os dados. Feche e abra o aplicativo para tentar novamente.";
	return "Não foi possível salvar. Tente novamente.";
}
