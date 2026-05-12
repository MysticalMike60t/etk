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
const CSS_URL: string = chrome.runtime.getURL("styles/restyle.css");

let cssTextPromise: Promise<string> | null = null;
const loadCss: () => Promise<string> = (): Promise<string> => {
    cssTextPromise ??= fetch(CSS_URL).then(
        (r: Response): Promise<string> => r.text()
    );
    return cssTextPromise;
};

/**
 * Inject <style>
 */
const injectInto: (root: Document | ShadowRoot) => Promise<void> = async (
    root: Document | ShadowRoot
): Promise<void> => {
    if (!root) return;
    try {
        const existing: Element | null =
            "getElementById" in root
                ? root.getElementById(STYLE_ID)
                : (root as ShadowRoot).querySelector(`#${STYLE_ID}`);
        if (existing) return;

        const css: string = await loadCss();
        const stillMissing: boolean =
            "getElementById" in root
                ? !root.getElementById(STYLE_ID)
                : !(root as ShadowRoot).querySelector(`#${STYLE_ID}`);
        if (!stillMissing) return;

        const doc: Document = (root as Document).createElement
            ? (root as Document)
            : ((root as ShadowRoot).ownerDocument ?? document);
        const style: HTMLStyleElement = doc.createElement("style");
        style.id = STYLE_ID;
        style.textContent = css;

        if ((root as Document).head) {
            (root as Document).head.appendChild(style);
        } else {
            (root as Document).appendChild(style);
        }

        overrides.entry();
    } catch {
        ({});
    }
};

/**
 * Walk and inject
 */
const walkAndInject: (root: Document) => void = (root: Document): void => {
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
                const iframeDoc: Document | null = iframe.contentDocument;
                if (iframeDoc) walkAndInject(iframeDoc);
            } catch {
                ({});
            }
            iframe.addEventListener(
                "load",
                (): void => {
                    try {
                        const iframeDoc: Document | null =
                            iframe.contentDocument;
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

const start: () => void = (): void => {
    walkAndInject(document);
    const observer = new MutationObserver(
        (mutations: MutationRecord[]): void => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    const el = node as Element;

                    if (el.shadowRoot) void injectInto(el.shadowRoot);

                    if (el.tagName === "IFRAME") {
                        const iframe = el as HTMLIFrameElement;
                        iframe.addEventListener(
                            "load",
                            (): void => {
                                try {
                                    const doc: Document | null =
                                        iframe.contentDocument;
                                    if (doc) walkAndInject(doc);
                                } catch {
                                    ({});
                                }
                            },
                            { once: false }
                        );
                    }
                    if (el.querySelectorAll) {
                        el.querySelectorAll("iframe").forEach(
                            (iframe: HTMLIFrameElement): void => {
                                try {
                                    const doc: Document | null = (
                                        iframe as HTMLIFrameElement
                                    ).contentDocument;
                                    if (doc) walkAndInject(doc);
                                } catch {
                                    ({});
                                }
                            }
                        );
                    }
                }
            }
        }
    );

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
    setTimeout((): void => walkAndInject(document), 500);
    setTimeout((): void => walkAndInject(document), 2000);
    setTimeout((): void => walkAndInject(document), 5000);

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
