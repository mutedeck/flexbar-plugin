// Generates com.mutedeck.flexbar.plugin/manifest.json from the key tables below.
// Run: npm run manifest   (the generated manifest is committed)
import fs from 'node:fs'

const PLUGIN_DIR = 'com.mutedeck.flexbar.plugin'
const UUID = 'com.mutedeck.flexbar'
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

const PLATFORMS = ['windows', 'mac']
const GREY = '#424242'

/** Key Library sidebar icon: the MuteDeck logo as a base64 PNG (shown at 25px, so 48px covers 2x screens). */
const LIBRARY_ICON = `data:image/png;base64,${fs.readFileSync('assets/mutedeck-icon-48.png').toString('base64')}`
const DIM = '#9E9E9E'

/**
 * Status keys are multiState keys. State order is fixed and shared with src/key-state.ts:
 * 0 = inactive, 1 = active, 2 = disabled (toggles only).
 */
const STATUS_KEYS = [
  {
    id: 'togglemute', title: '$Mute.Title', tip: '$Mute.Tip', toggle: true, settings: 'Mute',
    states: [
      { icon: 'mdi mdi-microphone', bgColor: '#2E7D32' },
      { icon: 'mdi mdi-microphone-off', bgColor: '#C62828' },
      { icon: 'mdi mdi-microphone-off', bgColor: GREY, fgColor: DIM },
    ],
  },
  {
    id: 'togglevideo', title: '$Video.Title', tip: '$Video.Tip', toggle: true, settings: 'Video',
    states: [
      { icon: 'mdi mdi-video-off', bgColor: '#C62828' },
      { icon: 'mdi mdi-video', bgColor: '#2E7D32' },
      { icon: 'mdi mdi-video-off', bgColor: GREY, fgColor: DIM },
    ],
  },
  {
    id: 'togglesharing', title: '$Share.Title', tip: '$Share.Tip', toggle: true, settings: 'Share',
    states: [
      { icon: 'mdi mdi-monitor-share', bgColor: '#37474F' },
      { icon: 'mdi mdi-monitor-share', bgColor: '#1565C0' },
      { icon: 'mdi mdi-monitor-off', bgColor: GREY, fgColor: DIM },
    ],
  },
  {
    id: 'togglerecording', title: '$Record.Title', tip: '$Record.Tip', toggle: true, settings: 'Record',
    states: [
      { icon: 'mdi mdi-record-circle-outline', bgColor: '#37474F' },
      { icon: 'mdi mdi-record-rec', bgColor: '#C62828' },
      { icon: 'mdi mdi-record-circle-outline', bgColor: GREY, fgColor: DIM },
    ],
  },
  {
    id: 'leavemeeting', title: '$Leave.Title', tip: '$Leave.Tip', toggle: false,
    states: [
      { icon: 'mdi mdi-phone-hangup', bgColor: GREY, fgColor: DIM },
      { icon: 'mdi mdi-phone-hangup', bgColor: '#C62828' },
    ],
  },
]

const ACTION_KEYS = [
  { id: 'bring-to-front', title: '$BringToFront.Title', tip: '$BringToFront.Tip', icon: 'mdi mdi-arrange-bring-to-front', data: {} },
  { id: 'custom-action', title: '$CustomAction.Title', tip: '$CustomAction.Tip', icon: 'mdi mdi-lightning-bolt', data: { custom_action: '' } },
]

/**
 * Meeting-app presets, ported from the Stream Deck plugin (manifests/preset-actions.json).
 * `direct: true` sends the action name itself; otherwise it goes through `custom-action`.
 */
const PRESET_ICONS = {
  'live-caption': 'mdi mdi-closed-caption',
  'raise-hand': 'mdi mdi-hand-back-right',
  'react-applause': 'mdi mdi-hand-clap',
  'react-clap': 'mdi mdi-hand-clap',
  'react-heart': 'mdi mdi-heart',
  'react-laugh': 'mdi mdi-emoticon-lol',
  'react-like': 'mdi mdi-thumb-up',
  'react-love': 'mdi mdi-heart',
  'react-tada': 'mdi mdi-party-popper',
  'react-thumbs-up': 'mdi mdi-thumb-up',
  'react-wow': 'mdi mdi-emoticon-excited',
  'toggle-chat': 'mdi mdi-chat',
  'toggle-participants': 'mdi mdi-account-group',
}
const APPS = [
  { id: 'zoom', title: 'Zoom', color: '#0B5CFF', presets: ['raise-hand', 'react-clap', 'react-heart', 'react-laugh', 'react-tada', 'react-thumbs-up', 'react-wow', 'toggle-chat', 'toggle-participants'] },
  { id: 'teams', title: 'Microsoft Teams', color: '#5B5FC7', presets: ['raise-hand', 'react-applause', 'react-laugh', 'react-like', 'react-love', 'react-wow', 'toggle-chat'], direct: ['react-applause', 'react-laugh', 'react-like', 'react-love', 'react-wow'] },
  { id: 'google-meet', title: 'Google Meet', color: '#00897B', presets: ['live-caption', 'raise-hand', 'toggle-chat', 'toggle-participants'] },
]

const statusKey = (key) => ({
  title: key.title,
  tip: key.tip,
  cid: `${UUID}.${key.id}`,
  config: { keyType: 'multiState', platform: PLATFORMS },
  style: { icon: key.states[0].icon, width: 140, multiStyle: key.states },
  data: key.toggle ? { action_type: 'toggle' } : {},
})

