import { sentryVitePlugin } from "@sentry/bundler-plugins/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const authToken = env.SENTRY_AUTH_TOKEN?.trim();
  const renderCommit = env.RENDER_GIT_COMMIT?.trim();
  const renderRepository = env.RENDER_GIT_REPO_SLUG?.trim();
  const releaseName = env.SENTRY_RELEASE?.trim()
    || (renderCommit ? `unfinished-business@${renderCommit}` : undefined);
  const deployEnvironment = env.SENTRY_DEPLOY_ENVIRONMENT?.trim();
  const hostedDemo = (env.UB_DEPLOYMENT_MODE ?? "").trim() === "hosted-demo";
  if (env.RENDER && !authToken && !hostedDemo) {
    throw new Error("SENTRY_AUTH_TOKEN is required for Render builds so deployed source maps are uploaded.");
  }
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
        url: env.SENTRY_URL || undefined,
        telemetry: false,
        errorHandler: (error) => {
          throw error;
        },
        sourcemaps: uploadSourceMaps
          ? { filesToDeleteAfterUpload: ["./dist/web/**/*.map"] }
          : { disable: true },
        release: {
          name: releaseName,
          create: uploadSourceMaps,
          finalize: uploadSourceMaps,
          setCommits: uploadSourceMaps
            ? (renderCommit && renderRepository
                ? { repo: renderRepository, commit: renderCommit }
                : { auto: true, ignoreMissing: true })
            : false,
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
        "/api": `http://127.0.0.1:${env.UB_PORT || "4310"}`,
      },
    },
  };
});
