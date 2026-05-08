/**
 * Edgenuity Restyle - content script
 *
 * The bulk of styling is delivered by the manifest's `content_scripts.css`,
 * which the browser injects into every matching frame (top + iframes) at
 * document_start. This script handles two cases the manifest cannot:
 *
 *   1. Shadow DOM roots — manifest CSS does not pierce open shadow roots.
 *   2. Re-injection — if the page mutates our injected style node away.
 *
 * The CSS source is fetched from the extension via a runtime URL once and
 * cached, then injected into shadow roots as they appear.
 */

declare const __TARGET__: "chrome" | "firefox";
declare const __DEV__: boolean;

// Both Chrome and Firefox MV3 expose `chrome.*`. We only need
// `runtime.getURL` here, which is sync and identical on both.
const STYLE_ID = "restyle-edgenuity";
const CSS_URL = chrome.runtime.getURL("restyle.css");

let cssTextPromise: Promise<string> | null = null;

const loadCss = (): Promise<string> => {
    cssTextPromise ??= fetch(CSS_URL).then((r) => r.text());
    return cssTextPromise;
};

const injectIntoShadowRoot = async (root: ShadowRoot): Promise<void> => {
    if (root.getElementById(STYLE_ID)) return;

    const css = await loadCss();
    if (root.getElementById(STYLE_ID)) return; // race: another caller injected

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    root.appendChild(style);
};

/**
 * Walk an element subtree and inject into any shadow roots found.
 * Only open shadow roots are reachable; closed ones are invisible by design.
 */
const propagateToShadowRoots = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;

    if (el.shadowRoot) void injectIntoShadowRoot(el.shadowRoot);

    // TreeWalker is faster than querySelectorAll('*') for finding shadow hosts.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let current = walker.nextNode() as Element | null;
    while (current !== null) {
        if (current.shadowRoot) void injectIntoShadowRoot(current.shadowRoot);
        current = walker.nextNode() as Element | null;
    }
};

const start = (): void => {
    // Initial sweep for shadow hosts that exist at script-start time.
    propagateToShadowRoots(document.documentElement);

    // Watch for new shadow hosts added later. This observer is intentionally
    // narrow: childList only, no attribute watching, so it is cheap on busy SPAs.
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) propagateToShadowRoots(node);
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    if (__DEV__) {
        console.info(
            `[Edgenuity Restyle] active (target: ${__TARGET__}, frame: ${window.location.href})`
        );
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
    start();
}
