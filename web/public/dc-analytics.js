/* Long2Text's opt-in, allowlisted GA4 funnel. This site-specific version intentionally
 * differs from other sites. Enhanced measurement must be OFF in the GA stream.
 * No auto click/form/download listeners; never read content, file names or identifiers.
 */
(() => {
  const w = window, d = document;
  const script = d.currentScript || d.querySelector('script[data-ga-id]');
  if (!script || w.__dcSiteAnalytics) return;
  const { gaId: id, site, hosts = '' } = script.dataset;
  if (!/^G-[A-Z0-9]+$/.test(id || '') || !/^[a-z0-9-]+$/.test(site || '')) return;
  const hasConsent = () => {
    try {
      const choice = JSON.parse(w.localStorage.getItem('dc-analytics-consent-v1') || 'null');
      if (choice === 'denied' || choice?.value === 'denied' || choice?.status === 'denied') return false;
      return w.localStorage.getItem('l2t-analytics-choice-v1') === 'granted';
    } catch { return false; }
  };
  const allowed = () => hosts.split(',').includes(w.location.hostname)
    && w.navigator.doNotTrack !== '1' && w.doNotTrack !== '1'
    && w.navigator.globalPrivacyControl !== true && hasConsent();
  const page = () => {
    const p = w.location.pathname.replace(/\/$/, '') || '/';
    return ['/', '/zh', '/privacy', '/terms', '/zh/privacy', '/zh/terms', '/chat-screenshot-to-text', '/screenshot-to-markdown'].includes(p) ? p : null;
  };
  if (!allowed() || !page()) return;
  w.__dcSiteAnalytics = true;
  const referrer = () => {
    try {
      const host = new URL(d.referrer).hostname;
      if (host === 'www.google.com' || host === 'google.com') return 'https://www.google.com/';
      if (host === 'www.bing.com' || host === 'bing.com') return 'https://www.bing.com/';
      return '';
    }
    catch { return ''; }
  };
  w.dataLayer = w.dataLayer || [];
  let commands = 0;
  function tag() {
    if (commands < 100 && w.dataLayer.length < 100) {
      commands += 1;
      w.dataLayer.push(arguments);
    }
  }
  const context = () => ({
    page_location: w.location.origin + page(), page_referrer: referrer(),
    page_title: site + ' ' + page(), site, product_id: site,
    language: /^\/en(?:\/|$)/.test(w.location.pathname) ? 'en'
      : /^\/zh(?:\/|$)/.test(w.location.pathname) ? 'zh' : (d.documentElement?.lang || 'und'),
  });
  // Deliberately ignore all query parameters, even UTM values: they can contain PII.
  tag('js', new Date());
  tag('config', id, { send_page_view: false, allow_google_signals: false,
    allow_ad_personalization_signals: false, cookie_domain: w.location.hostname,
    cookie_prefix: 'dc_' + site, cookie_expires: 180 * 86400, ...context() });
  let previous;
  function view() {
    if (!allowed() || !page()) { w['ga-disable-' + id] = true; return; }
    w['ga-disable-' + id] = false;
    if (previous === w.location.pathname) return;
    previous = w.location.pathname;
    tag('set', context());
    tag('event', 'page_view', { send_to: id, ...context() });
  }
  view();
  const names = ['upload_started', 'ocr_completed', 'ocr_partial', 'ocr_failed', 'export_completed', 'begin_checkout', 'payment_verified'];
  const methods = ['copy', 'markdown', 'html', 'markdown_zip'];
  w.addEventListener('l2t:analytics', (event) => {
    if (!allowed() || !page() || !names.includes(event.detail?.name)) return;
    const props = { send_to: id, ...context() };
    if (event.detail.name === 'export_completed' && methods.includes(event.detail.method)) props.export_method = event.detail.method;
    tag('event', event.detail.name, props);
  });
  const loader = d.createElement('script');
  loader.async = true;
  loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  d.head.appendChild(loader);
  // Observe actual SPA route transitions, not query strings or in-page anchors.
  for (const method of ['pushState', 'replaceState']) {
    const original = w.history[method];
    w.history[method] = function () {
      const result = original.apply(this, arguments);
      w.setTimeout(view, 0);
      return result;
    };
  }
  w.addEventListener('popstate', view);
  const privacyChanged = () => { if (!allowed()) w['ga-disable-' + id] = true; };
  w.addEventListener('storage', privacyChanged);
  w.addEventListener('l2t:privacy', privacyChanged);
})();
