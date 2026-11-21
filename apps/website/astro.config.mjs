import { writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';

const site = new URL('https://clearedin.sush.dev');
export default defineConfig({
  site: site.href,
  output: 'static',
  integrations: [
    {
      name: 'public-crawl-files',
      hooks: {
        'astro:build:done': async ({ dir, pages }) => {
          const production = process.env.VERCEL_ENV === 'production';
          let robots = 'User-agent: *\nDisallow: /\n';
          if (production) {
            const urls = pages
              .filter((page) => !/^404(?:\.html)?\/?$/.test(page.pathname))
              .map((page) => new URL(page.pathname, site).href);
            const xml =
              '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
              urls
                .map((url) => '  <url><loc>' + url + '</loc></url>')
                .join('\n') +
              '\n</urlset>\n';
            await writeFile(new URL('sitemap.xml', dir), xml);
            robots =
              'User-agent: *\nAllow: /\nSitemap: ' +
              new URL('/sitemap.xml', site).href +
              '\n';
          }
          await writeFile(new URL('robots.txt', dir), robots);
        },
      },
    },
  ],
  // The site's Content Security Policy allows scripts loaded from local files.
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
});
