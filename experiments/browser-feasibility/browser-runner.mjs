// Dependency-free test drivers for isolated profiles, never the user's profile.
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { startFixtureServer } from './serve.mjs';
import { checkSettings } from './settings-check.mjs';
import { prepareUpgrade } from './upgrade-fixture.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const family = process.argv[2];
const upgradeCheck = process.argv.includes('--upgrade');
const settingsCheck = upgradeCheck || process.argv.includes('--settings');
if (!['chrome', 'firefox'].includes(family))
  throw new Error('Specify chrome or firefox');
const binary =
  process.argv.slice(3).find((arg) => !arg.startsWith('--')) ??
  (family === 'chrome'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : 'C:/Program Files/Mozilla Firefox/firefox.exe');
const profile = await mkdtemp(resolve(tmpdir(), `clearedin-probe-${family}-`));
const outputDirectory = resolve(
  directory,
  settingsCheck ? '../../apps/extension/.output' : '.output',
);
const output = resolve(outputDirectory, `${family}-mv3`);
const results = {
  family,
  profile,
  timestamp: new Date().toISOString(),
  checks: [],
  pending: [],
};
let upgrade;
function check(name, passed, detail) {
  results.checks.push({
    name,
    passed,
    ...(detail === undefined ? {} : { detail }),
  });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}
async function until(action, label, timeout = 15000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const result = await action();
      if (result) return result;
    } catch (error) {
      last = error;
    }
    await delay(100);
  }
  throw new Error(`Timeout: ${label}${last ? ` (${last.message})` : ''}`);
}
function launch(args) {
  const child = spawn(binary, args, {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ...(family === 'firefox' ? { MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' } : {}),
    },
  });
  child.on('error', (error) => {
    console.error(error.message);
  });
  return child;
}
async function cdp(url) {
  const socket = new globalThis.WebSocket(url);
  await new Promise((ok, fail) => {
    socket.onopen = ok;
    socket.onerror = fail;
  });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const response = JSON.parse(data);
    if (!response.id) return;
    const request = pending.get(response.id);
    pending.delete(response.id);
    if (response.error) request?.reject(new Error(response.error.message));
    else request?.resolve(response.result);
  };
  return {
    send(method, params = {}, sessionId) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 15000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        socket.send(
          JSON.stringify({
            id,
            method,
            params,
            ...(sessionId ? { sessionId } : {}),
          }),
        );
      });
    },
    close() {
      socket.close();
    },
  };
}

