import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * capacitor.config.json's android.includePlugins decides which native plugins
 * the Android app is built with. It is an allowlist because Capacitor offers no
 * other way to leave one out -- and an allowlist fails quietly: a plugin added
 * to package.json later and not to the list is simply absent from the APK, and
 * every call to it rejects at runtime with nothing at build time to say why.
 * This test is the build-time "why".
 *
 * Adding a plugin: put it in the list. Leaving one off Android on purpose: put
 * it in ANDROID_EXCLUDED with the reason.
 */
const ANDROID_EXCLUDED = {
  // Its Android load() runs whether or not the JS calls it, and applies the
  // plugin's defaults: overlaysWebView true and a black bar. On Android 14 and
  // below that draws the page under the status bar. Only iOS uses it
  // (src/mobile/statusBar.js); Android's status bar is already right.
  '@capacitor/status-bar': 'iOS only; its defaults move the Android layout',
};

// Relative paths resolve from the repo root, where vitest runs, as the other
// file-reading tests assume.
const root = path.resolve('.');
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

// The same test `npx cap sync` applies: a dependency is a plugin when its
// package.json has a `capacitor` block, or it ships a Cordova plugin.xml.
const capacitorPlugins = () => {
  const pkg = readJson('package.json');
  return [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
    .filter((name) => {
      const dir = path.join(root, 'node_modules', name);
      if (!existsSync(path.join(dir, 'package.json'))) return false;
      const meta = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
      return Boolean(meta.capacitor?.android) || existsSync(path.join(dir, 'plugin.xml'));
    })
    .sort();
};

describe('the Android plugin allowlist', () => {
  const allowlist = readJson('capacitor.config.json').android?.includePlugins ?? [];

  it('names every Capacitor plugin in package.json, or excludes it on purpose', () => {
    const unaccounted = capacitorPlugins().filter(
      (name) => !allowlist.includes(name) && !(name in ANDROID_EXCLUDED),
    );
    expect(unaccounted).toEqual([]);
  });

  it('names nothing that is not installed', () => {
    const installed = capacitorPlugins();
    expect(allowlist.filter((name) => !installed.includes(name))).toEqual([]);
  });

  it('does not both include and exclude a plugin', () => {
    expect(allowlist.filter((name) => name in ANDROID_EXCLUDED)).toEqual([]);
  });

  it('matches the Gradle files cap update generated from it', () => {
    const settings = readFileSync(path.join(root, 'android/capacitor.settings.gradle'), 'utf8');
    for (const name of Object.keys(ANDROID_EXCLUDED)) {
      expect(settings).not.toContain(`node_modules/${name}/android`);
    }
    for (const name of allowlist) {
      expect(settings).toContain(`node_modules/${name}/android`);
    }
  });
});
