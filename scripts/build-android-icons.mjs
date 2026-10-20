// Replaces the Android launcher, maskable and splash icons in the generated
// Bubblewrap project with the current Kiliforma mark.
//
//   NODE_PATH=/opt/playwright/node_modules node scripts/build-android-icons.mjs
//
// Why this exists: `bubblewrap init` downloads the icon from the live site
// (https://kiliforma.com/icons/icon-512.png). Until the rebranded web app is
// deployed that is the old rooster, so a freshly generated project carries the
// old artwork. This script renders the icons from
// src/components/brandMarkArt.js instead, the same file the web app draws from,
// so the app and the website cannot disagree -- and it works before the site is
// redeployed.
//
// Run it after `bubblewrap init` and after `node scripts/build-icons.mjs`.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { markArtSvg, markSvg } from "../src/components/brandMarkArt.js";

const root = fileURLToPath(new URL("..", import.meta.url));

// Two Android projects share this artwork:
//   android/          the Bubblewrap Trusted Web Activity (Bubblewrap's names)
//   mobile/android/   the Capacitor shell (Capacitor's names)
// Both are generated when their folder exists, so neither can drift.
const targets = [
  { res: `${root}android/app/src/main/res`, flavour: "twa" },
  { res: `${root}mobile/android/app/src/main/res`, flavour: "capacitor" },
].filter(target => existsSync(`${target.res}/values`));

// Android launcher icon sizes, in density buckets.
const LAUNCHER = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];
// The adaptive icon's foreground layer: the artwork alone on a transparent
// background, kept inside Android's safe zone (the inner 66% of the canvas) so
// no launcher shape can crop the leaf.
const MASKABLE = [
  ["mdpi", 108],
  ["hdpi", 162],
  ["xhdpi", 216],
  ["xxhdpi", 324],
  ["xxxhdpi", 432],
];
// The splash screen image Bubblewrap generates per density.
const SPLASH = [
  ["mdpi", 300],
  ["hdpi", 450],
  ["xhdpi", 600],
  ["xxhdpi", 900],
  ["xxxhdpi", 1200],
];

const browser = await chromium.launch();
async function png(svg, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg}</div></body>`,
  );
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log("wrote " + file.replace(root, ""));
}

const rounded = markSvg();                       // legacy launcher icon (API 25 and below)
const foreground = markArtSvg({ scale: 0.62 });  // adaptive icon foreground
const splash = markSvg({ rounded: false, scale: 0.72 });
const store = markSvg({ rounded: false, scale: 0.72 });

for (const { res, flavour } of targets) {
  for (const [density, size] of LAUNCHER) {
    await png(rounded, size, `${res}/mipmap-${density}/ic_launcher.png`);
    if (flavour === "capacitor") {
      // Round launchers ask for this one; the tile is already rounded.
      await png(rounded, size, `${res}/mipmap-${density}/ic_launcher_round.png`);
    }
  }
  for (const [density, size] of MASKABLE) {
    // Bubblewrap calls the adaptive foreground ic_maskable, Capacitor calls it
    // ic_launcher_foreground.
    const name = flavour === "capacitor" ? "ic_launcher_foreground" : "ic_maskable";
    await png(foreground, size, `${res}/mipmap-${density}/${name}.png`);
  }
  for (const [density, size] of SPLASH) {
    await png(splash, size, `${res}/drawable-${density}/splash.png`);
  }
  if (flavour === "capacitor") {
    // Capacitor also has a portrait and a landscape splash per density, plus a
    // plain drawable/splash.png used as the launch window background.
    await png(splash, 1024, `${res}/drawable/splash.png`);
    for (const [density, size] of SPLASH) {
      for (const orientation of ["port", "land"]) {
        const dir = `${res}/drawable-${orientation}-${density}`;
        if (existsSync(dir)) await png(splash, size, `${dir}/splash.png`);
      }
    }
  }
}
// What Play Console asks for on the store listing: 512 x 512, no transparency.
await png(store, 512, `${root}android/store_icon.png`);

await browser.close();
