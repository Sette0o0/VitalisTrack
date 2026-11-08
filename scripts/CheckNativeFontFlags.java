import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider;
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android;

/** Checks the compiled provider; no Android process or native runtime is started. */
public final class CheckNativeFontFlags {
  public static void main(String[] args) throws Exception {
    Class<?> loader = Class.forName("com.vitalistrack.platform.VitalisReactNativeKt");
    var factory = java.util.Arrays.stream(loader.getDeclaredMethods())
        .filter(method -> method.getName().startsWith("fontScaleFeatureFlags"))
        .findFirst().orElseThrow();
    factory.setAccessible(true);
    Object configured = factory.invoke(null);
    var stable = new ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(true, true, true);
    int checked = 0;
    for (var flag : ReactNativeFeatureFlagsProvider.class.getDeclaredMethods()) {
      if (flag.getParameterCount() != 0) continue;
      Object actual = flag.invoke(configured);
      Object previous = flag.invoke(stable);
      if (flag.getName().equals("enableFontScaleChangesUpdatingLayout")) {
        if (!Boolean.TRUE.equals(actual) || !Boolean.FALSE.equals(previous)) throw new AssertionError("Font-scale override missing or baseline changed");
      } else if (!java.util.Objects.equals(actual, previous)) {
        throw new AssertionError("Unexpected flag change: " + flag.getName());
      }
      checked++;
    }
    System.out.println("{\"flagsChecked\":" + checked + ",\"onlyFontScaleChanged\":true}");
  }
}
