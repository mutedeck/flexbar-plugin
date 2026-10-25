# MuteDeck for Flexbar

A [Flexbar](https://eniacelec.com/pages/flexbar) (FlexDesigner) plugin for MuteDeck: mute, video, share, record, leave, bring to front, custom actions, and meeting-app presets (reactions, raise hand, chat, participants, live captions) for Zoom, Teams and Google Meet. (Webex presets were left out on purpose: they're unreliable.)

## How it works

The backend (`src/`, bundled to `com.mutedeck.flexbar.plugin/backend/plugin.cjs`) runs as a Node process inside FlexDesigner. It talks to MuteDeck through `@mutedeck/plugin-client` (plugin protocol v2, falling back to v1 automatically):
- It identifies itself as `flexbar` ("Flexbar").
- The user approves it once in MuteDeck.
- The token is stored in the plugin config (`config.json`) and never logged.

| Key | Type | Behaviour |
|---|---|---|
| Mute, Video, Share, Record | multiState: inactive / active / disabled | `key.data.action_type`: `toggle` (default), `on`, `off`. |
| Leave | multiState: no call / in call | |
| Bring to front, Custom action | default | Custom action uses `key.data.custom_action` (the MuteDeck action name). |
| Presets (subpage per app) | default | `key.data` = `{action, direct}`. When `direct` is true the action is sent as-is; otherwise it goes through `custom-action`. |

The device flips a multiState key as soon as it is tapped. The plugin puts the key back to MuteDeck's last known state right away and only changes it when MuteDeck's status update confirms. A failed action (not in a meeting, not running, not approved, etc.) shows a message on the Flexbar.

`manifest.json` and the four toggle settings pages (`ui/toggle*.vue`) are generated: edit `scripts/generate-manifest.mjs` or `scripts/templates/toggle-key.vue` and run `npm run manifest`. `ui/custom-action.vue` and `ui/config.vue` are hand-written.

Settings pages (FlexDesigner loads `ui/<cid without "com.mutedeck.flexbar.">.vue` for a key, and `configPage` for the plugin):
- **Mute / Video / Share / Record:** what a tap does (toggle, always on, always off).
- **Custom action:** pick from MuteDeck's custom actions list, or type a name.
- **Plugin settings (`config.vue`):** MuteDeck connection state and a **Reset pairing** button.

## Development

```
npm install
npm run build        # → com.mutedeck.flexbar.plugin/backend/plugin.cjs
npm run sim          # run it in ../flexbar-simulator (no Flexbar needed)
npm run typecheck
```

With FlexDesigner and a Flexbar, `npm run dev` links the plugin, rebuilds on change and restarts it (`flexcli` is a dev dependency).

## Releasing

```
npm run release      # → release/mutedeck-flexbar-<version>.flexplugin
```

The release script regenerates the manifest, makes a minified production build, and packs from a clean staging copy in `build/stage`. That way `config.json` (which holds the MuteDeck token when the plugin is linked for development), logs and dev source maps never end up in the package.

To publish:
1. Bump `version` in `package.json` and run `npm run manifest`.
2. Commit, then push a matching tag (`v0.9.0`).
3. `.github/workflows/release.yml` builds, checks the tag against the version, and attaches the `.flexplugin` to a GitHub Release.

FlexDesigner installs and updates plugins from the latest Release's `.flexplugin` asset, through the `repo` link in the manifest. That only works once the repo is public; until then, hand the `.flexplugin` file out directly.

**Gotcha:** an SDK event handler must not return the logger. `(p) => logger.info(p)` returns the winston instance, the SDK can't send it as the reply, and FlexDesigner never gets an answer. Use block bodies.

## Not done yet

- Push-to-talk (deferred; would need a Direct Draw page on v1, or FlexStudio's press/release events).
- FlexGate submission (and making the repo public, so FlexDesigner's install-from-repo and auto-update work).

See `PLAN.md` for the full plan and the FlexStudio (SDK v2) notes.
