import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AddisGebeya Shoes — Step into Your Style",
    short_name: "AddisGebeya",
    description:
      "Ethiopia's premier single-vendor destination for authentic athletic, streetwear, running, and handcrafted leather footwear.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b2545",
    icons: [
      {
        src: "/images/addisgebeya-logo.png",
        sizes: "1536x1024",
        type: "image/png",
      },
    ],
  };
}

