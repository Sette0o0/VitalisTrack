import { userError, UserFacingError, RequestFailure } from "./user-error";
test.each(["java.net.ConnectException http://127.0.0.1:3011 secret", "SQLITE_FULL /home/private", "fetch failed", "TypeError at token=secret"])("não revela detalhes técnicos: %s", message => {
 expect(userError(new Error(message))).toBe("Não foi possível salvar. Tente novamente.");
 expect(userError(new Error(message),"sync")).toContain("alterações salvas neste aparelho");
});
test("só preserva validação explicitamente segura e diferencia falhas", () => {
 expect(userError(new UserFacingError("Finalize ou descarte o treino."))).toBe("Finalize ou descarte o treino.");
 expect(userError(new RequestFailure("network"))).toContain("conectar");
 expect(userError(new RequestFailure("timeout"))).toContain("demorou");
 expect(userError(new RequestFailure("cancelled"))).toBe("Operação cancelada.");
 expect(userError(new RequestFailure("response"))).toContain("interpretar");
 expect(userError({status:401,message:"internal"})).toContain("sessão expirou");
 expect(userError({status:503,message:"internal"})).toContain("indisponível");
 expect(userError({status:400,message:"java secret"})).toContain("Revise os dados");
 expect(userError({status:401,code:"INVALID_CREDENTIALS",message:"secret"})).toBe("E-mail ou senha inválidos.");
 expect(userError(undefined,"load")).toContain("carregar");
});

test("códigos desconhecidos não expõem mensagens do servidor nem propriedades herdadas", () => {
 expect(userError({status:400,code:"constructor",message:"secret"})).toBe("Revise os dados informados e tente novamente.");
});
