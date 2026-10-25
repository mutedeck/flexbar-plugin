// @eniac/flexcli 1.0.7 imports its JSON schema with `assert { type: 'json' }`, which Node 22 no
// longer parses ("Unexpected identifier 'assert'"). Rewrite it to `with`, which Node 20.10+ and 22
// both accept. Runs on postinstall; does nothing once flexcli ships the fix.
import fs from 'node:fs'

const file = 'node_modules/@eniac/flexcli/src/commands/pack.js'
if (fs.existsSync(file)) {
  const source = fs.readFileSync(file, 'utf8')
  const patched = source.replace(/(from\s+'[^']+\.json')\s+assert\s*\{/g, '$1 with {')
  if (patched !== source) {
    fs.writeFileSync(file, patched)
    console.log(`Patched ${file} for Node 22 (import attributes).`)
  }
}
