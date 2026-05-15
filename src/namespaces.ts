/**
 * @file ETK - Namespaces
 * @author Caden Finkelstein
 * @version 2.1.6
 */
/**
 * Add namespace IDs dependent on the current page to assist stylesheets.
 * @function
 * @return {void}
 * @throws {Error}
 * @since 2.1.5
 */
function add_namespaces(): void {
    const map: Record<string, string> = {
        "student.edgenuity.com": "ETK_N_dashboard",
        ".core.learn.edgenuity.com": "ETK_N_player",
        "auth.edgenuity.com": "ETK_N_login",
    };

    /**
     * Apply ID to specified element.
     * @function
     * @return {void}
     * @throws {Error}
     * @since 2.1.5
     */
    const apply: () => void = (): void => {
        for (const [key, id] of Object.entries(map)) {
            if (window.location.href.includes(key)) {
                document.body.id = id;
                break;
            }
        }
    };

    if (document.body) {
        apply();
    } else {
        document.addEventListener("DOMContentLoaded", apply);
    }
}

const namespaces = { add_namespaces };
export default namespaces;
