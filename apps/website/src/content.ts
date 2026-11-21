export const pages = [
  {
    slug: 'how-it-works',
    title: 'How the feed rules work',
    description:
      'Try the rules on sample posts. Your choices apply only to the demo.',
    sections: [
      {
        title: 'Start with everything visible',
        paragraphs: [
          'Each of the twelve categories has three settings: Show normally, Hide, and Always show. Nothing is hidden by default.',
        ],
      },
      {
        title: 'Categories can overlap',
        paragraphs: [
          'A job posting can also offer a referral. A product launch can contain technical detail. Always show protects a matching post even if another category is hidden. Show normally does not override a Hide rule.',
        ],
      },
      {
        title: 'Uncertainty leaves the post visible',
        paragraphs: [
          'Incomplete text, uncertain answers, and provider errors leave organic posts visible. The development extension uses experimental decision thresholds. It skips posts marked Sponsored or Promoted. The website demo lets you explore sponsored examples too.',
        ],
      },
      {
        title: 'Reveal without changing your rules',
        paragraphs: [
          'The synthetic demo lets you reveal individual posts for the current page session. Revealing does not retrain a model or change category preferences. Reset returns every category to Show normally.',
        ],
      },
      {
        title: 'What you can try today',
        paragraphs: [
          'Explore all 12 categories on 14 sample posts in the full demo. To use rules on your desktop LinkedIn home feed, build the development extension and connect your provider.',
        ],
      },
    ],
  },
  {
    slug: 'install',
    title: 'Build the development extension',
    description:
      'The Chrome Web Store and Firefox Add-ons listings are pending. You can build and load the development preview on either desktop browser.',
    sections: [
      {
        title: 'Build the extension',
        paragraphs: [
          'Download or clone the repository. With Node 24.22.3 and pnpm 12.4.1, run pnpm install --frozen-lockfile in the repository folder.',
          'Run pnpm package:chrome for Chrome or pnpm package:firefox for Firefox. The builds are written to apps/extension/.output/.',
        ],
      },
      {
        title: 'Load in Chrome',
        paragraphs: [
          'Open chrome://extensions and turn on Developer mode. Choose Load unpacked and select the apps/extension/.output/chrome-mv3 folder.',
        ],
      },
      {
        title: 'Load in Firefox',
        paragraphs: [
          'Open about:debugging and select This Firefox. Choose Load Temporary Add-on and select manifest.json inside apps/extension/.output/firefox-mv3. Firefox removes the temporary add-on on restart.',
        ],
      },
      {
        title: 'What the development build does',
        paragraphs: [
          'The development extension supports opt-in filtering on the desktop LinkedIn home feed. Open its settings to connect a provider and choose rules. Chrome Web Store and Firefox Add-ons listings are pending.',
        ],
      },
    ],
  },
  {
    slug: 'setup',
    title: 'Connect your provider',
    description:
      'The website demo works without an account or API key. Learn how to connect your provider in the development extension.',
    sections: [
      {
        title: 'Choose a provider',
        paragraphs: [
          'The extension offers TypeSafe Jev, OpenAI and Anthropic. Choose the provider for your own API key. Each uses a specific model, and access depends on your provider account. The development build uses experimental classification thresholds.',
        ],
      },
      {
        title: 'Connect and enable',
        paragraphs: [
          'Open the extension settings, choose a provider, grant permission for its API, and enter your key there. Test the connection with a sample, choose Hide or Always show rules, review what your provider receives, and enable filtering. Open or reload the desktop LinkedIn home feed to try your rules.',
        ],
      },
      {
        title: 'Costs and limits',
        paragraphs: [
          'The sample connection test and feed classification use your provider account and can incur charges. Set a daily request limit in the extension. Failed attempts count. Check your provider billing dashboard for actual charges.',
        ],
      },
      {
        title: 'Where your key stays',
        paragraphs: [
          'Enter your key only in the installed extension. Privileged extension code holds it in browser-session storage and uses it to authenticate requests directly to your selected provider. Enter it again after restarting your browser. Disconnect to forget the key.',
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Know where your data goes',
    description:
      'How the website demo and the opt-in development extension handle your data.',
    sections: [
      {
        title: 'This website and demo',
        paragraphs: [
          'Vercel hosts clearedin.sush.dev. The sample posts and rules load with the page. Your feed rules stay in this tab and reset when you reload. The demo accesses neither your LinkedIn account nor an AI provider.',

          'Vercel receives the requests needed to serve the site. We have yet to confirm the hosting account’s logging and retention settings.',
        ],
      },
      {
        title: 'The current extension',
        paragraphs: [
          'Your rules, consent and request counts stay in extension-local storage. Your provider API key stays in privileged browser-session storage and is sent to that provider for authentication. Clear all data resets local state. Your provider manages its own records.',
        ],
      },
      {
        title: 'What your provider receives',
        paragraphs: [
          'The connection test sends a fixed sample. After you consent and enable filtering, the extension sends selected visible post text and classification instructions directly to your provider. Names or personal information written in the post itself may be included. The extension skips recognized sponsored posts and excludes author profile fields, comments, messages and local post identifiers. Your provider receives the request from your network address.',
        ],
      },
      {
        title: 'Provider retention and consent',
        paragraphs: [
          'Retention depends on your provider, account and configuration. Review the provider information in setup before enabling filtering. Withdraw consent to stop new requests and restore collapsed posts. Previously transmitted text remains subject to your provider’s retention policy.',
        ],
      },
    ],
  },
  {
    slug: 'support',
    title: 'Help with the ClearedIn demo',
    description: 'Get in touch or find an answer about the sample feed.',
    sections: [
      {
        title: 'Does it filter my LinkedIn feed today?',
        paragraphs: [
          'The website uses fictional posts. To filter your own desktop LinkedIn home feed, build the development extension, connect your provider, review the disclosure and enable filtering.',
        ],
      },
      {
        title: 'Why is a post still visible?',
        paragraphs: [
          'Always show overrides Hide. Uncertain or incomplete classifications, recognized sponsored posts, and posts outside the desktop home feed stay visible. Check your provider connection, daily request limit and saved rules in the extension settings.',
        ],
      },
      {
        title: 'Is this affiliated with LinkedIn?',
        paragraphs: [
          'No. Public distribution remains subject to a platform-policy and distribution decision. No permission or store approval is claimed.',
        ],
      },
      {
        title: 'Does revealing a post train the model?',
        paragraphs: [
          'No. Reveal changes only the local visibility of that post for the current page session. It does not send feedback or train a provider.',
        ],
      },
      {
        title: 'How should I report a problem?',
        paragraphs: [
          'Send the page address, your browser version, and the steps you took using a sample post. Keep private posts, screenshots of your LinkedIn feed, and credentials out of the report.',
        ],
      },
      {
        title: 'What if the extension stops working?',
        paragraphs: [
          'Pause filtering in the extension. Reload the home feed if you arrived from another LinkedIn page. If your browser restarted, re-enter the session key in settings. Contact support with your browser and extension version if the issue continues.',
        ],
      },
    ],
  },
  {
    slug: 'changelog',
    title: 'Development changelog',
    description: 'Local features and the remaining release boundaries.',
    sections: [
      {
        title: 'Opt-in home-feed filtering · 21 November 2026',
        paragraphs: [
          'The development extension can use your selected provider after setup and consent. Packaged Chrome checks on fictional posts verified that pausing restores hidden posts and that recognized sponsored posts stay visible. Live LinkedIn compatibility and classifier quality still need verification.',
        ],
      },
      {
        title: '0.1.0 development preview · 17 November 2026',
        paragraphs: [
          'Added persistent local settings transport, strict sender authorization, provider registry gates, offline integration coverage, and this multi-page website with a synthetic policy demo. None of these changes enables remote classification or establishes a supported public release.',
        ],
      },
      {
        title: 'Component baseline',
        paragraphs: [
          'Shared contracts, taxonomy, visibility policy, storage primitives, synthetic-tested feed extraction, extension UI, and separate Jev, OpenAI, and Anthropic adapters are implemented. Live provider/browser and classifier-quality evidence remains pending.',
        ],
      },
    ],
  },
] as const;
