'use strict';
// The capture rules are kept in hauld, so this script only collects what it
// knows about a download and asks. If hauld cannot take it, Firefox keeps it.

const HOST = 'haul';
const KEEP_MS = 120000;
const seen = new Map();
let enabled = true;

const header = (headers, name) =>
  headers?.find(h => h.name.toLowerCase() === name)?.value;

function remember(url, details) {
  const now = Date.now();
  for (const [key, value] of seen)
    if (now - value.time > KEEP_MS) seen.delete(key);
  seen.set(url, { ...seen.get(url), ...details, time: now });
}

browser.webRequest.onSendHeaders.addListener(
  d => {
    remember(d.url, {
      method: d.method,
      cookie: header(d.requestHeaders, 'cookie'),
      referer: header(d.requestHeaders, 'referer'),
      userAgent: header(d.requestHeaders, 'user-agent')
    });
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['requestHeaders']
);

browser.webRequest.onHeadersReceived.addListener(
  d => {
    const length = Number(header(d.responseHeaders, 'content-length'));
    remember(d.url, {
      disposition: header(d.responseHeaders, 'content-disposition'),
      size: Number.isFinite(length) && length > 0 ? length : undefined
    });
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['responseHeaders']
);

function nameFromDisposition(value) {
  if (!value) return undefined;
  const extended = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(value);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch (error) {}
  }
  return /filename\s*=\s*"?([^";]+)"?/i.exec(value)?.[1]?.trim();
}

const baseName = path => path?.split(/[\\/]/).pop() || undefined;

async function cookieHeader(url) {
  // firstPartyDomain: null asks across first-party isolation, where it is on.
  const cookies = await browser.cookies
    .getAll({ url, firstPartyDomain: null })
    .catch(() => []);
  return cookies.map(c => `${c.name}=${c.value}`).join('; ') || undefined;
}

browser.downloads.onCreated.addListener(async item => {
  if (!enabled || !/^https?:/i.test(item.url)) return;
  const info = seen.get(item.url) || {};
  // A form post cannot be repeated from outside the browser.
  if (info.method && info.method !== 'GET') return;
  const message = {
    type: 'capture',
    url: item.url,
    filename: nameFromDisposition(info.disposition) || baseName(item.filename),
    size: item.fileSize > 0 ? item.fileSize : info.size,
    cookie: info.cookie || (await cookieHeader(item.url)),
    referer: info.referer || item.referrer || undefined,
    user_agent: info.userAgent || navigator.userAgent
  };
  let reply;
  try {
    reply = await browser.runtime.sendNativeMessage(HOST, message);
  } catch (error) {
    console.warn('Haul is not reachable:', error);
    return;
  }
  if (!reply?.ok) {
    console.warn('Haul refused the download:', reply?.error);
    return;
  }
  if (reply.captured) {
    await browser.downloads.cancel(item.id).catch(() => {});
    // A small file can finish before the answer from Haul arrives.
    const [current] = await browser.downloads.search({ id: item.id }).catch(() => []);
    if (current?.state === 'complete')
      await browser.downloads.removeFile(item.id).catch(() => {});
    await browser.downloads.erase({ id: item.id }).catch(() => {});
  }
});

browser.contextMenus.create({
  id: 'haul-link',
  title: 'Download with Haul',
  contexts: ['link']
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'haul-link' || !/^https?:/i.test(info.linkUrl)) return;
  const reply = await browser.runtime
    .sendNativeMessage(HOST, {
      type: 'add',
      url: info.linkUrl,
      cookie: await cookieHeader(info.linkUrl),
      referer: tab?.url,
      user_agent: navigator.userAgent
    })
    .catch(error => ({ ok: false, error: String(error) }));
  if (!reply.ok) console.warn('Haul refused the link:', reply.error);
});

function showState() {
  browser.browserAction.setBadgeText({ text: enabled ? '' : 'off' });
  browser.browserAction.setTitle({
    title: enabled ? 'Haul: capturing downloads' : 'Haul: capture is off'
  });
}

browser.browserAction.onClicked.addListener(() => {
  enabled = !enabled;
  browser.storage.local.set({ enabled });
  showState();
});

browser.storage.local.get({ enabled: true }).then(stored => {
  enabled = stored.enabled;
  showState();
});
