import { Avatar } from "react-native-paper";
import { Image } from "expo-image";
import { API_URL } from "@/lib/api";
import type { Profile } from "@/state/types";
export function ProfileAvatar({
	profile,
	size = 72,
}: {
	profile: Profile;
	size?: number;
}) {
	const uri = profile.avatar?.startsWith("/")
		? `${API_URL}${profile.avatar}`
		: profile.avatar;
	return uri ? (
		<Avatar.Image
			size={size}
			accessibilityLabel="Foto de perfil"
			source={({ size }) => (
				<Image
					source={{ uri }}
					cachePolicy="disk"
					style={{ width: size, height: size, borderRadius: size / 2 }}
				/>
			)}
		/>
	) : (
		<Avatar.Text
			size={size}
			label={
				profile.name
					.split(" ")
					.filter(Boolean)
					.map((x) => x[0])
					.slice(0, 2)
					.join("") || "?"
			}
		/>
	);
}
