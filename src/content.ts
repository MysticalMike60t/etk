/**
 * @file ETK - content script
 * @author Caden Finkelstein
 * @version 2.1.6
 *
 * Edgenuity uses `document.domain = "edgenuity.com"` on both the parent
 * (r19.core.learn.edgenuity.com) and the lesson iframe (media.edgenuity.com)
 * to bridge their origins. This script exploits that bridge: from the parent
 * frame, we can reach into iframe.contentDocument and inject <style> tags
 * directly, the same way the original userscript did.
 *
 * Cross-origin iframes that don't opt into the bridge are silently skipped.
 */

import namespaces from "./namespaces";
import overrides from "./overrides";

export {};

/**
 * Browsers.
 * @type {"chrome" | "firefox"}
 * @since 2.1.5
 */
declare const __TARGET__: "chrome" | "firefox";
/**
 * Is in development state.
 * @type {boolean}
 * @since 2.1.5
 */
declare const __DEV__: boolean;

/**
 * ID for styling ETK content.
 * @type {string}
 * @since 2.1.5
 */
const STYLE_ID: string = "etk";
/**
 * URL to main compiled CSS stylesheet using {@link chrome} API.
 * @type {string}
 * @since 2.1.5
 */
const CSS_URL: string = chrome.runtime.getURL("styles/restyle.css");

/**
 * IDK how to explain this.
 * @type {Promise<string> | null}
 * @todo Figure out how to explain this for JsDoc
 * @since 2.1.5
 */
let cssTextPromise: Promise<string> | null = null;
/**
 * Load CSS from {@link CSS_URL}.
 * @returns {Promise<string>}
 * @throws {Error}
 * @since 2.1.5
 */
const loadCss: () => Promise<string> = (): Promise<string> => {
    cssTextPromise ??= fetch(CSS_URL).then(
        (r: Response): Promise<string> => r.text()
    );
    return cssTextPromise;
};

/**
 * Inject <style> into document.
 * @param {Document | ShadowRoot} root Root element for <style> to be injected into.
 * @returns {Promise<void>}
 * @throws {Error}
 * @since 2.1.5
 */
const injectInto: (root: Document | ShadowRoot) => Promise<void> = async (
    root: Document | ShadowRoot
): Promise<void> => {
    if (!root) return;
    try {
        namespaces.add_namespaces();

        /**
         * Checks if {@link root} element was created/exists using {@link STYLE_ID}.
         * @type {Element | null}
         * @since 2.1.5
         */
        const existing: Element | null =
            "getElementById" in root
                ? root.getElementById(STYLE_ID)
                : (root as ShadowRoot).querySelector(`#${STYLE_ID}`);
        if (existing) return;

        /**
         * Raw CSS string from {@link loadCss}.
         * @type {string}
         * @since 2.1.5
         */
        const css: string = await loadCss();
        /**
         * Check if {@link root} is still missing after 1st check, and attempt to use {@link loadCss}. Then checks if {@link root} element was created/exists using {@link STYLE_ID}.
         * @type {boolean}
         * @since 2.1.5
         */
        const stillMissing: boolean =
            "getElementById" in root
                ? !root.getElementById(STYLE_ID)
                : !(root as ShadowRoot).querySelector(`#${STYLE_ID}`);
        if (!stillMissing) return;

        /**
         * Creates document loaded into constant variable.
         * @type {Document}
         * @since 2.1.5
         */
        const doc: Document = (root as Document).createElement
            ? (root as Document)
            : ((root as ShadowRoot).ownerDocument ?? document);
        /**
         * Create <style> HTML element attached to {@link doc}, and load into constant variable.
         * @type {HTMLStyleElement}
         * @since 2.1.5
         */
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
 * Walk through page, and inject elements.
 * @param {Document} root Root element.
 * @returns {void}
 * @since 2.1.5
 */
const walkAndInject: (root: Document) => void = (root: Document): void => {
    /**
     * @returns {void}
     * @todo Implement description into this JsDoc.
     * @since 2.1.5
     */
    void injectInto(root);

    /**
     * List of elements gathered from {@link root}.
     * @type {NodeListOf<Element>}
     * @since 2.1.5
     */
    let elements: NodeListOf<Element>;
    try {
        elements = root.querySelectorAll("*");
    } catch {
        return;
    }

    for (const el of elements) {
        if (el.shadowRoot) void injectInto(el.shadowRoot);

        if (el.tagName === "IFRAME") {
            /**
             * Define iframe from {@link el}, and place into a new constant variable.
             * @type {HTMLIFrameElement}
             * @since 2.1.5
             */
            const iframe: HTMLIFrameElement = el as HTMLIFrameElement;
            try {
                /**
                 * Defines {@link iframe} document element.
                 * @type {Document | null}
                 * @since 2.1.5
                 */
                const iframeDoc: Document | null = iframe.contentDocument;
                if (iframeDoc) walkAndInject(iframeDoc);
            } catch {
                ({});
            }
            iframe.addEventListener(
                "load",
                (): void => {
                    try {
                        /**
                         * Defines {@link iframe} document element.
                         * @type {Document | null}
                         * @since 2.1.5
                         */
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

/**
 * Start extension/{@link walkAndInject}.
 * @returns {void}
 * @throws {Error}
 * @since 2.1.5
 */
const start: () => void = (): void => {
    walkAndInject(document);
    /**
     * New Mutation Observer.
     * @type {MutationObserver}
     * @todo Improve this JsDoc.
     * @throws {Error}
     * @since 2.1.5
     */
    const observer: MutationObserver = new MutationObserver(
        (mutations: MutationRecord[]): void => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    /**
                     * Defines {@link node} as element.
                     * @type {Element}
                     * @since 2.1.5
                     */
                    const el: Element = node as Element;

                    if (el.shadowRoot) void injectInto(el.shadowRoot);

                    if (el.tagName === "IFRAME") {
                        /**
                         * Defines {@link el} as iframe constant variable.
                         * @type {HTMLIFrameElement}
                         * @since 2.1.5
                         */
                        const iframe: HTMLIFrameElement =
                            el as HTMLIFrameElement;
                        iframe.addEventListener(
                            "load",
                            (): void => {
                                try {
                                    /**
                                     * Defines {@link iframe} document to walk.
                                     * @type {Document | null}
                                     * @since 2.1.5
                                     */
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
                                    /**
                                     * Defines {@link iframe} document to walk.
                                     * @type {Document | null}
                                     * @since 2.1.5
                                     */
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
