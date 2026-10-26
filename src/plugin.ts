import { plugin } from "@eniac/flexdesigner";
import type { KeyData, MessageLevel } from "@eniac/flexdesigner/dist/types.js";
import type { ConnectionState, ToggleState } from "@mutedeck/plugin-client";

import { isStatusKind, kindOf, stateFor, type StatusKind } from "./keys";
import { log } from "./log";
import { type ActionFailure, MuteDeckConnection } from "./mutedeck-connection";

/**
 * Event handlers must not return a value the SDK can't JSON-encode (for example the logger:
 * `(p) => log.info(p)` returns the winston instance and the reply is never sent).
 * All handlers below use block bodies for that reason.
 */

type LiveKey = { serialNumber: string; key: KeyData; shownState?: number };

/** Keys currently on a Flexbar screen, by `<serialNumber>:<uid>`. */
const liveKeys = new Map<string, LiveKey>();
const devices = new Set<string>();
const id = (serialNumber: string, key: KeyData): string => `${serialNumber}:${key.uid}`;

let mutedeck: MuteDeckConnection | undefined;

// ---------------------------------------------------------------- MuteDeck

/** Starts the MuteDeck connection once FlexDesigner is talking to us (getAppInfo needs the socket). */
function startMuteDeck(): void {
	if (mutedeck) {
		return;
	}
	const connect = (hostVersion?: string): void => {
		mutedeck ??= new MuteDeckConnection(
			{
				onState: handleConnectionState,
				onStatus: () => {
					refreshStatusKeys();
				},
				onFailure: handleFailure,
			},
			hostVersion,
		);
	};
	plugin
		.getAppInfo()
		.then((info) => {
			connect(info?.version);
		})
		.catch(() => {
			connect();
		});
}

function handleConnectionState(state: ConnectionState, previous: ConnectionState): void {
	refreshStatusKeys();
	if (state === "pending" && previous !== "pending") {
		notifyAll("Allow Flexbar in MuteDeck to continue", "info", "bell", 8000);
	} else if ((state === "authenticated" && previous === "pending") || (state === "v1" && previous !== "v1")) {
		notifyAll("Connected to MuteDeck", "success", "ok");
	} else if (state === "denied" && previous !== "denied") {
		notifyAll("MuteDeck denied access", "error", "close", 4000);
	}
}

const FAILURE_MESSAGES: Partial<Record<ActionFailure["reason"], string>> = {
	not_connected: "MuteDeck is not running",
	pending: "Allow Flexbar in MuteDeck first",
	denied: "MuteDeck denied access",
	not_in_call: "Not in a meeting",
	not_licensed: "Needs MuteDeck Pro",
	not_found: "Custom action not found",
	rate_limited: "Too many actions, slow down",
};

function handleFailure(action: string, failure: ActionFailure): void {
	notifyAll(FAILURE_MESSAGES[failure.reason] ?? `MuteDeck could not do ${action}`, "warning", "warning");
	// A tapped toggle may show a state MuteDeck never confirmed; put it back.
	refreshStatusKeys(true);
}

// ---------------------------------------------------------------- key rendering

/** Sets every status key to MuteDeck's state. `force` re-sends even when unchanged (after a tap). */
function refreshStatusKeys(force = false): void {
	for (const live of liveKeys.values()) {
		const kind = kindOf(live.key.cid);
		if (isStatusKind(kind)) {
			showState(live, kind, force);
		}
	}
}

function showState(live: LiveKey, kind: StatusKind, force: boolean): void {
	const state = stateFor(kind, mutedeck?.lastStatus, mutedeck?.isReady ?? false);
	if (!force && live.shownState === state) {
		return;
	}
	live.shownState = state;
	plugin.setMultiState(live.serialNumber, live.key, state).catch((error: unknown) => {
		log.warn(`setMultiState failed for ${live.key.cid}#${live.key.uid}: ${String(error)}`);
	});
}

function notifyAll(message: string, level: MessageLevel, icon: "ok" | "close" | "bell" | "warning", timeout = 2500): void {
	for (const serialNumber of devices) {
		plugin.showFlexbarSnackbarMessage(serialNumber, message, level, icon, timeout).catch((error: unknown) => {
			log.warn(`Snackbar failed: ${String(error)}`);
		});
	}
}

