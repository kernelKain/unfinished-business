# Submission record

**Status:** URLs verified 2026-11-01. The dev.to post and video are separate work.

## Live services

| Service | URL | Mode | Access | Template |
|---|---|---|---|---|
| Public read-only sample | https://unfinished-business-demo.onrender.com | `hosted-demo` | No login | `render.demo.yaml` |
| Private live instance | https://unfinished-business.onrender.com | `private-hosted` | Basic auth, username `unfinished-business` | `render.yaml` |

The private instance password and its OpenCode server password are shared with judges by the organizer. They are never committed here or posted publicly.

## Verified checks

Run with timestamps in the release notes for the submission post:

| Check | Expected | Result |
|---|---|---|
| `GET /api/health` on the public sample | `{"status":"ok",...}` | PASS |
| `/`, `/demo`, `/workshop` on the public sample, no auth | 200 | PASS |
| `POST /api/runs` on the public sample | `403 DEMO_READ_ONLY` | PASS |
| `GET /api/session` on the public sample | 403 | PASS |
| `GET /api/health` on the private instance | `{"status":"ok",...}` | PASS |
| `/`, `/demo`, `/workshop` on the private instance with Basic auth | 200 | PASS |
| Live Oracle message on the private instance | model reply | BLOCKED: the hosted OpenCode reaches the free route only, and its allowance is exhausted |

## Partner categories

- **Render:** both services run on Render; the public sample is free-plan and read-only, the private instance is `0.5c-512mb` with a 1 GB disk at `/var/data`.
- **Entire:** recorded build sessions; a shared checkpoint link is still required before claiming the category.
- **DeepSeek:** V4.1 Flash through OpenCode Go is verified in the local workshop; the hosted instance does not have Go credentials.
