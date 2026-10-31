export interface SetupTab {
  id: string;
  label: string;
  title: string;
  note: string;
  command: string;
}

export const setupTabs: readonly SetupTab[] = [
  {
    id: "install",
    label: "Install",
    title: "Install the pinned toolchain",
    note: "Node 22.14 or newer. The lockfile pins OpenCode 2.0.32, React 19, and Vite 8.",
    command: "npm ci",
  },
  {
    id: "api",
    label: "API",
    title: "Start the local workshop API",
    note: "Terminal 1. Session mutations require a token issued to the loopback browser.",
    command: "npm run dev",
  },
  {
    id: "web",
    label: "Interface",
    title: "Start the Vite interface",
    note: "Terminal 2. Open http://127.0.0.1:5173; Vite proxies /api to port 4200.",
    command: "npm run dev:web",
  },
  {
    id: "opencode",
    label: "OpenCode",
    title: "Start the pinned OpenCode server",
    note: "Terminal 3. Match OPENCODE_PASSWORD in .env to the password OpenCode prints or the one you set.",
    command: "./node_modules/@opencode/cli-linux-x64-baseline/bin/opencode serve --hostname 127.0.0.1 --port 4096",
  },
  {
    id: "production",
    label: "Production",
    title: "Build and serve one local process",
    note: "Stop the dev servers first. The built app and API share http://127.0.0.1:4200.",
    command: "npm run build && npm start",
  },
] as const;

export const connectCommand = setupTabs.find((tab) => tab.id === "opencode")?.command ?? "";
