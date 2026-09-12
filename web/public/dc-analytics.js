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
    return ['/', '/zh', '/privacy', '/terms', '/zh/privacy', '/zh/terms', '/chat-screenshot-to-text', '/screenshot-to-markdown', '/long-screenshot-to-markdown-test'].includes(p) ? p : null;
  };
  const clearAttribution = () => {
    try { w.sessionStorage.removeItem('l2t-attribution-v1'); w.sessionStorage.removeItem('l2t-login-v1'); } catch { /* unavailable storage keeps attribution transient */ }
  };
  if (!allowed()) { clearAttribution(); w.__l2tGrowthPending = []; return; }
  if (!page()) { w.__l2tGrowthPending = []; return; }
  w.__dcSiteAnalytics = true;
  const sources = ['google', 'bing', 'reddit', 'discord', 'telegram', 'x', 'github', 'newsletter', 'qa', 'direct_or_unknown'];
  const campaigns = ['launch', 'markdown_test', 'obsidian_guide', 'whatsapp_guide', 'none'];
  const sourceHosts = { 'www.google.com': 'google', 'google.com': 'google', 'www.bing.com': 'bing', 'bing.com': 'bing', 'reddit.com': 'reddit', 'www.reddit.com': 'reddit', 'discord.com': 'discord', 'discord.gg': 'discord', 't.me': 'telegram', 'telegram.org': 'telegram', 't.co': 'x', 'x.com': 'x', 'github.com': 'github' };
  const attribution = () => {
    const now = Date.now();
    const params = new URLSearchParams(w.location.search || '');
    const source = params.getAll('utm_source').length === 1 ? params.get('utm_source') : null;
    const campaign = params.getAll('utm_campaign').length === 1 ? params.get('utm_campaign') : null;
    let previous;
    try { previous = JSON.parse(w.sessionStorage.getItem('l2t-attribution-v1') || 'null'); } catch { /* untrusted or unavailable storage */ }
    const valid = previous && sources.includes(previous.source) && campaigns.includes(previous.campaign)
      && Number.isFinite(previous.at) && previous.at <= now && now - previous.at < 30 * 60 * 1000;
    let ref;
    try { ref = sourceHosts[new URL(d.referrer).hostname]; } catch { /* no supported referrer */ }
    const value = sources.includes(source)
      ? { source, campaign: campaigns.includes(campaign) ? campaign : 'none', at: now }
      : valid ? { source: previous.source, campaign: previous.campaign, at: previous.at }
      : { source: sources.includes(ref) ? ref : 'direct_or_unknown', campaign: 'none', at: now };
    try { w.sessionStorage.setItem('l2t-attribution-v1', JSON.stringify(value)); } catch { /* no persistent fallback */ }
    return value;
  };
  let acquisition = attribution();
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
  const context = () => {
    if (Date.now() - acquisition.at >= 30 * 60 * 1000) {
      acquisition = { source: 'direct_or_unknown', campaign: 'none', at: Date.now() };
      try { w.sessionStorage.removeItem('l2t-attribution-v1'); } catch { /* unavailable storage */ }
    }
    return {
    page_location: w.location.origin + page(), page_referrer: referrer(),
    page_title: site + ' ' + page(), site, product_id: site,
    l2t_source: acquisition.source, l2t_campaign: acquisition.campaign,
    measurement_version: '2', ...(acquisition.source === 'qa' ? { debug_mode: true } : {}),
    language: /^\/en(?:\/|$)/.test(w.location.pathname) ? 'en'
      : /^\/zh(?:\/|$)/.test(w.location.pathname) ? 'zh' : (d.documentElement?.lang || 'und'),
    };
  };
  // Never send raw query strings. Only the fixed attribution enums above survive.
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
    acquisition = attribution();
    tag('set', context());
    tag('event', 'page_view', { send_to: id, ...context() });
  }
  view();
  const names = ['upload_started', 'ocr_completed', 'ocr_partial', 'ocr_failed', 'export_completed', 'download_started', 'begin_checkout', 'payment_verified', 'pricing_view', 'paywall_view', 'login_started', 'login_success', 'login_failed', 'checkout_clicked', 'checkout_failed'];
  const methods = ['copy', 'markdown', 'html', 'markdown_zip'];
  const fields = {
    input_method: [['file', 'paste', 'drop', 'sample'], ['upload_started', 'ocr_completed', 'ocr_partial', 'ocr_failed']],
    duration_bucket: [['under_3s', '3_10s', '10_30s', '30s_plus'], ['ocr_completed', 'ocr_partial', 'ocr_failed']],
    result_access: [['preview', 'free', 'paid'], ['ocr_completed', 'ocr_partial', 'export_completed', 'download_started', 'paywall_view']],
    failure_stage: [['prepare', 'recognize', 'assemble', 'checkout', 'login'], ['ocr_failed', 'checkout_failed', 'login_failed']],
    entry_point: [['header', 'paywall'], ['login_started', 'login_success', 'login_failed']],
  };
  const deliver = (event) => {
    if (!allowed() || !page() || !names.includes(event.detail?.name)) return;
    const props = { send_to: id, ...context() };
    if (['export_completed', 'download_started'].includes(event.detail.name) && methods.includes(event.detail.method)) props.export_method = event.detail.method;
    for (const [key, [values, events]] of Object.entries(fields)) {
      if (events.includes(event.detail.name) && values.includes(event.detail[key])) props[key] = event.detail[key];
    }
    tag('event', event.detail.name, props);
  };
  w.addEventListener('l2t:analytics', deliver);
  w.__l2tGrowthReady = true;
  const pending = w.__l2tGrowthPending || [];
  w.__l2tGrowthPending = [];
  for (const detail of pending.slice(0, 20)) deliver({ detail });
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
  const privacyChanged = () => { if (!allowed()) { w['ga-disable-' + id] = true; clearAttribution(); } };
  w.addEventListener('storage', privacyChanged);
  w.addEventListener('l2t:privacy', privacyChanged);
})();