const actionKey = (key) => ({
  title: key.title,
  tip: key.tip,
  cid: `${UUID}.${key.id}`,
  config: { keyType: 'default', clickable: true, platform: PLATFORMS },
  style: { icon: key.icon, width: 140, bgColor: '#37474F' },
  data: key.data,
})

const presetKey = (app, action) => ({
  title: `$Preset.${action}`,
  tip: `${app.title}`,
  cid: `${UUID}.preset.${app.id}.${action}`,
  config: { keyType: 'default', clickable: true, platform: PLATFORMS },
  style: { icon: PRESET_ICONS[action], width: 120, bgColor: app.color },
  data: { action, direct: (app.direct ?? []).includes(action) },
})

const subpage = (title, children) => ({
  title,
  cid: 'com.eniac.navigation.page',
  style: { icon: 'mdi mdi-folder-outline', width: 240 },
  data: { path: '', win: [] },
  children,
})

const manifest = {
  name: 'MuteDeck',
  uuid: UUID,
  version: pkg.version,
  author: 'MuteDeck',
  entry: 'backend/plugin.cjs',
  description: 'Control Zoom, Teams, Google Meet and more from your Flexbar: mute, video, share, record, leave, reactions and custom actions.',
  repo: 'https://github.com/mutedeck/flexbar-plugin',
  sdk: { version: '1.0.0' },
  software: { minimumVersion: '1.0.0' },
  os: [
    { platform: 'mac', minimumVersion: '10.15' },
    { platform: 'windows', minimumVersion: '10' },
  ],
  device: [{ name: 'flexbar', version: '1.0.0' }],
  configPage: 'config',
  keyLibrary: {
    title: '$PluginName',
    style: { icon: LIBRARY_ICON },
    children: [
      ...STATUS_KEYS.map(statusKey),
      ...ACTION_KEYS.map(actionKey),
      ...APPS.map((app) => subpage(app.title, app.presets.map((action) => presetKey(app, action)))),
    ],
  },
  local: {
    en: {
      PluginName: 'MuteDeck',
      Mute: { Title: 'Mute', Tip: 'Mute or unmute your microphone' },
      Video: { Title: 'Video', Tip: 'Turn your camera on or off' },
      Share: { Title: 'Share', Tip: 'Start or stop screen sharing' },
      Record: { Title: 'Record', Tip: 'Start or stop recording' },
      Leave: { Title: 'Leave', Tip: 'Leave the meeting' },
      BringToFront: { Title: 'Bring to front', Tip: 'Bring the meeting window to the front' },
      CustomAction: { Title: 'Custom action', Tip: 'Run one of your MuteDeck custom actions' },
      Settings: {
        WhenTapped: 'When tapped',
        Mute: { Toggle: 'Toggle mute', On: 'Always mute', Off: 'Always unmute' },
        Video: { Toggle: 'Toggle camera', On: 'Always turn the camera on', Off: 'Always turn the camera off' },
        Share: { Toggle: 'Toggle screen sharing', On: 'Always start sharing', Off: 'Always stop sharing' },
        Record: { Toggle: 'Toggle recording', On: 'Always start recording', Off: 'Always stop recording' },
        CustomAction: {
          Label: 'Custom action',
          Hint: 'Pick one of your MuteDeck custom actions, or type its name.',
          BuiltIn: 'built-in',
          Refresh: 'Reload list',
          NotConnected: "MuteDeck isn't connected, so the list can't load. You can still type the action name.",
          NotLicensed: 'Custom actions need MuteDeck Pro.',
          LoadFailed: "Couldn't load your custom actions from MuteDeck.",
        },
        Connection: {
          Title: 'MuteDeck connection',
          Reset: 'Reset pairing',
          ResetDone: 'Pairing reset. Allow Flexbar in MuteDeck again.',
          Connected: { Label: 'Connected', Help: 'The Flexbar is connected to MuteDeck.' },
          ConnectedLegacy: { Label: 'Connected', Help: 'Connected to an older MuteDeck version. Update MuteDeck for the latest features.' },
          Pending: { Label: 'Waiting for approval', Help: 'Open MuteDeck and allow "Flexbar" to control it.' },
          Denied: { Label: 'Access denied', Help: 'MuteDeck denied this plugin. It will ask again shortly, or use Reset pairing to ask now.' },
          Connecting: { Label: 'Connecting…', Help: 'Looking for MuteDeck on this computer.' },
          NotRunning: { Label: 'MuteDeck not running', Help: 'Start MuteDeck on this computer. The Flexbar connects automatically.' },
        },
      },
      Preset: {
        'live-caption': 'Live captions',
        'raise-hand': 'Raise hand',
        'react-applause': 'Applause',
        'react-clap': 'Clap',
        'react-heart': 'Heart',
        'react-laugh': 'Laugh',
        'react-like': 'Like',
        'react-love': 'Love',
        'react-tada': 'Tada',
        'react-thumbs-up': 'Thumbs up',
        'react-wow': 'Wow',
        'toggle-chat': 'Chat',
        'toggle-participants': 'Participants',
      },
    },
  },
}

fs.writeFileSync(`${PLUGIN_DIR}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)

// Settings pages: FlexDesigner loads ui/<cid without the plugin uuid>.vue for a key.
const toggleTemplate = fs.readFileSync('scripts/templates/toggle-key.vue', 'utf8')
for (const key of STATUS_KEYS.filter((k) => k.settings)) {
  fs.writeFileSync(`${PLUGIN_DIR}/ui/${key.id}.vue`, toggleTemplate.replaceAll('__KEY__', key.settings))
}
console.log(`Wrote ${PLUGIN_DIR}/manifest.json (${manifest.keyLibrary.children.length} top-level entries)`)
