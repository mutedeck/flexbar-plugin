import fs from "node:fs";

import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const flexPlugin = "com.mutedeck.flexbar.plugin";
const isWatching = !!process.env.ROLLUP_WATCH;

/** @type {import('rollup').RollupOptions} */
export default {
	input: "src/plugin.ts",
	output: {
		file: `${flexPlugin}/backend/plugin.cjs`,
		format: "cjs",
		sourcemap: isWatching,
		inlineDynamicImports: true,
	},
	plugins: [
		{
			name: "watch-externals",
			buildStart() {
				this.addWatchFile(`${flexPlugin}/manifest.json`);
				// FlexDesigner keeps the plugin config here; it must exist but is never committed.
				const config = `${flexPlugin}/config.json`;
				if (!fs.existsSync(config)) {
					fs.writeFileSync(config, "{}\n");
				}
			},
		},
		typescript({ noEmit: false, outDir: undefined }),
		json(),
		nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
		commonjs(),
		!isWatching && terser(),
	],
	external: [
		/^node:/,
		// Optional native speed-ups that `ws` loads inside try/catch.
		"bufferutil",
		"utf-8-validate",
	],
	onwarn(warning, warn) {
		// The SDK and winston have harmless circular imports and `this` rewrites.
		if (warning.code === "CIRCULAR_DEPENDENCY" || warning.code === "THIS_IS_UNDEFINED") {
			return;
		}
		warn(warning);
	},
};
