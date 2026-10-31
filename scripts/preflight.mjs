#!/usr/bin/env node
// Diagnostic only: no inference, installs, account setup, or Git mutations.
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { Resolver } from 'node:dns/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const findings = [];

function record(id, status, detail) {
  findings.push({ id, status, detail });
}

async function command(binary, args, env = process.env) {
  try {
    const result = await execute(binary, args, {
      cwd: workspace, env, timeout: 15_000, maxBuffer: 256 * 1024,
    });
    return { ok: true, output: result.stdout.trim() };
  } catch (error) {
    // Do not echo raw command output: providers/plugins may print secrets.
    return { ok: false, code: error.killed ? 'TIMEOUT' : String(error.code ?? 'UNKNOWN') };
  }
}

async function locate(name) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch { /* Try the next PATH entry. */ }
  }
  return null;
}

async function inspectOpenCode() {
  const binary = await locate('opencode');
  if (!binary) {
    record('OPENCODE_CLI', 'FAIL', 'OpenCode is absent from PATH.');
    return;
  }
  const temporary = await mkdtemp(join(tmpdir(), 'ub-preflight-'));
  try {
    // Supported disposable XDG storage avoids changing the user's sessions/auth.
    const env = {
      ...process.env,
      XDG_DATA_HOME: join(temporary, 'data'),
      XDG_CACHE_HOME: join(temporary, 'cache'),
      XDG_STATE_HOME: join(temporary, 'state'),
    };
    const version = await command(binary, ['--version'], env);
    const match = version.ok && version.output.match(/^opencode v?(\d+\.\d+\.\d+)(?:\s|$)/);
    record('OPENCODE_CLI', match ? 'PASS' : 'INCONCLUSIVE', match
      ? `Installed binary ${match[1]}; CLI startup only, not server/model proof.`
      : 'Could not identify the binary version within 15 seconds.');
    const help = await command(binary, ['serve', '--help'], env);
    record('OPENCODE_SERVER_COMMAND', help.ok && /--hostname/.test(help.output) ? 'PASS' : 'INCONCLUSIVE',
      'Inspects serve help only; no server or session was started.');
    try {
      const adjacent = join(dirname(dirname(binary)), 'node_modules', '@opencode-ai', 'sdk', 'package.json');
      const sdk = JSON.parse(await readFile(adjacent, 'utf8'));
      record('SDK_COMPATIBILITY', 'INCONCLUSIVE',
        `Adjacent @opencode-ai/sdk ${sdk.version}; compatibility has not been exercised. Check the native v2 @opencode/client contract.`);
    } catch {
      record('SDK_COMPATIBILITY', 'NOT_RUN', 'No adjacent legacy SDK metadata found; select the supported version-matched client during EP-01.');
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function inspectNetwork(host) {
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  try {
    await resolver.resolve4(host);
    record(`DNS:${host}`, 'PASS', 'DNS resolves; HTTPS and authenticated/free inference remain unproven.');
  } catch (error) {
    record(`DNS:${host}`, 'FAIL', `DNS unavailable (${error.code ?? 'UNKNOWN'}).`);
  } finally {
    resolver.cancel();
  }
}

async function inspectLoopback() {
  await new Promise((done) => {
    const server = createServer();
    let completed = false;
    const finish = (status, detail) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      record('LOOPBACK_BIND', status, detail);
      done();
    };
    const timer = setTimeout(() => {
      server.close(() => {});
      finish('INCONCLUSIVE', 'Temporary localhost bind exceeded the two-second diagnostic bound.');
    }, 2000);
    server.once('error', (error) => finish('FAIL', `Cannot bind localhost (${error.code ?? 'UNKNOWN'}); native server proof cannot run here.`));
    server.listen(0, '127.0.0.1', () => {
      server.close(() => finish('PASS', 'Temporary localhost listener opened and closed; no requests, model calls or application server.'));
    });
  });
}

async function inspectRepository() {
  const branch = await command('git', ['branch', '--show-current']);
  const head = await command('git', ['rev-parse', '--short', 'HEAD']);
  record('GIT_READ', branch.ok && head.ok ? 'PASS' : 'FAIL', branch.ok && head.ok
    ? `Branch ${branch.output}, HEAD ${head.output}; no index/worktree mutations.`
    : 'Cannot read current branch/HEAD.');
  record('GIT_WRITE', 'NOT_RUN', 'No Git write probe. The agent session must separately permit .git writes before a phase commit.');
}

async function inspectEntire() {
  const binary = await locate('entire');
  if (!binary) {
    record('ENTIRE_CAPTURE', 'FAIL', 'Entire is absent from PATH.');
    return;
  }
  const result = await command(binary, ['status']);
  if (result.ok && /not set up|not enabled|disabled/i.test(result.output)) {
    record('ENTIRE_CAPTURE', 'FAIL', 'Entire reports capture is not enabled; no setup was performed.');
  } else if (result.ok && /hooks?[^\n]*need approval/i.test(result.output)) {
    record('ENTIRE_CAPTURE', 'FAIL', 'Entire is enabled, but agent hooks need approval. Open /hooks in the local Codex session, approve the Entire hooks, then verify capture.');
  } else {
    record('ENTIRE_CAPTURE', 'INCONCLUSIVE', 'Verify capture, sharing settings, supported agent and checkpoint evidence separately.');
  }
}

const [major, minor] = process.versions.node.split('.').map(Number);
record('NODE', major > 22 || (major === 22 && minor >= 14) ? 'PASS' : 'FAIL', process.version);
const tasks = await Promise.allSettled([
  inspectOpenCode(), inspectRepository(), inspectEntire(),
  inspectNetwork('opencode.ai'), inspectNetwork('registry.npmjs.org'), inspectLoopback(),
]);
for (const [index, result] of tasks.entries()) {
  if (result.status === 'rejected') record(`DIAGNOSTIC:${index}`, 'INCONCLUSIVE', 'Diagnostic failed; inspect the environment without exposing credentials.');
}
for (const name of ['SENTRY_DSN', 'BACKBOARD_API_KEY', 'OPENCODE_BASE_URL']) {
  record(`ENV:${name}`, 'INFO', process.env[name] ? 'present (value withheld)' : 'absent from this process; other supported configuration locations not inspected');
}
for (const proof of ['EP-01_FREE_MODEL_AND_EDIT', 'EP-02_NATIVE_PERMISSIONS', 'EP-03_RECOVERY', 'EP-04_BACKBOARD', 'EP-05_SENTRY', 'EP-06_ENTIRE_CHECKPOINT']) {
  record(proof, 'NOT_RUN', 'A diagnostic cannot establish this runtime proof.');
}
findings.sort((a, b) => a.id.localeCompare(b.id));
const blocked = findings.some(({ status }) => status === 'FAIL');
console.log(JSON.stringify({
  status: blocked ? 'BLOCKED' : 'PREFLIGHT_ONLY',
  workspace, findings,
  limits: 'No inference, dependency installation, authentication changes, application server startup, capture setup, or Git writes. A temporary localhost listener is immediately closed. PASS refers only to the named diagnostic.',
}, null, 2));
process.exitCode = blocked ? 1 : 0;
