import { act, renderHook } from "@testing-library/react-native";
import { useSubmit } from "./use-submit";
test("bloqueia envio duplo e mostra erro recuperável", async () => {
	const { result } = renderHook(useSubmit);
	let release: () => void = () => {};
	const action = jest.fn(
		() =>
			new Promise<void>((resolve) => {
				release = resolve;
			}),
	);
	let request: Promise<void>;
	await act(async () => {
		request = result.current.submit(action);
		await result.current.submit(action);
	});
	expect(action).toHaveBeenCalledTimes(1);
	expect(result.current.saving).toBe(true);
	await act(async () => {
		release();
		await request;
	});
	expect(result.current.saving).toBe(false);
	await act(async () =>
		result.current.submit(async () => {
			throw new Error("Disco cheio");
		}),
	);
	expect(result.current.error).toBe("Disco cheio");
	await act(async () => result.current.submit(async () => {}));
	expect(result.current.error).toBe("");
});
