/**
 * Edgenuity Toolkit - toolbar UI
 *
 * Runs in the content script's isolated world. Builds the floating button
 * bar and routes button clicks to the main-world bridge via postMessage.
 *
 * The DOM and CSS live here because building DOM is identical in both worlds;
 * only the JS function calls into Edgenuity's `API` object require the bridge.
 *
 * One feature lives entirely in this script: "Unblock Screen" performs a DOM
 * sweep for invisible blocker overlays (an iframe-walking heuristic). That
 * does not need page-world access — it only reads the DOM, which both worlds
 * share.
 */
export {};

const TOOLBAR_ID = "edgenuity-toolkit-bar";
const STYLE_ID = "edgenuity-toolkit-style";
const MSG_REQUEST = "etk-request";

type Command = "hideBlocker" | "backFrame" | "nextFrame" | "checkFrame";

let nextRequestId = 0;
const sendCommand = (command: Command): void => {
    const id = nextRequestId++;
    window.postMessage(
        { source: MSG_REQUEST, id, command },
        window.location.origin
    );
};

interface ButtonSpec {
    label: string;
    id: string;
    variant: "danger" | "warning" | "nav-orange" | "nav-green";
    onClick: () => void;
}

const PALETTES: Record<
    ButtonSpec["variant"],
    { bg: string; bgHover: string; border: string; text: string }
> = {
    danger: {
        bg: "rgba(235, 88, 88, 0.5)",
        bgHover: "rgba(200, 75, 75, 0.5)",
        border: "rgb(245, 146, 146)",
        text: "rgb(250, 177, 177)",
    },
    warning: {
        bg: "rgba(175, 140, 20, 0.5)",
        bgHover: "rgba(150, 100, 20, 0.5)",
        border: "rgb(245, 222, 146)",
        text: "rgb(250, 242, 177)",
    },
    "nav-orange": {
        bg: "rgba(240, 75, 40, 0.5)",
        bgHover: "rgba(200, 60, 30, 0.5)",
        border: "rgb(230, 125, 100)",
        text: "rgb(240, 180, 170)",
    },
    "nav-green": {
        bg: "rgba(100, 175, 20, 0.5)",
        bgHover: "rgba(60, 150, 20, 0.5)",
        border: "rgb(175, 245, 146)",
        text: "rgb(200, 250, 177)",
    },
};

/**
 * Looks at the document (and same-origin iframes) hiding invisible blocker
 * overlays.
 */
const unblockScreen = (): number => {
    const KNOWN_BLOCKER_IDS = [
        "submitBlocker",
        "submitLoading",
        "invis-o-div",
        "invisodiv",
        "invis_div",
    ];
    const KEEP = new Set([TOOLBAR_ID]);
    let count = 0;

    const hide = (el: HTMLElement): void => {
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.style.visibility = "hidden";
        count++;
    };

    const sweep = (doc: Document): void => {
        for (const id of KNOWN_BLOCKER_IDS) {
            const el = doc.getElementById(id);
            if (el && !KEEP.has(el.id)) hide(el);
        }

        try {
            doc.querySelectorAll<HTMLElement>("[id],[class]").forEach((el) => {
                if (KEEP.has(el.id)) return;
                const id = (el.id || "").toLowerCase();
                const cls =
                    typeof el.className === "string"
                        ? el.className.toLowerCase()
                        : "";
                if (id.includes("invis") || cls.includes("invis")) hide(el);
            });
        } catch {
            true;
        }

        const SELECTORS = [
            "[id*='blocker']",
            "[id*='Blocker']",
            "[id*='submitBlock']",
            "[class*='blocker']",
            "[id*='loading'][style*='display: block']",
        ];
        for (const sel of SELECTORS) {
            try {
                doc.querySelectorAll<HTMLElement>(sel).forEach((el) => {
                    if (KEEP.has(el.id)) return;
                    hide(el);
                });
            } catch {
                true;
            }
        }

        try {
            doc.querySelectorAll<HTMLElement>("div,span").forEach((el) => {
                if (KEEP.has(el.id)) return;
                const rect = el.getBoundingClientRect();
                if (rect.width < 200 || rect.height < 200) return;

                const style = doc.defaultView?.getComputedStyle(el);
                if (!style) return;

                const opacity = parseFloat(style.opacity);
                const pointerEvents = style.pointerEvents;
                if (
                    (opacity < 0.05 || pointerEvents === "none") &&
                    rect.width > 400 &&
                    rect.height > 300
                ) {
                    el.style.pointerEvents = "none";
                    el.style.display = "none";
                    count++;
                }
            });
        } catch {
            true;
        }
    };

    sweep(document);
    document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((frame) => {
        try {
            if (frame.contentDocument) sweep(frame.contentDocument);
        } catch {
            true;
        }
    });

    return count;
};

