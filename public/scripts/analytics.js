// The existing GA4 stream preserves the site's reporting history.
(() => {
  if (!['fullrankband.com', 'www.fullrankband.com'].includes(location.hostname)) return;
  if (/^\/admin(?:\/|$)/.test(location.pathname)) return;

  const measurementId = 'G-S2RKQ7Q046';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
})();
