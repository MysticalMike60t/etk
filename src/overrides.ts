// TODO: Fix overrides functionality.
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

function entry(): void {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", (): void =>
            fix_activity_status()
        );
    } else {
        fix_activity_status();
    }
}

const overrides = {
    entry,
    fix_activity_status,
};

export default overrides;
