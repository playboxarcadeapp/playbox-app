// Small settings in the generated iOS and Android projects:
//  - portrait or sideways (follows the phone's rotation lock), iPhone and iPad, version numbers from the build server, Android release signing
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version, build = String(parseInt(process.env.BUILD_NUMBER || '1', 10) || 1);
const which = process.argv[2] || 'both';
const edit = async (file, fn) => { const p = path.join(root, file); const before = await fs.readFile(p, 'utf8'); const after = fn(before); if (after !== before) await fs.writeFile(p, after); console.log('updated', file); };

if (which === 'android' || which === 'both') {
  await edit('android/app/src/main/AndroidManifest.xml', s => s.includes('android:screenOrientation') ? s.replace(/android:screenOrientation="[^"]*"/, 'android:screenOrientation="fullUser"') :
    s.replace(/<activity(\s)/, '<activity android:screenOrientation="fullUser"$1'));
  await edit('android/app/build.gradle', s => {
    s = s.replace(/versionCode\s+\d+/, `versionCode ${build}`).replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
    if (!s.includes('CM_KEYSTORE_PATH')) {
      s = s.replace(/buildTypes\s*\{/, `signingConfigs {
        release {
            if (System.getenv("CM_KEYSTORE_PATH")) {
                storeFile file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CM_KEY_ALIAS")
                keyPassword System.getenv("CM_KEY_PASSWORD")
            }
        }
    }
    buildTypes {`);
      s = s.replace(/release\s*\{(\s*)minifyEnabled/, 'release {$1signingConfig signingConfigs.release$1minifyEnabled');
    }
    return s;
  });
}

if (which === 'ios' || which === 'both') {
  await edit('ios/App/App/Info.plist', s => {
    const portrait = '<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t</array>';
    s = s.replace(/(<key>UISupportedInterfaceOrientations<\/key>\s*)<array>[\s\S]*?<\/array>/, `$1${portrait}`);
    // iPad: all four directions (Apple expects this so the app works in iPad multitasking and windows)
    const ipad = '<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t\t<string>UIInterfaceOrientationPortraitUpsideDown</string>\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t</array>';
    if (s.includes('UISupportedInterfaceOrientations~ipad')) s = s.replace(/(<key>UISupportedInterfaceOrientations~ipad<\/key>\s*)<array>[\s\S]*?<\/array>/, `$1${ipad}`);
    else s = s.replace(/<dict>/, `<dict>\n\t<key>UISupportedInterfaceOrientations~ipad</key>\n\t${ipad}`);
    if (!s.includes('ITSAppUsesNonExemptEncryption')) s = s.replace(/<dict>/, '<dict>\n\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>');
    if (!s.includes('UIStatusBarHidden')) s = s.replace(/<dict>/, '<dict>\n\t<key>UIStatusBarHidden</key>\n\t<true/>\n\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>');
    return s;
  });
  // Game sound mixes with audiobooks, podcasts and videos instead of stopping them
  await edit('ios/App/App/AppDelegate.swift', s => {
    if (s.includes('AVAudioSession')) return s;
    s = s.replace(/import UIKit/, 'import UIKit\nimport AVFoundation');
    return s.replace(/(didFinishLaunchingWithOptions[^{]*\{)/, `$1\n        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])`);
  });
  await edit('ios/App/App.xcodeproj/project.pbxproj', s => s
    .replace(/TARGETED_DEVICE_FAMILY = "?[\d,]+"?;/g, 'TARGETED_DEVICE_FAMILY = "1,2";')   // 1 = iPhone, 2 = iPad
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`));
}