const injectStyles = (): void => {
    if (document.getElementById(STYLE_ID)) return;

    const mainHead = document.querySelector<HTMLElement>(".mainhead");
    const offsetTop = mainHead?.getBoundingClientRect().height ?? 0;

    const buttonRules = (Object.keys(PALETTES) as ButtonSpec["variant"][])
        .map((variant) => {
            const p = PALETTES[variant];
            return `
        #${TOOLBAR_ID} button[data-variant="${variant}"] {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          z-index: 1200;
          border-radius: 2px;
          border: 1px solid ${p.border};
          background-color: ${p.bg};
          cursor: pointer;
          transition: 100ms ease-in-out background-color;
          padding: 4px 8px;
        }
        #${TOOLBAR_ID} button[data-variant="${variant}"]:hover {
          background-color: ${p.bgHover};
        }
        #${TOOLBAR_ID} button[data-variant="${variant}"] span {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 1em;
          font-family: "Courier New", Courier, monospace;
          color: ${p.text};
          transform: translateY(2px);
        }
      `;
        })
        .join("\n");

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    #${TOOLBAR_ID} {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 5px;
      position: relative;
      z-index: 1200;
      padding: 5px;
      border-radius: 2px;
      border: 1px solid rgb(100, 100, 100);
      background-color: rgb(25, 25, 25);
    }
    #${TOOLBAR_ID} > .etk-credit {
      color: rgb(100, 100, 100);
      font-size: 0.8em;
      line-height: 1;
    }
    #${TOOLBAR_ID} > .etk-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    ${buttonRules}
  `;
    document.head.appendChild(style);
};

const build = (): void => {
    if (document.getElementById(TOOLBAR_ID)) return;

    injectStyles();

    const bar = document.createElement("div");
    bar.id = TOOLBAR_ID;

    const credit = document.createElement("address");
    credit.className = "etk-credit";
    credit.textContent = "Made by: Caden Finkelstein";
    bar.appendChild(credit);

    const row = document.createElement("div");
    row.className = "etk-row";
    bar.appendChild(row);

    const buttons: ButtonSpec[] = [
        {
            label: "Unblock Screen",
            id: "btn-unblock",
            variant: "danger",
            onClick: () => {
                sendCommand("hideBlocker");
                const n = unblockScreen();
                console.info(`[ETK] Unblocked ${n} element(s)`);
            },
        },
        {
            label: "Previous Frame",
            id: "btn-prev-frame",
            variant: "warning",
            onClick: () => sendCommand("backFrame"),
        },
        {
            label: "Next Frame",
            id: "btn-next-frame",
            variant: "warning",
            onClick: () => sendCommand("nextFrame"),
        },
        {
            label: "Previous Assignment",
            id: "btn-prev-assignment",
            variant: "nav-orange",
            onClick: () => {
                document.querySelector<HTMLElement>(".footnav.goLeft")?.click();
            },
        },
        {
            label: "Next Assignment",
            id: "btn-next-assignment",
            variant: "nav-orange",
            onClick: () => {
                document
                    .querySelector<HTMLElement>(".footnav.goRight")
                    ?.click();
            },
        },
        {
            label: "Check Frame",
            id: "btn-check-frame",
            variant: "nav-green",
            onClick: () => sendCommand("checkFrame"),
        },
    ];

    for (const spec of buttons) {
        const btn = document.createElement("button");
        btn.id = `etk-${spec.id}`;
        btn.dataset["variant"] = spec.variant;
        btn.type = "button";
        const span = document.createElement("span");
        span.textContent = spec.label;
        btn.appendChild(span);
        btn.addEventListener("click", spec.onClick);
        row.appendChild(btn);
    }

    document.querySelector("body > .mainhead > .course");

    document.querySelector(".mainhead")?.appendChild(bar);
};

const start = (): void => {
    if (window.self !== window.top) return;
    build();
};

if (document.readyState === "complete") {
    start();
} else {
    window.addEventListener("load", start, { once: true });
}
