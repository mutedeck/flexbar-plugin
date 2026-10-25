import type { WsStatusUpdate } from "@mutedeck/plugin-client";

export const UUID = "com.mutedeck.flexbar";

/** Status keys are multiState keys; the state order is fixed by scripts/generate-manifest.mjs. */
export const STATE = { inactive: 0, active: 1, disabled: 2 } as const;

export type StatusKind = "togglemute" | "togglevideo" | "togglesharing" | "togglerecording" | "leavemeeting";
export type ActionKind = "bring-to-front" | "custom-action" | "preset";
export type KeyKind = StatusKind | ActionKind;

const STATUS_KINDS: readonly StatusKind[] = ["togglemute", "togglevideo", "togglesharing", "togglerecording", "leavemeeting"];
const ACTION_KINDS: readonly ActionKind[] = ["bring-to-front", "custom-action"];

/** Which MuteDeck status field drives each status key. */
const STATUS_FIELD = {
	togglemute: "mute",
	togglevideo: "video",
	togglesharing: "share",
	togglerecording: "record",
	leavemeeting: "call",
} as const satisfies Record<StatusKind, keyof WsStatusUpdate>;

/** `com.mutedeck.flexbar.togglemute` → `togglemute`; `com.mutedeck.flexbar.preset.zoom.raise-hand` → `preset`. */
export function kindOf(cid: string): KeyKind | undefined {
	if (!cid.startsWith(`${UUID}.`)) {
		return undefined;
	}
	const name = cid.slice(UUID.length + 1);
	if (name.startsWith("preset.")) {
		return "preset";
	}
	return [...STATUS_KINDS, ...ACTION_KINDS].find((kind) => kind === name);
}

export function isStatusKind(kind: KeyKind | undefined): kind is StatusKind {
	return STATUS_KINDS.includes(kind as StatusKind);
}

/**
 * The multiState index a status key should show.
 * Without a usable MuteDeck connection, toggles show "disabled" and Leave shows "inactive".
 */
export function stateFor(kind: StatusKind, status: WsStatusUpdate | undefined, connected: boolean): number {
	const value = connected ? status?.[STATUS_FIELD[kind]] : undefined;
	if (kind === "leavemeeting") {
		return value === "active" ? STATE.active : STATE.inactive;
	}
	switch (value) {
		case "active":
			return STATE.active;
		case "inactive":
			return STATE.inactive;
		default:
			return STATE.disabled;
	}
}