// ---------------------------------------------------------------- taps

function toggleState(key: KeyData): ToggleState {
	const actionType = (key.data as { action_type?: string }).action_type;
	return actionType === "on" || actionType === "off" ? actionType : "toggle";
}

function handleTap(serialNumber: string, key: KeyData): void {
	if (!mutedeck) {
		return;
	}
	const kind = kindOf(key.cid);
	switch (kind) {
		case "togglemute":
			mutedeck.toggleMute(toggleState(key));
			break;
		case "togglevideo":
			mutedeck.toggleVideo(toggleState(key));
			break;
		case "togglesharing":
			mutedeck.toggleShare(toggleState(key));
			break;
		case "togglerecording":
			mutedeck.toggleRecord(toggleState(key));
			break;
		case "leavemeeting":
			mutedeck.leaveMeeting();
			break;
		case "bring-to-front":
			mutedeck.bringToFront();
			break;
		case "custom-action": {
			const name = (key.data as { custom_action?: string }).custom_action;
			if (name) {
				mutedeck.customAction(name);
			} else {
				plugin.showFlexbarSnackbarMessage(serialNumber, "Pick a custom action in the key settings", "info", "settings", 3000).catch(() => undefined);
			}
			break;
		}
		case "preset": {
			const { action, direct } = key.data as { action?: string; direct?: boolean };
			if (action) {
				direct ? mutedeck.direct(action) : mutedeck.customAction(action);
			}
			break;
		}
		default:
			log.warn(`Tap on unknown key ${key.cid}`);
	}

	// The device flips a multiState key on tap. Show MuteDeck's state again until it confirms the change.
	if (isStatusKind(kind)) {
		const live = liveKeys.get(id(serialNumber, key));
		if (live) {
			showState(live, kind, true);
		}
	}
}

// ---------------------------------------------------------------- FlexDesigner events

plugin.on("device.status", (list: Array<{ serialNumber: string; status: string }>) => {
	for (const device of list) {
		if (device.status === "connected") {
			devices.add(device.serialNumber);
		} else {
			devices.delete(device.serialNumber);
			for (const [key, live] of liveKeys) {
				if (live.serialNumber === device.serialNumber) {
					liveKeys.delete(key);
				}
			}
		}
	}
	startMuteDeck();
});

plugin.on("plugin.alive", (payload: { serialNumber: string; keys: KeyData[] }) => {
	devices.add(payload.serialNumber);
	startMuteDeck();
	for (const key of payload.keys) {
		const live: LiveKey = { serialNumber: payload.serialNumber, key };
		liveKeys.set(id(payload.serialNumber, key), live);
		const kind = kindOf(key.cid);
		if (isStatusKind(kind)) {
			showState(live, kind, true);
		}
	}
});

plugin.on("plugin.dead", (payload: { serialNumber: string; keys: KeyData[] }) => {
	for (const key of payload.keys) {
		liveKeys.delete(id(payload.serialNumber, key));
	}
});

/**
 * The reply goes back to the Flexbar: anything but `{ status: "success" }` shows "Operation failed"
 * on the device. MuteDeck's answer comes later, so always acknowledge; failures get their own snackbar.
 */
plugin.on("plugin.data", (payload: { serialNumber: string; data: { key: KeyData } }) => {
	handleTap(payload.serialNumber, payload.data.key);
	return { status: "success" };
});

/** Messages from the config pages (`$fd.sendToBackend`). */
plugin.on("ui.message", async (payload: { action?: string }) => {
	switch (payload?.action) {
		case "status":
			return { state: mutedeck?.state ?? "disconnected", ready: mutedeck?.isReady ?? false };
		case "list-custom-actions":
			if (!mutedeck?.isReady) {
				return { error: "not_connected", actions: [] };
			}
			try {
				return { actions: await mutedeck.listCustomActions() };
			} catch (error) {
				// RequestFailedError carries MuteDeck's reason (e.g. not_licensed); the page shows a message for it.
				const reason = (error as { reason?: string }).reason;
				return { error: reason ?? "failed", actions: mutedeck.customActions };
			}
		case "reset-pairing":
			await mutedeck?.resetPairing();
			return { ok: true };
		default:
			return { error: "unknown_action" };
	}
});

plugin.start();
log.info("MuteDeck Flexbar plugin started");
