// Included only in production HTML. Missing or unavailable storage means off.
const key = 'clearedin.analytics';
const toggle = document.querySelector('#analytics-toggle');
const analyticsStatus = document.querySelector('#analytics-status');
let started = false;

function allowed() {
  try {
    return globalThis.localStorage.getItem(key) === 'allowed';
  } catch {
    return false;
  }
}

function syncChoice() {
  const enabled = allowed();
  if (toggle) {
    toggle.hidden = false;
    toggle.textContent = enabled
      ? 'Turn off Google Analytics'
      : 'Allow Google Analytics';
    analyticsStatus.textContent = enabled
      ? 'Analytics are on.'
      : 'Analytics are off.';
  }
  if (enabled && !started) {
    started = true;
    globalThis.dataLayer ??= [];
    globalThis.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const container = document.createElement('script');
    container.async = true;
    container.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NSJV8N2F';
    document.head.append(container);
  } else if (!enabled && started) {
    // Discard the document and all callbacks installed by its Google tags.
    globalThis.location.reload();
  }
}

toggle?.addEventListener('click', () => {
  try {
    if (allowed()) globalThis.localStorage.removeItem(key);
    else globalThis.localStorage.setItem(key, 'allowed');
  } catch {
    analyticsStatus.textContent = 'Your browser could not save this setting.';
    return;
  }
  syncChoice();
});

globalThis.addEventListener('storage', syncChoice);
globalThis.addEventListener('pageshow', syncChoice);
syncChoice();
