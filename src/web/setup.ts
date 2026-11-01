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
    note: "Node 22.14 or newer. The lockfile pins the cross-platform OpenCode 2.0.32 CLI, React 19, and Vite 8 for Linux and macOS.",
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
    note: "Terminal 2. Open http://127.0.0.1:5173; Vite proxies /api to port 4310.",
    command: "npm run dev:web",
  },
  {
    id: "engine",
    label: "OpenCode",
    title: "Install OpenCode with npm or Homebrew",
    note: "Linux and macOS npm: npm install -g @opencode/cli@2.0.32. macOS Homebrew: brew install anomalyco/tap/opencode-v2. npm ci already installs the pinned local CLI, so a global install is optional.",
    command: "npm install -g @opencode/cli@2.0.32",
  },
  {
    id: "opencode",
    label: "Server",
    title: "Start the pinned OpenCode server",
    note: "Terminal 3. The lockfile-installed CLI works on Linux x64, macOS Apple Silicon, and macOS Intel. A compatible global opencode on PATH is preferred automatically. Match OPENCODE_PASSWORD in .env to the password OpenCode prints or the one you set.",
    command: "npx --no-install opencode serve --hostname 127.0.0.1 --port 4096",
  },
  {
    id: "production",
    label: "Production",
    title: "Build and serve one local process",
    note: "Stop the dev servers first. The built app and API share http://127.0.0.1:4310.",
    command: "npm run build && npm start",
  },
] as const;

export const connectCommand = setupTabs.find((tab) => tab.id === "opencode")?.command ?? "";
