import { lazy, Suspense, useEffect, useState } from "react";
import { LandingPage } from "./landing/LandingPage.tsx";
import { resolveRoute, type AppRoute } from "./routes.ts";

const WorkshopPage = lazy(() => import("./workshop/WorkshopPage.tsx").then((module) => ({ default: module.WorkshopPage })));
const DemoPage = lazy(() => import("./demo/DemoPage.tsx").then((module) => ({ default: module.DemoPage })));

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(currentPath()));

  useEffect(() => {
    function onPopState() {
      setRoute(resolveRoute(currentPath()));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = route.title;
    document.documentElement.dataset.route = route.name;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);

  if (route.name === "landing") return <LandingPage />;
  return (
    <Suspense fallback={<RouteLoading label={route.name === "workshop" ? "Waking the workshop" : "Opening the walkthrough"} />}>
      {route.name === "workshop" ? <WorkshopPage /> : <DemoPage />}
    </Suspense>
  );
}

function RouteLoading({ label }: { label: string }) {
  return (
    <main className="route-loading" aria-busy="true">
      <p className="eyebrow">{label}</p>
      <p role="status">Loading the interface…</p>
    </main>
  );
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
}
