// RN 0.81.5 exposes this typed startup hook as Kotlin-internal. Keep the
// version guard in the config plugin when upgrading React Native.
@file:Suppress("INVISIBLE_MEMBER", "INVISIBLE_REFERENCE")

package com.vitalistrack.platform

import android.content.Context
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.react.views.view.setEdgeToEdgeFeatureFlagOn
import com.facebook.soloader.SoLoader
import __APP_PACKAGE__.BuildConfig

fun loadVitalisReactNative(context: Context) {
  // Same initialization as the generated ReactNativeApplicationEntryPoint.
  // Override once, before any React surface/runtime is created; never reset
  // or force-override flags in a running process.
  SoLoader.init(context, OpenSourceMergedSoMapping)
  if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
    check(DefaultNewArchitectureEntryPoint.releaseLevel == ReleaseLevel.STABLE) {
      "VitalisTrack font-scale configuration requires React Native stable."
    }
    DefaultNewArchitectureEntryPoint.loadWithFeatureFlags(fontScaleFeatureFlags())
  }
  if (BuildConfig.IS_EDGE_TO_EDGE_ENABLED) setEdgeToEdgeFeatureFlagOn()
}

// Pure factory: the build check compares every flag with the stable provider.
internal fun fontScaleFeatureFlags(): ReactNativeFeatureFlagsProvider {
  val stable = ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(true, true, true)
  return object : ReactNativeFeatureFlagsProvider by stable {
    override fun enableFontScaleChangesUpdatingLayout(): Boolean = true
  }
}
