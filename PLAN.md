# MuteDeck plugin for Flexbar — plan

Status: feasibility check done (2026-10-25). Nothing scaffolded yet.

## Decisions (2026-10-25)

- Repo: `mutedeck/flexbar-plugin` (also the manifest `repo` link that FlexDesigner auto-updates from).
- v1 aims for Stream Deck parity, push-to-talk included (see gotcha 2).
- One plugin. No per-app variants; app presets go in keyLibrary subpages.
- No Flexbar device on hand. We build our own simulator (see below) and get real hardware before release.
- Platform: build on **v1 (FlexDesigner)** now, and ask ENIAC about FlexStudio (see below) in parallel.
- The simulator lives in its own local repo, `../flexbar-simulator` (built and committed 2026-10-25; 11 end-to-end tests pass).

## FlexStudio / plugin SDK v2 (found 2026-10-25)

ENIAC is building **FlexStudio**, a successor to FlexDesigner. It comes with a new plugin SDK, `@flexsdk/runtime` / `@flexsdk/types` with `flexcli plugin-v2`, and supports new devices (FlexbarV2, Flow2Pro). The docs are a snapshot inside `ENIAC-Tech/flex-plugin-template` (in Chinese), and the template was updated 2026-10-23. The packages are **not on npm** and FlexStudio isn't public yet.

v2 is a better fit for MuteDeck:
- native `pressed`/`released` unit events, so push-to-talk works without Direct Draw;
- `cycled` units with confirmed state sync and an indicator;
- `button-group` units;
- a permissions model;
- a marketplace that publishes from GitHub Releases.

Plan: keep the MuteDeck connection, key-state and rendering logic host-agnostic, so a later v2 port only swaps the host layer. Ask ENIAC for:
1. the FlexStudio timeline;
2. whether FlexStudio runs v1 plugins;
3. beta access to FlexStudio and FlexSDK2.

## Verdict: feasible

A Flexbar plugin is a Node.js backend plus optional Vue 3 config pages. That is the same shape as the Stream Deck plugin, so we can reuse most of its design and all of `@mutedeck/plugin-client`.

| Need | Flexbar SDK | Notes |
|---|---|---|
| Long-running process with a WebSocket client | Backend runs as a Node child process of FlexDesigner. Locally that's Electron 38, which ships Node 22. | `@mutedeck/plugin-client` works as-is. The SDK already depends on `ws`, so we use the same `webSocketFactory` as Stream Deck. |
| Key press → action | `plugin.on('plugin.data')`, `evt: "click"` | Default and multi-state keys. |
| Live state on keys | `plugin.setMultiState(sn, key, state)`, `plugin.draw(sn, key, 'base64', png)` | Status push → redraw all alive keys. |
| Track which keys exist | `plugin.alive` / `plugin.dead` with `{serialNumber, keys[]}` | Plays the role of Stream Deck `willAppear`/`willDisappear`. Keep a map keyed by `serialNumber + key.uid`. |
| Persist token + instance id | `plugin.getConfig()` / `plugin.setConfig()` (stored in `config.json`) | Back `TokenStore` with `fromAsyncKeyValue`, like `createTokenStore()` in the Stream Deck plugin. |
| Per-key settings (property inspector) | `ui/<cid>.vue`. Settings land in `key.data` (`modelValue`). | Toggle/on/off mode, show label, custom-action picker. |
| Global settings / connection status | `manifest.configPage` (a Vue page). The UI talks to the backend through `ui.message`. | Shows pending/approved/denied, plus a "reset pairing" button. |
| Feedback on device | `showFlexbarSnackbarMessage`, `sendControlCommand('hapic.click')` | For example "Approve Flexbar in MuteDeck", or "Not in a call". |
| Packaging | `flexcli plugin pack` → `.flexplugin`. The GitHub Release tag must equal the manifest version. FlexGate is the store. | The plugin dir must sit at the repo root for "install from repo" to work. |

## Gotchas found

1. **The docs name the wrong npm packages.** The real ones are `@eniac/flexdesigner` (SDK, currently 1.0.9) and `@eniac/flexcli`. The `@eniactech/*` names in the docs return 404 on npm.
2. **There are no separate key-down/key-up events.** Default keys only send `click`. Hold-to-talk (Stream Deck `push-to-talk`) has no direct mapping. Options:
   - a) skip PTT in v1;
   - b) build PTT on a Direct Draw key, which reports `device.touch` with `down/pressing/up/end` (needs SDK 1.0.7+);
   - c) use a wheel key's `start`/`end` (a hack).
   Decision: v1 aims for parity, so we go with (b). Risk: the docs call Direct Draw "an empty page" with `offsetX` from 0 to 2170 (the full bar width). If a Direct Draw key takes over the whole strip instead of sitting inline at its own width, PTT becomes a dedicated page rather than a normal key. Only a real device can settle this.
