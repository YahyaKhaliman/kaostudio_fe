import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        vue(),
        vueDevTools(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: [
                "favicon.ico",
                "kaosan.png",
                "apple-touch-icon.png",
            ],
            manifest: {
                name: "KaoStudio - Sablon & Clothing Mockup Editor",
                short_name: "KaoStudio",
                description:
                    "Aplikasi Editor Desain Sablon & Mockup Kaos Interaktif",
                theme_color: "#18181b",
                background_color: "#18181b",
                display: "standalone",
                orientation: "portrait",
                start_url: "/",
                icons: [
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
            },
        }),
    ],
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:3004",
                changeOrigin: true,
            },
            "/uploads": {
                target: "http://localhost:3004",
                changeOrigin: true,
            },
        },
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
});
