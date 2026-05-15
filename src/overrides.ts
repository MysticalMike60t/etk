/**
 * @file ETK - Overrides
 * @author Caden Finkelstein
 * @version 2.1.5
 */
/**
 * Fix activity status inside of player showiung as title color instead of actual status color.
 * @function
 * @return {void}
 * @throws {Error}
 * @since 2.1.5
 */
function fix_activity_status(): void {
    const element: HTMLElement | null =
        document.getElementById("activity-status");
    if (element?.textContent?.trim() === "Complete") {
        element.style.setProperty("color", "var(--success-color)", "important");
        element.style.setProperty(
            "background-color",
            "var(--background-color-secondary)",
            "important"
        );
        element.style.setProperty("padding", "5px 10px", "important");
        element.style.setProperty(
            "outline",
            "1px solid var(--border-color)",
            "important"
        );
        element.style.setProperty(
            "border-radius",
            "var(--border-radius)",
            "important"
        );
    }
}
/**
 * Get background images from Chrome runtime API.
 * @function
 * @return {void}
 * @throws {Error}
 * @since 2.1.5
 */
function get_backgrounds(): void {
    // WARNING: Not all of them are used. Only loading the image currently implemented in the stylesheets.
    document.documentElement.style.setProperty(
        "--login-panel-artwork-image-0.5x",
        `url("${chrome.runtime.getURL("backgrounds/login-panel-artwork-0.5x.png")}")`
    );
    document.documentElement.style.setProperty(
        "--login-panel-artwork-image-1x",
        `url("${chrome.runtime.getURL("backgrounds/login-panel-artwork-1x.png")}")`
    );
    document.documentElement.style.setProperty(
        "--login-panel-artwork-image-2x",
        `url("${chrome.runtime.getURL("backgrounds/login-panel-artwork-2x.png")}")`
    );
}
/**
 * Handle entry into page overrides.
 * @function
 * @return {void}
 * @throws {Error}
 * @since 2.1.5
 */
function entry(): void {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", (): void => {
            fix_activity_status();
            get_backgrounds();
        });
    } else {
        fix_activity_status();
        get_backgrounds();
    }
}

/**
 * Combine functions into single object.
 * @type {Record<string, () => void>}
 * @since 2.1.5
 */
const overrides: Record<string, () => void> = {
    entry,
    fix_activity_status,
    get_backgrounds,
};

export default overrides;
