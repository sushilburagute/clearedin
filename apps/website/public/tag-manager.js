globalThis.dataLayer ??= [];
globalThis.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

const container = document.createElement('script');
container.async = true;
container.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NSJV8N2F';
document.head.append(container);
