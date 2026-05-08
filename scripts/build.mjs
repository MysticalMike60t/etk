// @ts-check
import * as esbuild from "esbuild";
import { mkdir, writeFile, copyFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const targetArg = args.find((a) => !a.startsWith("--"));
const targets = targetArg ? [targetArg] : ["chrome", "firefox"];

/** @typedef {"chrome" | "firefox"} Target */

/** @type {(target: Target) => Record<string, unknown>} */
const buildManifest = (target) => {
    const base = {
        manifest_version: 3,
        name: "Edgenuity Restyle",
        version: "2.0.0",
        description:
            "Persistent restyle for Edgenuity, applied across same-origin iframes and shadow roots.",
        icons: {
            16: "icons/icon-16.png",
            48: "icons/icon-48.png",
            128: "icons/icon-128.png",
        },
        content_scripts: [
            {
                matches: ["https://r19.core.learn.edgenuity.com/*"],
                js: ["content.js"],
                css: ["restyle.css"],
                run_at: "document_start",
                all_frames: true,
                match_about_blank: true,
            },
        ],
        web_accessible_resources: [
            {
                resources: ["restyle.css"],
                matches: ["https://r19.core.learn.edgenuity.com/*"],
            },
        ],
    };

    if (target === "firefox") {
        return {
            ...base,
            browser_specific_settings: {
                gecko: {
                    id: "edgenuity-restyle@butterboyyo",
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

    // Manifest
    await writeFile(
        join(outdir, "manifest.json"),
        JSON.stringify(buildManifest(/** @type {Target} */ (target)), null, 2)
    );

    // CSS
    await copyFile(
        join(ROOT, "src", "restyle.css"),
        join(outdir, "restyle.css")
    );

    // Icons (if present)
    const iconsDir = join(ROOT, "public", "icons");
    if (existsSync(iconsDir)) {
        const destIcons = join(outdir, "icons");
        await mkdir(destIcons, { recursive: true });
        for (const file of await readdir(iconsDir)) {
            await copyFile(join(iconsDir, file), join(destIcons, file));
        }
    }

    // TS bundle
    /** @type {esbuild.BuildOptions} */
    const options = {
        entryPoints: [join(ROOT, "src", "content.ts")],
        outfile: join(outdir, "content.js"),
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
        logLevel: "info",
    };

    if (watch) {
        const ctx = await esbuild.context(options);
        await ctx.watch();
        console.log(`[${target}] watching...`);
    } else {
        await esbuild.build(options);
        console.log(`[${target}] built -> ${outdir}`);
    }
};

await Promise.all(targets.map((t) => buildTarget(/** @type {Target} */ (t))));
