import type { ConfigContext, ExpoConfig } from "expo/config";
import { AndroidConfig, withAndroidManifest } from "expo/config-plugins";
export default ({ config }: ConfigContext): ExpoConfig =>
	withAndroidManifest(
		{
			...config,
			name: config.name ?? "VitalisTrack",
			slug: config.slug ?? "vitalis-track",
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