async function chrome() {
  let child, client;
  async function start() {
    child = launch([
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-extension-debugging',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ]);
    const port = await until(async () => {
      const data = await readFile(
        resolve(profile, 'DevToolsActivePort'),
        'utf8',
      );
      const number = Number(data.split('\n')[0]);
      const response = await fetch(`http://127.0.0.1:${number}/json/version`);
      return response.ok ? response.json() : false;
    }, 'Chrome debugger');
    client = await cdp(port.webSocketDebuggerUrl);
    results.version = (await client.send('Browser.getVersion')).product;
  }
  async function page(url) {
    const { targetId } = await client.send('Target.createTarget', { url });
    const { sessionId } = await client.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    return {
      send: (method, params) => client.send(method, params, sessionId),
      async evaluate(expression) {
        const result = await client.send(
          'Runtime.evaluate',
          { expression, awaitPromise: true, returnByValue: true },
          sessionId,
        );
        if (result.exceptionDetails)
          throw new Error(result.exceptionDetails.text);
        return result.result.value;
      },
      close: () => client.send('Target.closeTarget', { targetId }),
    };
  }
  async function stop() {
    try {
      await client?.send('Browser.close');
    } catch {
      /* Browser may close before reply. */
    }
    client?.close();
    await until(
      () => child.exitCode !== null || child.signalCode !== null,
      'Chrome exit',
    );
  }
  try {
    await start();
    const loaded = await client.send('Extensions.loadUnpacked', {
      path: upgrade?.unpacked ?? output,
    });
    const id = loaded.id;
    check('packaged WXT extension loaded', Boolean(id));
    if (settingsCheck) {
      let tab;
      await checkSettings(
        async () => {
          if (tab) await tab.close();
          tab = await page(`chrome-extension://${id}/options.html`);
          return tab.evaluate;
        },
        until,
        check,
        upgrade &&
          (async () => {
            check(
              'installed baseline version',
              (await tab.evaluate('chrome.runtime.getManifest().version')) ===
                upgrade.evidence.from,
            );
            await tab.close();
            tab = undefined;
            const updated = await client.send('Extensions.loadUnpacked', {
              path: await upgrade.update(),
            });
            check('same Chrome extension ID', updated.id === id);
            tab = await page(`chrome-extension://${id}/options.html`);
            await until(
              async () =>
                (await tab.evaluate('chrome.runtime.getManifest().version')) ===
                upgrade.evidence.to,
              'updated Chrome manifest',
            );
            check('higher manifest version running', true);
          }),
      );
      if (process.argv.includes('--store-screenshot')) {
        await tab.send('Emulation.setDeviceMetricsOverride', {
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await tab.evaluate(
          "document.getElementById('categories-title').closest('section').scrollIntoView()",
        );
        await tab.evaluate(
          'document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))',
        );
        const { data } = await tab.send('Page.captureScreenshot', {
          format: 'png',
        });
        const folder = resolve(directory, 'results');
        await mkdir(folder, { recursive: true });
        await writeFile(
          resolve(folder, 'options-1280x800.png'),
          Buffer.from(data, 'base64'),
        );
      }
      return;
    }
    let options = await page(`chrome-extension://${id}/options.html`);
    const snapshot = async () =>
      options.evaluate("chrome.runtime.sendMessage({type:'PROBE_SNAPSHOT'})");
    await until(
      async () => (await snapshot())?.type === 'PROBE_SNAPSHOT',
      'options ready',
    );
    let before = await snapshot();
    if (before.trustedSession) {
      await options.evaluate("document.querySelector('#seed').click()");
      before = await until(async () => {
        const state = await snapshot();
        return state.credentialConfigured && state;
      }, 'dummy seeded');
    }
    results.initial = before;
    check(
      'trusted session configured; no local/sync data',
      before.trustedSession &&
        before.credentialConfigured &&
        before.localEmpty &&
        before.syncEmpty,
    );
    check('optional host starts ungranted', !before.optionalHostGranted);
    const feed = await page('http://127.0.0.1:8765/feed/');
    const report = await until(
      () =>
        feed.evaluate(
          "document.querySelector('#probe-content-report')?.textContent",
        ),
      'content report',
    );
    results.content = JSON.parse(report);
    for (const item of results.content.checks) check(item.name, item.passed);
    const frame = await until(
      () =>
        feed.evaluate(
          "document.querySelector('iframe').contentDocument.querySelector('#probe-content-report')?.textContent",
        ),
      'subframe report',
    );
    results.frame = JSON.parse(frame);
    for (const item of results.frame.checks) check(item.name, item.passed);
    const unsupported = await page('http://127.0.0.1:8765/feed/unsupported');
    const rejected = JSON.parse(
      await until(
        () =>
          unsupported.evaluate(
            "document.querySelector('#probe-content-report')?.textContent",
          ),
        'unsupported route report',
      ),
    );
    for (const item of rejected.checks) check(item.name, item.passed);
    await feed.close();
    await unsupported.close();
    await options.close();
    // No debugger remains attached to the worker. Force an actual worker stop,
    // rather than extension reload (which has different session semantics).
    const control = await page('about:blank');
    await control.send('ServiceWorker.enable');
    await control.send('ServiceWorker.stopAllWorkers');
    await control.close();
    options = await page(`chrome-extension://${id}/options.html`);
    const after = await until(async () => {
      const state = await snapshot();
      return state?.type === 'PROBE_SNAPSHOT' && state;
    }, 'worker wake');
    results.afterBackgroundStop = after;
    check(
      'new background lifetime after forced worker stop',
      before.bootId !== after.bootId,
    );
    check(
      'dummy survives background stop',
      after.credentialConfigured && after.trustedSession,
    );
    const afterFeed = await page('http://127.0.0.1:8765/feed/');
    const afterContent = JSON.parse(
      await until(
        () =>
          afterFeed.evaluate(
            "document.querySelector('#probe-content-report')?.textContent",
          ),
        'content after worker restart',
      ),
    );
    results.contentAfterBackgroundStop = afterContent;
    check(
      'content isolation and restoration survive background stop',
      afterContent.checks.length >= 16 &&
        afterContent.checks.every((item) => item.passed),
    );
    await afterFeed.close();
    await options.close();
    await stop();
    await start();
    // Do not reload/reinstall: that would confound the browser restart check.
    const installations = await client.send('Extensions.getExtensions');
    if (installations.extensions?.some((extension) => extension.id === id)) {
      options = await page(`chrome-extension://${id}/options.html`);
      const restarted = await until(async () => {
        const state = await snapshot();
        return state?.type === 'PROBE_SNAPSHOT' && state;
      }, 'same installation after browser restart');
      results.afterBrowserRestart = restarted;
      check(
        'browser restart clears dummy with same installation',
        !restarted.credentialConfigured && restarted.trustedSession,
      );
      await options.close();
    } else {
      results.pending.push(
        'Browser restart: CDP debug installation did not persist; test an installation that survives restart.',
      );
    }
  } finally {
    await stop().catch(() => {
      child?.kill();
    });
  }
}

// Marionette packets: <UTF-8 byte length>:<JSON>. Sequential requests only.
async function marionette(port) {
  const socket = await new Promise((resolve, reject) => {
    const connection = createConnection({ host: '127.0.0.1', port });
    connection.once('connect', () => resolve(connection));
    connection.once('error', reject);
  });
  let buffer = Buffer.alloc(0),
    sequence = 0,
    resolveGreeting;
  const pending = new Map();
  const greeting = new Promise((resolve) => {
    resolveGreeting = resolve;
  });
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    while (true) {
      const colon = buffer.indexOf(':');
      if (colon < 0) return;
      const length = Number(buffer.subarray(0, colon).toString());
      if (buffer.length < colon + 1 + length) return;
      const message = JSON.parse(
        buffer.subarray(colon + 1, colon + 1 + length).toString(),
      );
      buffer = buffer.subarray(colon + 1 + length);
      if (!Array.isArray(message)) {
        resolveGreeting(message);
        continue;
      }
      const [, id, error, result] = message;
      const request = pending.get(id);
      pending.delete(id);
      if (error) request?.reject(new Error(error.message));
      else request?.resolve(result);
    }
  });
  await greeting;
  return {
    send(command, params = {}) {
      const id = ++sequence;
      const packet = JSON.stringify([0, id, command, params]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Marionette timeout: ${command}`));
        }, 20000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        socket.write(`${Buffer.byteLength(packet)}:${packet}`);
      });
    },
    close() {
      socket.destroy();
    },
  };
}

async function firefox() {
  const port = 28765;
  await writeFile(
    resolve(profile, 'user.js'),
    [
      'user_pref("marionette.port", 28765);',
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("browser.aboutwelcome.enabled", false);',
    ].join('\n'),
  );
  let child, client;
  const send = (command, params) => client.send(command, params);
  const evaluate = async (script) => {
    const result = await send('WebDriver:ExecuteScript', {
      script,
      args: [],
      newSandbox: false,
      sandbox: 'default',
    });
    return result.value;
  };
  const navigate = (url) => send('WebDriver:Navigate', { url });
  async function start() {
    child = launch([
      '--headless',
      '--no-remote',
      '--marionette',
      '--remote-allow-system-access',
      '--profile',
      profile,
    ]);
    client = await until(() => marionette(port), 'Firefox Marionette');
    const session = await send('WebDriver:NewSession', {
      capabilities: { alwaysMatch: {} },
    });
    results.version = session.capabilities.browserVersion;
  }
  async function stop() {
    try {
      await send('Marionette:Quit', { flags: ['eAttemptQuit'] });
    } catch {
      /* Socket closes on quit. */
    }
    client?.close();
    await until(
      () => child.exitCode !== null || child.signalCode !== null,
      'Firefox exit',
    );
  }
  const state = async () => {
    await evaluate("document.querySelector('#snapshot').click(); return true;");
    return until(async () => {
      const text = await evaluate(
        "return document.querySelector('#report')?.textContent;",
      );
      const snapshot = text && JSON.parse(text);
      results.latestSnapshot = snapshot;
      return snapshot;
    }, 'Firefox snapshot');
  };
  try {
    await start();
    const extensionPackage = JSON.parse(
      await readFile(
        resolve(
          directory,
          settingsCheck ? '../../apps/extension/package.json' : 'package.json',
        ),
        'utf8',
      ),
    );
    const archive = `${extensionPackage.name.replace(/[^a-z0-9-]/gi, '')}-${extensionPackage.version}-firefox.zip`;
    const installed = await send('Addon:Install', {
      path: resolve(outputDirectory, archive),
      temporary: true,
    });
    check('packaged WXT ZIP temporary add-on loaded', Boolean(installed));
    await send('Marionette:SetContext', { value: 'chrome' });
    const manifest = JSON.parse(
      await readFile(resolve(output, 'manifest.json'), 'utf8'),
    );
    const extensionId = manifest.browser_specific_settings.gecko.id;
    const baseUrl = await evaluate(
      `return ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs').ExtensionParent.GlobalManager.getExtension(${JSON.stringify(extensionId)}).baseURI.spec;`,
    );
    await send('Marionette:SetContext', { value: 'content' });
    if (settingsCheck) {
      await checkSettings(
        async () => {
          await navigate('about:blank');
          await navigate(`${baseUrl}options.html`);
          return (expression) => evaluate(`return ${expression};`);
        },
        until,
        check,
        upgrade &&
          (async () => {
            await navigate('about:blank');
            await send('Marionette:SetContext', { value: 'chrome' });
            const version = `return ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs').ExtensionParent.GlobalManager.getExtension(${JSON.stringify(extensionId)}).manifest.version;`;
            check(
              'installed baseline version',
              (await evaluate(version)) === upgrade.evidence.from,
            );
            await send('Addon:Install', {
              path: await upgrade.update(),
              temporary: true,
            });
            await until(
              async () => (await evaluate(version)) === upgrade.evidence.to,
              'updated Firefox manifest for same ID',
            );
            check(
              'same Firefox extension ID running higher manifest version',
              true,
            );
            await send('Marionette:SetContext', { value: 'content' });
          }),
      );
      return;
    }
    await navigate(`${baseUrl}options.html`);
    await until(
      () => evaluate("return Boolean(document.querySelector('#seed'));"),
      'Firefox options',
    );
    let before = await state();
    if (before.trustedSession) {
      await evaluate("document.querySelector('#seed').click(); return true;");
      before = await until(async () => {
        const snapshot = await state();
        return snapshot.credentialConfigured && snapshot;
      }, 'Firefox dummy seeded');
    }
    results.initial = before;
    check(
      'trusted session configured; no local/sync data',
      before.trustedSession &&
        before.credentialConfigured &&
        before.localEmpty &&
        before.syncEmpty,
    );
    check('optional host starts ungranted', !before.optionalHostGranted);
    await navigate('http://127.0.0.1:8765/feed/');
    const content = JSON.parse(
      await until(
        () =>
          evaluate(
            "return document.querySelector('#probe-content-report')?.textContent;",
          ),
        'Firefox content report',
      ),
    );
    results.content = content;
    for (const item of content.checks) check(item.name, item.passed);
    const frame = JSON.parse(
      await until(
        () =>
          evaluate(
            "return document.querySelector('iframe').contentDocument.querySelector('#probe-content-report')?.textContent;",
          ),
        'Firefox frame report',
      ),
    );
    results.frame = frame;
    for (const item of frame.checks) check(item.name, item.passed);
    await navigate('http://127.0.0.1:8765/feed/unsupported');
    const unsupported = JSON.parse(
      await until(
        () =>
          evaluate(
            "return document.querySelector('#probe-content-report')?.textContent;",
          ),
        'Firefox route report',
      ),
    );
    for (const item of unsupported.checks) check(item.name, item.passed);
    await navigate('about:blank');
    await send('Marionette:SetContext', { value: 'chrome' });
    const terminated = await evaluate(
      "const extension = ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs').ExtensionParent.GlobalManager.getExtension('browser-probe@clearedin.invalid'); return typeof extension.terminateBackground;",
    );
    results.terminationApi = terminated;
    if (terminated === 'function') {
      await send('WebDriver:ExecuteAsyncScript', {
        script:
          "const done = arguments[arguments.length - 1]; const extension = ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs').ExtensionParent.GlobalManager.getExtension('browser-probe@clearedin.invalid'); extension.terminateBackground().then(() => done(true), () => done(false));",
        args: [],
        newSandbox: false,
        sandbox: 'default',
      });
      await send('Marionette:SetContext', { value: 'content' });
      await navigate(`${baseUrl}options.html`);
      const after = await state();
      results.afterBackgroundStop = after;
      check(
        'new background lifetime after forced event-page stop',
        after.bootId !== before.bootId,
      );
      check(
        'dummy survives background stop',
        after.credentialConfigured && after.trustedSession,
      );
      await navigate('http://127.0.0.1:8765/feed/');
      const afterContent = JSON.parse(
        await until(
          () =>
            evaluate(
              "return document.querySelector('#probe-content-report')?.textContent;",
            ),
          'content after event-page restart',
        ),
      );
      results.contentAfterBackgroundStop = afterContent;
      check(
        'content isolation and restoration survive background stop',
        afterContent.checks.length >= 16 &&
          afterContent.checks.every((item) => item.passed),
      );
    } else {
      check(
        'event-page termination available to harness',
        false,
        'Manual idle termination check required',
      );
    }
    // Temporary Firefox installations disappear at restart. Do not reinstall and
    // incorrectly call an empty store proof of restart isolation.
    results.pending.push(
      'Browser restart: temporary add-on is removed on restart; requires a persistent signed installation.',
    );
  } finally {
    await stop().catch(() => {
      child?.kill();
    });
  }
}

let server;
try {
  if (upgradeCheck) {
    const archives = (await readdir(outputDirectory)).filter((name) =>
      name.endsWith(`-${family}.zip`),
    );
    if (archives.length !== 1)
      throw new Error(
        'Build one package for this browser before the upgrade smoke',
      );
    upgrade = await prepareUpgrade(
      profile,
      resolve(outputDirectory, archives[0]),
      family,
    );
    results.upgrade = upgrade.evidence;
    delete results.profile;
  }
  if (!settingsCheck) server = await startFixtureServer();
  await (family === 'chrome' ? chrome() : firefox());
  if (!settingsCheck)
    results.pending.push(
      'Optional host request prompt: grant, denial, and revocation require interactive checking. Only initial absence was automated.',
    );
} catch (error) {
  results.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mkdir(resolve(directory, 'results'), { recursive: true });
  await writeFile(
    resolve(
      directory,
      'results',
      `${family}${upgradeCheck ? '-upgrade' : settingsCheck ? '-settings' : ''}.json`,
    ),
    JSON.stringify(results, null, 2) + '\n',
  );
  if (upgradeCheck)
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  if (results.checks.some((item) => !item.passed)) process.exitCode = 1;
  else if (!process.exitCode && results.pending.length) process.exitCode = 2;
}
