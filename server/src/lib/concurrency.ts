export function createLimiter(maximum: number) {
	let active = 0;
	const waiting: Array<() => void> = [];
	return async <T>(work: () => Promise<T>): Promise<T> => {
		if (active >= maximum)
			await new Promise<void>((resolve) => waiting.push(resolve));
		else active++;
		try {
			return await work();
		} finally {
			const next = waiting.shift();
			if (next) next();
			else active--;
		}
	};
}
