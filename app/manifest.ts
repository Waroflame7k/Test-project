import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hồ Sơ BĐS",
    short_name: "Hồ Sơ BĐS",
    description: "Quản lý hồ sơ pháp lý bất động sản",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#022255",
    lang: "vi",
    orientation: "portrait"
  };
}
