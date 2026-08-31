import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DISCOVA",
    short_name: "DISCOVA",
    description: "Website Visibility Intelligence — powered by lean.X digital",
    start_url: "/",
    display: "standalone",
    background_color: "#EFEDE2",
    theme_color: "#161A0E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
