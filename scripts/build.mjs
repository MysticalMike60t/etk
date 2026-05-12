// @ts-check
import * as esbuild from "esbuild";
import { mkdir, writeFile, copyFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const targetArg = args.find((a) => !a.startsWith("--"));
const targets = targetArg ? [targetArg] : ["chrome", "firefox"];

/** @typedef {"chrome" | "firefox"} Target */

const RESTYLE_MATCHES = [
    "https://*.core.learn.edgenuity.com/*",
    "https://student.edgenuity.com/*",
];
const TOOLBAR_MATCHES = ["https://*.core.learn.edgenuity.com/player/*"];

/** @type {(target: Target) => Record<string, unknown>} */
const buildManifest = (target) => {
    const base = {
        manifest_version: 3,
        name: "ETK",
        version: "2.1.0",
        description:
            "Persistent restyle and toolkit overlay for Edgenuity, applied across same-origin iframes and shadow roots.",
        icons: {
            16: "icons/icon-16.png",
            48: "icons/icon-48.png",
            128: "icons/icon-128.png",
        },
        content_scripts: [
            {
                matches: RESTYLE_MATCHES,
                js: ["content.js"],
                run_at: "document_start",
                all_frames: false,
                match_about_blank: true,
            },
            {
                matches: TOOLBAR_MATCHES,
                js: ["bridge.js"],
                run_at: "document_start",
                all_frames: false,
                world: "MAIN",
            },
            {
                matches: TOOLBAR_MATCHES,
                js: ["toolbar.js"],
                run_at: "document_idle",
                all_frames: false,
            },
        ],
        web_accessible_resources: [
            {
                resources: ["styles/restyle.css"],
                matches: RESTYLE_MATCHES,
            },
        ],
    };

    if (target === "firefox") {
        return {
            ...base,
            browser_specific_settings: {
                gecko: {
                    id: "etk@MysticalMike60t",
                    strict_min_version: "115.0",
                },
            },
        };
    }

    return base;
};

/** @type {(target: Target) => Promise<void>} */
const buildTarget = async (target) => {
    const outdir = join(ROOT, "dist", target);

    if (existsSync(outdir)) await rm(outdir, { recursive: true });
    await mkdir(outdir, { recursive: true });

    if (existsSync(join(outdir, "styles")))
        await rm(join(outdir, "styles"), { recursive: true });
    await mkdir(join(outdir, "styles"), { recursive: true });

    await writeFile(
        join(outdir, "manifest.json"),
        JSON.stringify(buildManifest(/** @type {Target} */ (target)), null, 2)
    );

    await execFileAsync("sass", [
        "--style=expanded",
        "--charset",
        "--no-error-css",
        "--",
        join(ROOT, "src", "styles", "restyle.scss"),
        join(outdir, "styles", "restyle.css"),
    ]);

    const iconsDir = join(ROOT, "public", "icons");
    if (existsSync(iconsDir)) {
        const destIcons = join(outdir, "icons");
        await mkdir(destIcons, { recursive: true });
        for (const file of await readdir(iconsDir)) {
            await copyFile(join(iconsDir, file), join(destIcons, file));
        }
    }

    /** @type {Array<{ entry: string; outfile: string }>} */
    const entries = [
        { entry: "src/content.ts", outfile: "content.js" },
        { entry: "src/toolbar/bridge.ts", outfile: "bridge.js" },
        { entry: "src/toolbar/toolbar.ts", outfile: "toolbar.js" },
    ];

    for (const { entry, outfile } of entries) {
        /** @type {esbuild.BuildOptions} */
        const options = {
            entryPoints: [join(ROOT, entry)],
            outfile: join(outdir, outfile),
            bundle: true,
            format: "iife",
            target: "es2022",
            platform: "browser",
            minify: !watch,
            sourcemap: watch ? "inline" : false,
            define: {
                __TARGET__: JSON.stringify(target),
                __DEV__: JSON.stringify(watch),
            },
            logLevel: watch ? "info" : "warning",
        };

        if (watch) {
            const ctx = await esbuild.context(options);
            await ctx.watch();
            console.log(`[${target}] watching ${entry}...`);
        } else {
            await esbuild.build(options);
        }
    }

    if (!watch) console.log(`[${target}] built -> ${outdir}`);
};

await Promise.all(targets.map((t) => buildTarget(/** @type {Target} */ (t))));