3. **Multi-state keys change state locally when tapped.** We must call `setMultiState` again when MuteDeck's status arrives, otherwise a failed toggle (for example "not in a call") leaves the key showing the wrong state.
4. **A handler must not return the logger.** `plugin.on('x', (p) => logger.info(p))` returns the winston instance, the SDK can't JSON-encode it as the reply, and the host never gets an answer. The simulator caught this; always use block bodies.
5. Bundles are **CommonJS** (`"type": "commonjs"`, `entry: backend/plugin.cjs`). `@mutedeck/plugin-client` ships CJS, so this is fine.
6. Built-in modules: `@napi-rs/canvas`, `express`, `axios`. Canvas lets us render key images at runtime if static PNGs aren't enough.
7. Key height is fixed at 60px and widths are variable (60–1000px). That's a wide, short strip, so Stream Deck square icons need re-cut art.
8. Competitor: `KhaosCoders/flexdesigner-coms-plugin` (Teams/Slack control, Windows-only via `win-audio-fork`). We can win on cross-app coverage and macOS support.

## MuteDeck side

- Client identity: `{ id: "flexbar", name: "Flexbar", host_app: "flexdesigner", host_version, os }`. Fill it from `plugin.getAppInfo()` (`{version, platform}`), and use `osFromPlatform()` / `sanitizeVersion()` from the SDK.
  - Optional: add `hosts/flexdesigner.ts` to `mutedeck-plugin-sdk`, next to `streamdeck.ts` and `raycast.ts`.
- `v1Source` must stay `"plugin"`, because MuteDeck drops v1 messages from unknown sources.
- Check that MuteDeck's usage stats and Settings show the new `flexbar` client id properly. No server allowlist was found in the spec; `client.id` is a free slug.

## Proposed architecture (TypeScript, mirrors the Stream Deck plugin)

```
flexbar-plugin/
  package.json, rollup.config.mjs, tsconfig.json   (from flexcli template, converted to TS)
  com.mutedeck.flexbar.plugin/
    manifest.json        keyLibrary: Mute, Video, Share, Record, Leave, Bring to front,
                         Custom action, Presets subpage (raise hand, reactions, chat...)
    backend/plugin.cjs   (build output)
    resources/           key art (60px-tall strips), disabled variants
    ui/                  configPage.vue + one <cid>.vue per configurable key
  src/
    plugin.ts            wiring: plugin.start(), alive/dead/data handlers
    mutedeck-connection.ts  MuteDeckClient + TokenStore on plugin config (port of SD version)
    key-registry.ts      Map<sn:uid, {sn, key}>; kept current by alive/dead
    actions/             one handler per cid (toggle-mute, toggle-video, ...)
    key-renderer.ts      status → multiState index / base64 image + label
```

Key types:
- Toggles: `multiState` with 3 states (on, off, disabled), and `setMultiState` driven by status.
- Leave, Bring to front, Custom, Presets: `default` keys; dim them with `draw` when not in a call.
- Stretch: a **"Meeting strip"** `dynamic` key. One wide key with up to 16 child keys (mute/video/share/record/leave plus custom actions), rendered at runtime. Nothing comparable exists on Stream Deck, so it's a good selling point.

## Simulator (no official one exists)

FlexDesigner 2.2.3 has no device simulator. The "TouchBar simulator" strings in its main process belong to the Mac Touch Bar mirroring tool, not to a Flexbar simulator. Without a device, `plugin.alive` never fires, so no key events reach the plugin.

