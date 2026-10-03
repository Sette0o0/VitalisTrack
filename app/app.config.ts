import type { ConfigContext, ExpoConfig } from "expo/config";
import { AndroidConfig, withAndroidManifest } from "expo/config-plugins";
export default ({ config }: ConfigContext): ExpoConfig =>
	withAndroidManifest(
		{
			...config,
			name: config.name ?? "VitalisTrack",
			slug: config.slug ?? "vitalis-track",
			extra: {
				...config.extra,
				mapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
			},
			android: {
				...config.android,
				config: {
					...config.android?.config,
					...(process.env.GOOGLE_MAPS_API_KEY
						? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } }
						: {}),
				},
			},
		},
		(mod) => {
			const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
				mod.modResults,
			);
			// Local QA uses the emulator host bridge; production builds keep HTTPS enforced.
			application.$["android:usesCleartextTraffic"] =
				process.env.ANDROID_QA === "true" ? "true" : "false";
			return mod;
		},
	);
