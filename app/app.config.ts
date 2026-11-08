import type { ConfigContext, ExpoConfig } from "expo/config";
import withFontScale from "./plugins/with-font-scale.cjs";
import { AndroidConfig, withAndroidManifest, withMainActivity } from "expo/config-plugins";

export default ({ config }: ConfigContext): ExpoConfig =>
	withFontScale(withMainActivity(
		withAndroidManifest(
			{
				...config,
				name: config.name ?? "VitalisTrack",
				slug: config.slug ?? "vitalis-track",
			},
			(mod) => {
				const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
				// Local QA uses the host bridge; production keeps HTTPS enforced.
				application.$["android:usesCleartextTraffic"] =
					process.env.ANDROID_QA === "true" ? "true" : "false";
				const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
				activity.$["android:configChanges"] = [...new Set([
					...(activity.$["android:configChanges"] ?? "").split("|").filter(Boolean),
					"fontScale",
				])].join("|");
				return mod;
			},
		),
		(mod) => {
			if (mod.modResults.language !== "kt")
				throw new Error("A atualização de fonte requer MainActivity Kotlin.");
			const marker = "// vitalis-font-scale-layout";
			if (!mod.modResults.contents.includes(marker)) {
				const end = mod.modResults.contents.lastIndexOf("}");
				if (end < 0) throw new Error("MainActivity inválida.");
				mod.modResults.contents = mod.modResults.contents.slice(0, end) + `
  ${marker}
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    // RN 0.81 updates Fabric's font multiplier during root measurement.
    // Same-sized windows otherwise retain measurements from the old scale.
    val content = findViewById<android.view.ViewGroup>(android.R.id.content)
    fun invalidateMeasurements(view: android.view.View) {
      view.forceLayout()
      if (view is android.view.ViewGroup) {
        for (index in 0 until view.childCount) invalidateMeasurements(view.getChildAt(index))
      }
    }
    content?.post {
      invalidateMeasurements(content)
      content.requestLayout()
    }
  }
` + mod.modResults.contents.slice(end);
			}
			return mod;
		},
	));