The host↔plugin protocol is small, and the SDK source (`@eniac/flexdesigner`, unminified) documents it fully:
- FlexDesigner launches the backend as `node backend/plugin.cjs --port=<p> --uid=<uuid> --dir=<pluginDir>`.
- The plugin connects to `ws://localhost:<p>` and sends `startup`.
- Every message is `{pluginID, type, payload, timestamp, uuid}`. Calls are answered with `{type:"response", uuid, status:"success", payload}`, and the plugin answers host events the same way.
- Plugin → host: `draw`, `direct-draw`, `dynamic-plugin` (add/remove/move/draw/update/setWidth/refresh/clear), `set` (multiState/slider), `show-snackbar-message`, `control-command`, `device-config`, `update-shortcuts`, `ui-operation`, `custom-chart-data`, `api-call` (getConfig/setConfig/getAppInfo/…).
- Host → plugin: `plugin.alive`, `plugin.dead`, `plugin.data`, `device.status`, `device.touch`, `ui.message`, `plugin.config.updated`, `system.*`.

**Built in `../flexbar-simulator` (separate local repo), a dev-only fake FlexDesigner.**
- A Node WS server spawns the built plugin with those args and answers its calls. `getConfig`/`setConfig` persist to a JSON file.
- It reads `manifest.json` keyLibrary, so you can place keys on a virtual 2170×60 strip.
- A browser UI renders the strip:
  - `base64` draws are shown as-is;
  - `draw` (style-based) is approximated with the MDI webfont + bgColor + title;
  - multi-state, dynamic child keys and Direct Draw frames are rendered too.
- Tapping a key sends `plugin.data` (click / next multiState index). Mouse down/up on a Direct Draw area sends `device.touch` down/pressing/up, which is enough to test PTT.
- Buttons for device connect/disconnect (`device.status`), key removal (`plugin.dead`), and showing snackbars/haptics as toasts.
- Effort: about 1–2 days for something useful. It's reusable for any Flexbar plugin, and no public tool like it exists, so it could be open-sourced.
- Limits: it reproduces the protocol, not the device. The exact `KeyData` fields, multi-state local flip timing, Direct Draw page-vs-inline behaviour, and touch timing are best guesses until checked on hardware. The Vue config pages still need to be tested inside the real FlexDesigner, which should load plugins without a device.

## Phases

- **P0 Scaffold:** `npm i -g @eniac/flexcli`, `flexcli plugin create` (uuid `com.mutedeck.flexbar`), convert to TS, add `@mutedeck/plugin-client`, and check that `npm run dev` links into FlexDesigner 2.2.3.
- **P0.5 Simulator:** ✅ done in `../flexbar-simulator`. Run it with `node ../flexbar-simulator/bin/flexbar-sim.js com.mutedeck.flexbar.plugin`.
- ✅ 2026-10-25: P0 scaffold, P1 connection, P2 core keys and the P4 presets/custom-action backend are done. Verified in the simulator against the real MuteDeck 4.12 (v2 approval, live mute state, "Not in a meeting" snackbar). Push-to-talk is deferred.
- ✅ 2026-10-25: P3 settings pages (toggle mode, custom-action picker, connection/reset pairing), the clean release build (`npm run release`) and the tag-triggered GitHub release workflow are done. Version 0.9.0 is the first tester build.
- **P1 Connection:** port `mutedeck-connection.ts`, add the config-backed TokenStore, and test the v2 approval flow end to end, including a snackbar while pending.
- **P2 Core keys:** mute, video, share, record (toggle/on/off), leave, and bring to front, with live state and disabled handling.
- **P3 Config UI:** Vue pages for per-key mode/label settings and the global connection status page.
- **P4 Custom actions + presets:** the list comes from `listCustomActions()` via `ui.message`, and the presets subpage is generated from the Stream Deck `PRESET_ACTION_DEFS`.
- **P5 Art:** re-cut icons for the 60px strip, plus disabled variants.
- **P6 Parity + extras:** PTT on Direct Draw (required for v1), then the Meeting strip dynamic key (stretch).
- **P6.5 Hardware check:** borrow/buy a Flexbar, or ask ENIAC for a dev unit. Verify the simulator assumptions before release.
- **P7 Release:** GitHub Actions `.flexplugin` (check whether per-OS builds are needed; probably not), then FlexGate submission and a help-center page.

## Open questions

1. Hardware: buy a Flexbar or ask ENIAC (they run FlexGate and might want a MuteDeck plugin) for a dev unit? It's needed before release, not before starting.

## Reference

- Docs: https://flexdocumentation.readthedocs.io/en/latest/sdk/index.html
- Official template / example / SDK source: `ENIAC-Tech/flex-plugin-template`, `ENIAC-Tech/flexdesigner-sdk`
- Behaviour spec: `../streamdeck-plugin-nodejs/src` (connection, status handler, preset defs)
