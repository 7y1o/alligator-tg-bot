require('esbuild').buildSync({
	entryPoints: ['src/main.ts'],
	platform: 'node',
	bundle: true,
	outfile: 'build/bot.js',
})
