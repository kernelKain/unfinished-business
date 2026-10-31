export const routeNames = ["landing", "workshop", "demo"] as const;

export type RouteName = (typeof routeNames)[number];

export interface AppRoute {
  name: RouteName;
  path: string;
  title: string;
}

const paths: Record<RouteName, string> = {
  landing: "/",
  workshop: "/workshop",
  demo: "/demo",
};

const titles: Record<RouteName, string> = {
  landing: "Unfinished Business — Finish the project you already started",
  workshop: "Workshop — Unfinished Business",
  demo: "Guided sample — Unfinished Business",
};

export function resolveRoute(pathname: string): AppRoute {
  const normalized = normalizePath(pathname);
  if (normalized === "/workshop") return { name: "workshop", path: paths.workshop, title: titles.workshop };
  if (normalized === "/demo") return { name: "demo", path: paths.demo, title: titles.demo };
  return { name: "landing", path: paths.landing, title: titles.landing };
}

export function routePath(name: RouteName): string {
  return paths[name];
}

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}
