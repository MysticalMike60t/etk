/**
 * @file ETK - Build Script
 * @author Caden Finkelstein
 * @version 2.1.6
 * @desc Build script that builds extension for Firefox and Chrome.
 */
// @ts-check
import * as esbuild from "esbuild";
import { mkdir, writeFile, copyFile, readdir, rm } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { zip } from "zip-a-folder";

/**
 * @type {{name: string, name_short: string, version: string, version_tag: string, description: string}}
 */
const METADATA = {
    name: "Edgenuity Toolkit",
    name_short: "ETK",
    version: "2.1.6",
    version_tag: "v2.1.6",
    description:
        "Persistent restyle and toolkit overlay for Edgenuity, applied across same-origin iframes and shadow roots.",
};

/**
 * @type {?}
 */
const execFileAsync = promisify(execFile);

/**
 * @type {string}
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * @type {string}
 */
const ROOT = resolve(__dirname, "..");

/**
 * @type {string[]}
 */
const args = process.argv.slice(2);
/**
 * @type {boolean}
 */
const watch = args.includes("--watch");
/**
 * @type {string | undefined}
 */
const targetArg = args.find((a) => !a.startsWith("--"));
/**
 * @type {string[]}
 */
const targets = targetArg ? [targetArg] : ["chrome", "firefox"];

/** @typedef {"chrome" | "firefox"} Target */
/**
 * @type {string[]}
 */
const RESTYLE_MATCHES = [
    "https://*.core.learn.edgenuity.com/*",
    "https://student.edgenuity.com/*",
    "https://auth.edgenuity.com/*",
];
/**
 * @type {string[]}
 */
const TOOLBAR_MATCHES = ["https://*.core.learn.edgenuity.com/player/*"];

/** @type {(target: Target) => Record<string, unknown>} */
const buildManifest = (target) => {
    const base = {
        manifest_version: 3,
        name: METADATA.name_short,
        version: METADATA.version,
        description: METADATA.description,
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
                resources: [
                    "styles/restyle.css",
                    "icons/*.png",
                    "backgrounds/*.png",
                ],
                matches: RESTYLE_MATCHES,
            },
        ],
    };

    if (target === "firefox") {
        return {
            ...base,
            browser_specific_settings: {
                gecko: {
                    id: `${METADATA.name_short.toLowerCase()}@MysticalMike60t`,
                    strict_min_version: "115.0", // Should be 115.0
                    data_collection_permissions: {
                        required: ["none"],
                    },
                },
            },
        };
    }

    return base;
};

/**
 * @constructor
 * @param {Target} target
 * @type {(target: Target) => Promise<void>}
 */
const buildTarget = async (target) => {
    /**
     * @type {string}
     */
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

    /**
     * @type {string}
     */
    const iconsDir = join(ROOT, "public", "icons");
    if (existsSync(iconsDir)) {
        /**
         * @type {string}
         */
        const destIcons = join(outdir, "icons");
        await mkdir(destIcons, { recursive: true });
        for (const file of await readdir(iconsDir)) {
            await copyFile(join(iconsDir, file), join(destIcons, file));
        }
    }

    /**
     * @type {string}
     */
    const backgroundsDir = join(ROOT, "public", "backgrounds");
    if (existsSync(backgroundsDir)) {
        /**
         * @type {string}
         */
        const destBackgrounds = join(outdir, "backgrounds");
        await mkdir(destBackgrounds, { recursive: true });
        for (const file of await readdir(backgroundsDir)) {
            await copyFile(
                join(backgroundsDir, file),
                join(destBackgrounds, file)
            );
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
            external: ["node_modules/*"],
        };

        if (watch) {
            /**
             * @type {?}
             */
            const ctx = await esbuild.context(options);
            await ctx.watch();
            console.log(`[${target}] watching ${entry}...`);
        } else {
            await esbuild.build(options);
        }
    }

    if (!watch)
        console.log(
            `[\x1b[35m${target}\x1b[0m] built \x1b[33m->\x1b[0m \x1b[34m${outdir}\x1b[0m`
        );

    await mkdir(join(ROOT, "dist", "zipped"), { recursive: true });
    zip(
        join(ROOT, "dist", "chrome"),
        join(
            ROOT,
            "dist",
            "zipped",
            `${METADATA.name_short.toLowerCase()}.${METADATA.version}.chrome.zip`
        )
    );
    zip(
        join(ROOT, "dist", "firefox"),
        join(
            ROOT,
            "dist",
            "zipped",
            `${METADATA.name_short.toLowerCase()}.${METADATA.version}.firefox.xpi`
        )
    );
};

await Promise.all(targets.map((t) => buildTarget(/** @type {Target} */ (t))));
