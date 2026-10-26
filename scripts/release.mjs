// Builds a clean .flexplugin into release/: regenerate the manifest, production bundle (minified, no
// source map), then pack from a staging copy so local state (config.json with the MuteDeck token,
// logs, dev source maps) can never end up in the package.
// Run: npm run release   (CI runs the same on a v* tag)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PLUGIN_DIR = 'com.mutedeck.flexbar.plugin'
const STAGE_ROOT = path.join('build', 'stage')
const STAGE = path.join(STAGE_ROOT, PLUGIN_DIR)
const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const shell = process.platform === 'win32'
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell, ...opts })

const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined
if (tag && tag.replace(/^v/, '') !== version) {
  console.error(`Tag ${tag} does not match package.json version ${version}.`)
  process.exit(1)
}

run('node', ['scripts/generate-manifest.mjs'])

// FlexDesigner loads a page by pasting its <template> into a JS template string, escaping only
// backticks. A `${` or a backslash in the template is then evaluated as JS (e.g. "view is not defined").
const uiDir = path.join(PLUGIN_DIR, 'ui')
for (const name of fs.readdirSync(uiDir).filter((file) => file.endsWith('.vue'))) {
  const template = fs.readFileSync(path.join(uiDir, name), 'utf8').match(/<template>([\s\S]*)<\/template>/)?.[1] ?? ''
  if (template.includes('${') || template.includes('\\')) {
    console.error(`ui/${name}: the <template> contains \`\${\` or a backslash, which FlexDesigner breaks. Move that expression into a computed property.`)
    process.exit(1)
  }
}
fs.rmSync(path.join(PLUGIN_DIR, 'backend'), { recursive: true, force: true })
run(path.join('node_modules', '.bin', 'rollup'), ['-c'], { env: { ...process.env, ROLLUP_WATCH: '' } })

fs.rmSync('build', { recursive: true, force: true })
fs.mkdirSync(path.join(STAGE, 'backend'), { recursive: true })
fs.copyFileSync(path.join(PLUGIN_DIR, 'manifest.json'), path.join(STAGE, 'manifest.json'))
fs.copyFileSync(path.join(PLUGIN_DIR, 'backend', 'plugin.cjs'), path.join(STAGE, 'backend', 'plugin.cjs'))
fs.cpSync(path.join(PLUGIN_DIR, 'ui'), path.join(STAGE, 'ui'), { recursive: true })
// resources/ is empty for now, and git doesn't keep empty folders, so it may be missing in CI.
if (fs.existsSync(path.join(PLUGIN_DIR, 'resources'))) {
  fs.cpSync(path.join(PLUGIN_DIR, 'resources'), path.join(STAGE, 'resources'), { recursive: true })
} else {
  fs.mkdirSync(path.join(STAGE, 'resources'))
}
fs.writeFileSync(path.join(STAGE, 'config.json'), '{}\n')

const flexcli = path.resolve('node_modules', '.bin', 'flexcli')
run(flexcli, ['plugin', 'validate', '--path', PLUGIN_DIR], { cwd: STAGE_ROOT })
run(flexcli, ['plugin', 'pack', '--path', PLUGIN_DIR], { cwd: STAGE_ROOT })

// flexcli writes <uuid>.flexplugin into the working directory and ignores --output.
const packed = fs.readdirSync(STAGE_ROOT).find((name) => name.endsWith('.flexplugin'))
if (!packed) {
  console.error('flexcli did not produce a .flexplugin file.')
  process.exit(1)
}
fs.mkdirSync('release', { recursive: true })
const output = path.join('release', `mutedeck-flexbar-${version}.flexplugin`)
fs.renameSync(path.join(STAGE_ROOT, packed), output)
console.log(`\nPackaged ${output} (${Math.round(fs.statSync(output).size / 1024)} KB)`)
