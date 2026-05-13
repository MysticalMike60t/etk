function add_namespaces(): void {
    if (window.location.href.indexOf("student.edgenuity.com") > -1) {
        document.body.setAttribute("id", "ETK_N_dashboard");
    } else if (window.location.href.indexOf(".core.learn.edgenuity.com") > -1) {
        document.body.setAttribute("id", "ETK_N_player");
    }
}

const namespaces = {
    add_namespaces,
};

export default namespaces;
