import { createRouter } from "@tanstack/react-router";
import { RootRoute } from "./routes/__root";
import { DashboardRoute } from "./routes/dashboard";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const routeTree = RootRoute.addChildren([DashboardRoute]);

export const router = createRouter({
  routeTree,
  basepath: getExtensionPath(),
});

function getExtensionPath() {
  // Grab the base url from the ledger data embedded in the page
  const baseUrl = JSON.parse(document.getElementById("ledger-data")?.textContent ?? "{}").base_url ?? "";
  const extension = "extension/FavaDashboards";
  return `${baseUrl}${extension}`;
}

export function slugify(s: string) {
  return s
    .replaceAll(/[^\p{L}\p{N}]/gu, "-")
    .replaceAll(/-{2,}/g, "_")
    .toLowerCase();
}

// Keep Rustfava's host URL store in sync with extension-only navigation.
// The host handles popstate using its existing partial-page loader; React and
// its query/config caches stay mounted, without reloading the whole document.
let hostSyncedURL = window.location.href;
router.subscribe("onResolved", () => {
  const next = window.location.href;
  if (next === hostSyncedURL) return;
  hostSyncedURL = next;
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
});
