import { sentryVitePlugin } from "@sentry/bundler-plugins/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const authToken = env.SENTRY_AUTH_TOKEN?.trim();
  const releaseName = env.SENTRY_RELEASE?.trim();
  const deployEnvironment = env.SENTRY_DEPLOY_ENVIRONMENT?.trim();
  if (authToken && !releaseName) {
    throw new Error("SENTRY_RELEASE is required when SENTRY_AUTH_TOKEN is set so events and source maps use the same release.");
  }
  const uploadSourceMaps = Boolean(authToken && releaseName);

  return {
    plugins: [
      react(),
      ...(releaseName ? [sentryVitePlugin({
        org: env.SENTRY_ORG || "kernelkain",
        project: env.SENTRY_PROJECT || "unfinished-business-web",
        authToken,
        telemetry: false,
        sourcemaps: uploadSourceMaps
          ? { filesToDeleteAfterUpload: ["./dist/web/**/*.map"] }
          : { disable: true },
        release: {
          name: releaseName,
          create: uploadSourceMaps,
          finalize: uploadSourceMaps,
          setCommits: uploadSourceMaps ? { auto: true, ignoreMissing: true } : false,
          deploy: uploadSourceMaps && deployEnvironment ? { env: deployEnvironment } : false,
        },
      })] : []),
    ],
    build: {
      outDir: "dist/web",
      emptyOutDir: true,
      sourcemap: uploadSourceMaps ? "hidden" : false,
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": `http://127.0.0.1:${env.UB_PORT || "4200"}`,
      },
    },
  };
});
