const nuxtOptions = {
  srcDir: `ui/`,
  head: {
    titleTemplate: titleChunk => {
      // If undefined or blank then we don't need the hyphen
      return titleChunk ? `${titleChunk} – Open Fixture Library` : `Open Fixture Library`;
    },
    meta: [
      {
        charset: `utf-8`
      },
      {
        name: `viewport`,
        content: `width=device-width, initial-scale=1.0`
      },
      {
        name: `mobile-web-app-capable`,
        content: `yes`
      }
    ],
    link: [
      {
        rel: `apple-touch-icon`,
        sizes: `180x180`,
        href: `/apple-touch-icon.png`
      },
      {
        rel: `icon`,
        type: `image/png`,
        href: `/favicon-32x32.png`,
        sizes: `32x32`
      },
      {
        rel: `icon`,
        type: `image/png`,
        href: `/favicon-16x16.png`,
        sizes: `16x16`
      },
      {
        rel: `manifest`,
        href: `/manifest.json`
      },
      {
        rel: `mask-icon`,
        href: `/safari-pinned-tab.svg`,
        color: `#64b5f6`
      },
      {
        rel: `icon`,
        type: `image/x-icon`,
        href: `https://cdn.css-tricks.com/favicon.ico`
      }
    ]
  },
  css: [`~/assets/style.scss`]
};

if (process.env.ALLOW_SEARCH_INDEXING !== `allowed`) {
  nuxtOptions.head.meta.push({
    name: `robots`,
    content: `noindex, nofollow, none, noodp, noarchive, nosnippet, noimageindex, noydir, nocache`
  });
}

module.exports = nuxtOptions;
