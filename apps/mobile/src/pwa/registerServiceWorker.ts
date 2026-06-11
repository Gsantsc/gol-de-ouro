import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

const setMeta = (name: string, content: string, attribute: "name" | "property" = "name") => {
  if (typeof document === "undefined") return;
  const selector = `meta[${attribute}="${name}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  const meta = existing ?? document.createElement("meta");
  meta.setAttribute(attribute, name);
  meta.setAttribute("content", content);
  if (!existing) document.head.appendChild(meta);
};

const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
  if (typeof document === "undefined") return;
  const selector = `link[rel="${rel}"]${extra?.sizes ? `[sizes="${extra.sizes}"]` : ""}`;
  const existing = document.head.querySelector<HTMLLinkElement>(selector);
  const link = existing ?? document.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("href", href);
  Object.entries(extra ?? {}).forEach(([key, value]) => link.setAttribute(key, value));
  if (!existing) document.head.appendChild(link);
};

const configurePwaHead = () => {
  if (!isWeb || typeof document === "undefined") return;

  document.documentElement.lang = "pt-BR";
  setLink("manifest", "/manifest.json");
  setLink("icon", "/icons/icon-192.png", { sizes: "192x192", type: "image/png" });
  setLink("apple-touch-icon", "/icons/apple-touch-icon.png");

  setMeta("theme-color", "#D4AF37");
  setMeta("background-color", "#0B0F19");
  setMeta("application-name", "Gol de Ouro");
  setMeta("apple-mobile-web-app-title", "Gol de Ouro");
  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  setMeta("mobile-web-app-capable", "yes");
  setMeta("description", "Palpites, rankings e ligas da Copa do Mundo 2026.");
  setMeta("og:title", "Gol de Ouro", "property");
  setMeta("og:description", "Palpites, rankings e ligas da Copa do Mundo 2026.", "property");
  setMeta("og:type", "website", "property");
};

const registerServiceWorker = () => {
  if (!isWeb || typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.warn("Falha ao registrar service worker do PWA.", error);
    });
  });
};

configurePwaHead();
registerServiceWorker();
