// TODO: Fix overrides functionality.
export default function entry(): void {
    fix_activity_status();
}

function fix_activity_status(): void {
    let element: HTMLElement | null =
        document.getElementById("activity-status");
    if (element?.getHTML() == "Complete") {
        element.style.color = "green";
    }
}
