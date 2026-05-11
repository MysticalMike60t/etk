/**
 * ETK - content script
 *
 * Edgenuity uses `document.domain = "edgenuity.com"` on both the parent
 * (r19.core.learn.edgenuity.com) and the lesson iframe (media.edgenuity.com)
 * to bridge their origins. This script exploits that bridge: from the parent
 * frame, we can reach into iframe.contentDocument and inject <style> tags
 * directly, the same way the original userscript did.
 *
 * Cross-origin iframes that don't opt into the bridge are silently skipped.
 */
import overrides from "./overrides";

export {};

declare const __TARGET__: "chrome" | "firefox";
declare const __DEV__: boolean;

const STYLE_ID = "etk";
const CSS_URL = chrome.runtime.getURL("restyle.css");

let cssTextPromise: Promise<string> | null = null;
const loadCss = (): Promise<string> => {
    cssTextPromise ??= fetch(CSS_URL).then((r) => r.text());
    return cssTextPromise;
};

/**
 * Inject our <style> into a Document or ShadowRoot. Idempotent — if the
 * style is already there, do nothing. If the page stripped or replaced it,
 * re-insert.
 */
const injectInto = async (root: Document | ShadowRoot): Promise<void> => {
    if (!root) return;
    try {
        const existing =
            "getElementById" in root
                ? root.getElementById(STYLE_ID)
                : (root as ShadowRoot).querySelector(`#${STYLE_ID}`);
        if (existing) return;

        const css = await loadCss();
        const stillMissing =
            "getElementById" in root
                ? !root.getElementById(STYLE_ID)
                : !(root as ShadowRoot).querySelector(`#${STYLE_ID}`);
        if (!stillMissing) return;

        const doc = (root as Document).createElement
            ? (root as Document)
            : ((root as ShadowRoot).ownerDocument ?? document);
        const style = doc.createElement("style");
        style.id = STYLE_ID;
        style.textContent = css;

        if ((root as Document).head) {
            (root as Document).head.appendChild(style);
        } else {
            (root as Document).appendChild(style);
        }

        overrides();
    } catch {
        ({});
    }
};

/**
 * Walk the DOM tree starting from a root, injecting into:
 *   - The root document itself (already passed in)
 *   - Open shadow roots
 *   - Same-origin iframes (which, thanks to document.domain bridging,
 *     includes media.edgenuity.com from r19.core.learn.edgenuity.com)
 */
const walkAndInject = (root: Document): void => {
    void injectInto(root);

    let elements: NodeListOf<Element>;
    try {
        elements = root.querySelectorAll("*");
    } catch {
        return;
    }

    for (const el of elements) {
        if (el.shadowRoot) void injectInto(el.shadowRoot);

        if (el.tagName === "IFRAME") {
            const iframe = el as HTMLIFrameElement;
            try {
                const iframeDoc = iframe.contentDocument;
                if (iframeDoc) walkAndInject(iframeDoc);
            } catch {
                ({});
            }
            iframe.addEventListener(
                "load",
                () => {
                    try {
                        const iframeDoc = iframe.contentDocument;
                        if (iframeDoc) walkAndInject(iframeDoc);
                    } catch {
                        ({});
                    }
                },
                { once: false }
            );
        }
    }
};

const start = (): void => {
    walkAndInject(document);
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const el = node as Element;

                if (el.shadowRoot) void injectInto(el.shadowRoot);

                if (el.tagName === "IFRAME") {
                    const iframe = el as HTMLIFrameElement;
                    iframe.addEventListener(
                        "load",
                        () => {
                            try {
                                const doc = iframe.contentDocument;
                                if (doc) walkAndInject(doc);
                            } catch {
                                ({});
                            }
                        },
                        { once: false }
                    );
                }
                if (el.querySelectorAll) {
                    el.querySelectorAll("iframe").forEach((iframe) => {
                        try {
                            const doc = (iframe as HTMLIFrameElement)
                                .contentDocument;
                            if (doc) walkAndInject(doc);
                        } catch {
                            ({});
                        }
                    });
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
    setTimeout(() => walkAndInject(document), 500);
    setTimeout(() => walkAndInject(document), 2000);
    setTimeout(() => walkAndInject(document), 5000);

    if (__DEV__) {
        console.info(
            `[ETK] active (target: ${__TARGET__}, frame: ${window.location.href})`
        );
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
    start();
}
