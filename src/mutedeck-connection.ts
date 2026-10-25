import { plugin } from "@eniac/flexdesigner";
import {
	type ApiReason,
	type ConnectionState,
	type CustomAction,
	fromAsyncKeyValue,
	MuteDeckClient,
	NotConnectedError,
	osFromPlatform,
	sanitizeVersion,
	type TokenStore,
	type ToggleState,
	type WebSocketLike,
	type WsResponse,
	type WsStatusUpdate,
} from "@mutedeck/plugin-client";
import WebSocket from "ws";

import { version as pluginVersion } from "../com.mutedeck.flexbar.plugin/manifest.json";
import { log } from "./log";

/** Token and per-install id issued by MuteDeck (plugin protocol v2). Never logged. */
type MuteDeckCredentials = {
	token?: string;
	instanceId?: string;
};

/** Shape of the plugin config (FlexDesigner's config.json). */
type PluginConfig = {
	mutedeck?: MuteDeckCredentials;
	[key: string]: unknown;
};

/** Why an action could not be done, for a message on the Flexbar. */
export type ActionFailure = { reason: ApiReason | "not_connected" | "pending" | "denied" | "error" };

export type ConnectionListener = {
	onState(state: ConnectionState, previous: ConnectionState): void;
	onStatus(status: WsStatusUpdate): void;
	onFailure(action: string, failure: ActionFailure): void;
};

/**
 * Connection to MuteDeck through the MuteDeck plugin SDK (`@mutedeck/plugin-client`).
 * Speaks plugin protocol v2 (hello, user approval, token) and falls back to v1 for old MuteDeck versions.
 */
export class MuteDeckConnection {
	private readonly client: MuteDeckClient;

	constructor(
		private readonly listener: ConnectionListener,
		hostVersion?: string,
	) {
		this.client = new MuteDeckClient({
			client: {
				id: "flexbar",
				name: "Flexbar",
				version: sanitizeVersion(pluginVersion),
				host_app: "flexdesigner",
				host_version: sanitizeVersion(hostVersion?.replace(/^v/, "")),
				os: osFromPlatform(process.platform),
			},
			role: "controller",
			// MuteDeck drops v1 messages from sources it doesn't know.
			v1Source: "plugin",
			webSocketFactory: (url) => new WebSocket(url) as unknown as WebSocketLike,
			tokenStore: createTokenStore(),
			logger: {
				debug: (message, ...args) => {
					log.debug(message, ...args);
				},
				info: (message, ...args) => {
					log.info(message, ...args);
				},
				warn: (message, ...args) => {
					log.warn(message, ...args);
				},
				error: (message, ...args) => {
					log.error(message, ...args);
				},
			},
		});

		this.client.on("state", (state, previous) => {
			log.info(`MuteDeck connection: ${previous} -> ${state}`);
			this.listener.onState(state, previous);
		});
		this.client.on("status", (status) => this.listener.onStatus(status));
		this.client.on("approved", () => {
			log.info("MuteDeck approved this plugin.");
		});
		this.client.on("denied", ({ reason }) => {
			log.warn(`MuteDeck denied this plugin (${reason}).`);
		});
		this.client.on("revoked", () => {
			log.warn("MuteDeck revoked this plugin's access.");
		});
		this.client.connect();
	}

	get state(): ConnectionState {
		return this.client.state;
	}

	/** True once actions can be sent (v2 authenticated, or an old v1 MuteDeck). */
	get isReady(): boolean {
		return this.client.isReady;
	}

	get lastStatus(): WsStatusUpdate | undefined {
		return this.client.lastStatus;
	}

	get customActions(): CustomAction[] {
		return this.client.customActions ?? [];
	}

	toggleMute(state: ToggleState): void {
		this.run("toggle_mute", () => this.client.toggleMute(state));
	}

	toggleVideo(state: ToggleState): void {
		this.run("toggle_video", () => this.client.toggleVideo(state));
	}

	toggleShare(state: ToggleState): void {
		this.run("toggle_share", () => this.client.toggleShare(state));
	}

	toggleRecord(state: ToggleState): void {
		this.run("toggle_record", () => this.client.toggleRecord(state));
	}

	leaveMeeting(): void {
		this.run("leave_meeting", () => this.client.leaveMeeting());
	}

	bringToFront(): void {
		this.run("bring-to-front", () => this.client.bringToFront());
	}

	customAction(name: string): void {
		this.run("custom-action", () => this.client.customAction(name));
	}

	/** Sends a MuteDeck action by name, e.g. `react-applause`. */
	direct(action: string): void {
		this.run(action, () => this.client.send(action));
	}

	async listCustomActions(): Promise<CustomAction[]> {
		return this.client.listCustomActions();
	}

	async resetPairing(): Promise<void> {
		await this.client.resetPairing();
	}

	/** Sends one action; keys don't wait for it. Failures go to the listener. */
	private run(action: string, request: () => Promise<WsResponse>): void {
		if (!this.client.isReady) {
			const state = this.client.state;
			this.listener.onFailure(action, { reason: state === "pending" || state === "denied" ? state : "not_connected" });
			return;
		}
		log.info(`Sending '${action}' to MuteDeck.`);
		request()
			.then((response) => {
				if (response.status >= 400) {
					log.warn(`MuteDeck rejected '${action}': ${response.status} ${response.reason ?? ""}`.trim());
					this.listener.onFailure(action, { reason: response.reason ?? "error" });
				}
			})
			.catch((error: unknown) => {
				if (error instanceof NotConnectedError) {
					this.listener.onFailure(action, { reason: "not_connected" });
				} else {
					log.error(`Sending '${action}' to MuteDeck failed: ${error instanceof Error ? error.message : String(error)}`);
					this.listener.onFailure(action, { reason: "error" });
				}
			});
	}
}

/**
 * Stores the MuteDeck token and instance id under `mutedeck` in the plugin config,
 * keeping any other config as it is.
 */
function createTokenStore(): TokenStore {
	const read = async (): Promise<PluginConfig> => ((await plugin.getConfig()) as PluginConfig | null) ?? {};
	return fromAsyncKeyValue(
		async () => (await read()).mutedeck,
		async (_key, value) => {
			const credentials: MuteDeckCredentials = {};
			if (value.token) {
				credentials.token = value.token;
			}
			if (value.instanceId) {
				credentials.instanceId = value.instanceId;
			}
			await plugin.setConfig({ ...(await read()), mutedeck: credentials });
		},
		async () => {
			const { mutedeck: _removed, ...rest } = await read();
			await plugin.setConfig(rest);
		},
	);
}
