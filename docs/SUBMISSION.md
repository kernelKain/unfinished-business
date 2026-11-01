# Submission record

**Status:** URLs verified 2026-11-01. The dev.to post and video are separate work.

## Live services

| Service | URL | Mode | Access | Template |
|---|---|---|---|---|
| Public read-only sample | https://unfinished-business-demo.onrender.com | `hosted-demo` | No login | `render.demo.yaml` |
| Private live instance | https://unfinished-business.onrender.com | `private-hosted` | Basic auth, username `unfinished-business` | `render.yaml` |

The private instance password and its OpenCode server password are shared with judges by the organizer. They are never committed here or posted publicly.

## Verified checks

Checked 2026-11-01T02:00:57Z unless noted.

| Check | Expected | Result |
|---|---|---|
| `GET /api/health` on the public sample | `{"status":"ok",...}` | PASS |
| `/`, `/demo`, `/workshop` on the public sample, no auth | 200 | PASS |
| `POST /api/runs` on the public sample | `403 DEMO_READ_ONLY` | PASS |
| `GET /api/session` on the public sample | 403 | PASS |
| "Try the example" on the public sample (browser) | opens `/demo`, recorded playback | PASS: `/demo` 200, 0 console errors |
| `GET /api/health` on the private instance | `{"status":"ok",...}` | PASS |
| `/`, `/demo`, `/workshop` on the private instance with Basic auth | 200 | PASS |
| Live Oracle message on the private instance (02:15:45Z) | model reply | BLOCKED: `Free usage limit reached`, because the hosted OpenCode has the free route only |

## Clean-clone test

2026-11-01T02:13Z, `git clone` of `df98627` into a fresh directory, following only the README:

| Step | Result |
|---|---|
| `npm ci` | PASS, 91 packages |
| `npm start` | PASS, printed `Unfinished Business is ready: http://127.0.0.1:4310/` |
| `/api/health`, `/` | PASS |
| Wizard connect with the OpenCode password | PASS, `connected`, 2.0.32, `opencode-go/deepseek-v4.1-flash` listed as paid |
| Second `npm start` on the same port | PASS: named the process holding the port and exited 1 |

No step needed a guess. The README's second terminal (`opencode serve`) is required only for live stages.

## CI note

The `Verify application` workflow failed once on `df98627` on two different, unrelated tests (one on Linux, one on macOS), while the same suite passed locally. A rerun of the failed jobs passed. Those two tests are timing-sensitive.

## Partner categories

- **Render:** both services run on Render; the public sample is free-plan and read-only, the private instance is `0.5c-512mb` with a 1 GB disk at `/var/data`.
- **Entire:** recorded build sessions; a shared checkpoint link is still required before claiming the category.
- **DeepSeek:** V4.1 Flash through OpenCode Go is verified in the local workshop; the hosted instance does not have Go credentials.
