function channelToLinear(channel: number) {
	const value = channel / 255;
	return value <= 0.04045
		? value / 12.92
		: Math.pow((value + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string) {
	const normalized = hex.replace("#", "");
	if (!/^[0-9a-f]{6}$/i.test(normalized)) {
		throw new Error(`Cor hexadecimal inválida: ${hex}`);
	}
	const [red, green, blue] = [0, 2, 4].map((offset) =>
		Number.parseInt(normalized.slice(offset, offset + 2), 16),
	);
	return (
		0.2126 * channelToLinear(red) +
		0.7152 * channelToLinear(green) +
		0.0722 * channelToLinear(blue)
	);
}

export function contrastRatio(foreground: string, background: string) {
	const lighter = Math.max(
		relativeLuminance(foreground),
		relativeLuminance(background),
	);
	const darker = Math.min(
		relativeLuminance(foreground),
		relativeLuminance(background),
	);
	return (lighter + 0.05) / (darker + 0.05);
}
