import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClassPilot — Class Manager",
    short_name: "ClassPilot",
    description: "Manage students, deadlines, attendance and class announcements in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f0eef6",
    theme_color: "#554686",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Planner", url: "/planner", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Ask AI", url: "/assistant", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
  };
}
