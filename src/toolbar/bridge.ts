/**
 * Edgenuity Toolkit - main-world bridge
 *
 * Runs in the PAGE's JS world (not the content script's isolated world).
 * Two responsibilities:
 *
 *   1. Patch Element.prototype.attachShadow before any page code uses it,
 *      forcing all shadow roots to be open so the restyle script can reach
 *      into them.
 *
 *   2. Listen for window.postMessage commands from the toolbar (which runs
 *      in the isolated world and cannot reach the iframe's `API` object
 *      directly), execute them against `stageFrame.contentWindow.API`, and
 *      post back the result.
 *
 * This file is loaded as a separate content_scripts entry with world: "MAIN".
 */
export {};

interface EdgenuityAPI {
    HideBlocker?: () => void;
    FrameChain?: {
        backFrame?: () => void;
        nextFrame?: () => void;
    };
    Frame?: {
        check?: () => void;
    };
}

interface StageFrameWindow extends Window {
    API?: EdgenuityAPI;
}

const SOURCE = "etk-bridge";
const MSG_REQUEST = "etk-request";
const MSG_RESPONSE = "etk-response";

type Command = "hideBlocker" | "backFrame" | "nextFrame" | "checkFrame";

interface RequestMessage {
    source: typeof MSG_REQUEST;
    id: number;
    command: Command;
}

interface ResponseMessage {
    source: typeof MSG_RESPONSE;
    id: number;
    ok: boolean;
    error?: string;
}

((): void => {
    try {
        const proto = Element.prototype as Element & { __etkPatched?: boolean };
        if (!proto.__etkPatched) {
            proto.__etkPatched = true;
            const original: (init: ShadowRootInit) => ShadowRoot =
                proto.attachShadow;
            proto.attachShadow = function (init: ShadowRootInit): ShadowRoot {
                return original.call(this, { ...init, mode: "open" });
            };
        }
    } catch {
        true;
    }
    const getApi: () => EdgenuityAPI | null = (): EdgenuityAPI | null => {
        const frame = document.getElementById(
            "stageFrame"
        ) as HTMLIFrameElement | null;
        if (!frame) return null;
        const win = frame.contentWindow as StageFrameWindow | null;
        return win?.API ?? null;
    };

    const dispatch: (command: Command) => void = (command: Command): void => {
        const api: EdgenuityAPI | null = getApi();
        switch (command) {
            case "hideBlocker":
                api?.HideBlocker?.();
                break;
            case "backFrame":
                api?.FrameChain?.backFrame?.();
                break;
            case "nextFrame":
                api?.FrameChain?.nextFrame?.();
                break;
            case "checkFrame":
                api?.Frame?.check?.();
                api?.Frame?.check?.();
                document.getElementById("SubmitButton")?.click();
                break;
        }
    };

    window.addEventListener("message", (event: MessageEvent<unknown>): void => {
        if (event.source !== window) return;
        const data = event.data as Partial<RequestMessage> | null;
        if (!data || data.source !== MSG_REQUEST) return;

        const { id, command } = data;
        if (typeof id !== "number" || !command) return;

        let ok: boolean = true;
        let error: string | undefined;
        try {
            dispatch(command);
        } catch (err) {
            ok = false;
            error = err instanceof Error ? err.message : String(err);
        }

        const response: ResponseMessage = error
            ? { source: MSG_RESPONSE, id, ok, error }
            : { source: MSG_RESPONSE, id, ok };
        window.postMessage(response, window.location.origin);
    });

    window.postMessage({ source: SOURCE, ready: true }, window.location.origin);
})();
