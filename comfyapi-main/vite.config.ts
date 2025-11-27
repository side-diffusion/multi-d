import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
    plugins: [sveltekit(), glsl()],
    server: {
        host: true
    },
    preview: {
        host: true,
        port: 4173,
        allowedHosts: ['ai.oomg.world']  // 이 줄 추가
    }
});