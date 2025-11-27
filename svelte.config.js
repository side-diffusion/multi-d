import adapter from '@sveltejs/adapter-auto';
// Try the correct import path for your version of SvelteKit
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
// If the above fails, you could try uncommenting this alternative:
// import sveltePreprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Use the correct preprocess method based on what's available
	preprocess: vitePreprocess(),
	// Alternative: preprocess: sveltePreprocess(),

	kit: {
		adapter: adapter(),

		// Add CORS headers for the ComfyUI server
		csrf: {
			checkOrigin: false // Be careful with this in production!
		}
	}
};

export default config;
