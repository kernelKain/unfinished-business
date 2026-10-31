# Sentry and OpenCode setup

The local server and Vite build read `.env` from the repository root. `.env` is gitignored. `.env.example` documents every supported variable without containing passwords, API keys, or auth tokens.

## OpenCode

Start the native server on the address configured by `OPENCODE_BASE_URL`:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

OpenCode 2.0.32 prints a generated server password when it starts. Copy that generated value into `OPENCODE_PASSWORD` in `.env`, or stop the server and choose a stable local password as shown below. Do not commit either value.

To enable OpenCode Basic authentication, choose a new password and pass it to OpenCode as `OPENCODE_SERVER_PASSWORD`:

```bash
OPENCODE_SERVER_PASSWORD="choose-a-long-random-password" opencode serve --hostname 127.0.0.1 --port 4096
```

Put the same value in the application's gitignored `.env`:

```dotenv
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_PASSWORD=the-same-password
```

The password comes from the `opencode serve` terminal output or from the `OPENCODE_SERVER_PASSWORD` value you chose; it is not obtained from this repository. The app authenticates as the default Basic-auth username `opencode`.

OpenCode provider/model credentials are managed by OpenCode itself. This application requires the `opencode/deepseek-v4.1-flash-free` model to appear in the OpenCode model catalog and rejects substitutions or non-zero reported cost.

## Sentry runtime variables

The two DSNs are already present in `.env.example` and the local `.env`:

- `SENTRY_DSN`: `unfinished-business-server`
- `VITE_SENTRY_DSN`: `unfinished-business-web`

DSNs are public project identifiers, not auth tokens. To retrieve or rotate one in Sentry, open **Settings → Projects → the project → Client Keys (DSN)**.

Local development defaults:

```dotenv
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=1
SENTRY_AGENT_TRACES_SAMPLE_RATE=1
SENTRY_PROFILES_SAMPLE_RATE=1
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_TRACES_SAMPLE_RATE=1
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1
```

`SENTRY_RELEASE` can remain empty for ordinary local development. OpenCode inputs, outputs, system instructions, tool arguments, tool results, request bodies, headers, cookies, query parameters, user identity, and stack variables are excluded from Sentry.

## Production build and source maps

Use one release value for the server, browser bundle, source maps, commits, and deploy. The recommended form is:

```text
unfinished-business@<full-git-commit-sha>
```

Configure these as deployment or CI variables:

```dotenv
SENTRY_ENVIRONMENT=production
VITE_SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=unfinished-business@<full-git-commit-sha>
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_AGENT_TRACES_SAMPLE_RATE=1
SENTRY_PROFILES_SAMPLE_RATE=0.1
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ORG=kernelkain
SENTRY_PROJECT=unfinished-business-web
SENTRY_DEPLOY_ENVIRONMENT=production
```

Create an organization auth token in **Sentry organization Settings → Developer Settings → Auth Tokens**. Prefer an organization token for CI with `org:ci` and `org:read`, limited to the required organization/projects. The token is displayed once.

Store it only in the CI/deployment secret store:

```dotenv
SENTRY_AUTH_TOKEN=<secret-token>
```

Never use a `VITE_` prefix for this token; that would expose it to browser code. The Vite build refuses to use an auth token without `SENTRY_RELEASE`, preventing source maps and events from silently using different releases.

The source-map plugin creates/finalizes the release, associates commits, uploads browser source maps, and optionally records a deploy. CI must check out full Git history (`fetch-depth: 0` on GitHub Actions) for automatic commit association.

## What still requires a real deployment

After selecting a deployment platform:

1. Add `SENTRY_AUTH_TOKEN` to its secret store.
2. Generate `SENTRY_RELEASE` from the full commit SHA and provide it to both build and runtime.
3. Set both environment variables to `production` or `staging` as appropriate.
4. Set `SENTRY_DEPLOY_ENVIRONMENT` only for builds that represent a deploy.
5. Deploy once and trigger a server and browser event from that exact build.
6. Confirm the event release exactly matches the Sentry release containing the uploaded source maps, commits, and deploy.
7. Add an uptime monitor for `/api/health` only after a stable public production URL exists.

For suspect commits, connect the GitHub repository in **Sentry Settings → Integrations → GitHub**, then verify or add code mappings for the server and web projects. This OAuth step must be completed by a Sentry/GitHub administrator.
