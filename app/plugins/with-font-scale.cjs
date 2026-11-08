const fs = require('node:fs');
const path = require('node:path');
const { withMainApplication } = require('expo/config-plugins');

module.exports = function withFontScale(config) {
  return withMainApplication(config, (mod) => {
    const version = require('react-native/package.json').version;
    if (version !== '0.81.5') {
      throw new Error(`Review the native font-scale startup hook for React Native ${version}.`);
    }
    if (mod.modResults.language !== 'kt') {
      throw new Error('VitalisTrack font-scale configuration requires Kotlin MainApplication.');
    }
    const appPackage = mod.modResults.contents.match(/^package ([\w.]+)/m)?.[1];
    if (!appPackage) throw new Error('MainApplication package missing.');
    const source = fs.readFileSync(path.join(__dirname, 'native/VitalisReactNative.kt'), 'utf8')
      .replace('__APP_PACKAGE__', appPackage);
    const target = path.join(mod.modRequest.platformProjectRoot,
      'app/src/main/java/com/vitalistrack/platform/VitalisReactNative.kt');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
    const originalImport = 'import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative';
    const ownImport = 'import com.vitalistrack.platform.loadVitalisReactNative';
    let contents = mod.modResults.contents;
    if (contents.includes(originalImport)) {
      if (!contents.includes('    loadReactNative(this)')) throw new Error('React Native startup changed.');
      contents = contents.replace(originalImport, ownImport)
        .replace('    loadReactNative(this)', '    loadVitalisReactNative(this)');
    } else if (!contents.includes(ownImport) || !contents.includes('    loadVitalisReactNative(this)')) {
      throw new Error('React Native startup not recognized.');
    }
    mod.modResults.contents = contents;
    return mod;
  });
};
