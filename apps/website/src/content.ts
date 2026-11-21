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
          'Incomplete text, unsupported languages, ambiguous answers, provider errors, and unvalidated thresholds keep remote classifications from hiding posts. A visible sponsored disclosure is a separate local signal. Scores are not guaranteed probabilities.',
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
          'Explore all 12 categories on 14 sample posts in the full demo. Filtering your own LinkedIn feed will require the browser extension, which is still in development.',
        ],
      },
    ],
  },
  {
    slug: 'install',
    title: 'Try ClearedIn in your browser',
    description:
      'The sample feed works here without installation. The Chrome and Firefox extensions are still in development.',
    sections: [
      {
        title: 'Chrome Web Store',
        paragraphs: [
          'We’ll link to the Chrome extension here once its store listing is available.',
        ],
      },
      {
        title: 'Firefox Add-ons',
        paragraphs: [
          'We’ll add the Firefox installation link here when Mozilla approves the listing.',
        ],
      },
      {
        title: 'For repository contributors',
        paragraphs: [
          'Use the repository README to install its pinned toolchain, run checks, and generate separate Chrome and Firefox development packages. The options page saves category preferences locally and offers a separate synthetic UI demo. Live filtering and credentials remain unavailable.',
        ],
      },
    ],
  },
  {
    slug: 'setup',
    title: 'Does the demo need a provider?',
    description:
      'You can try every rule without an account or API key. Provider setup is planned for the browser extension.',
    sections: [
      {
        title: 'Three separate adapters',
        paragraphs: [
          'TypeSafe Jev uses typed judgments. OpenAI and Anthropic use structured language-model outputs. These approaches share a classification contract, but their scores need separate evaluation. Adapter code exists; no live provider is enabled in this build.',
        ],
      },
      {
        title: 'Planned setup flow',
        paragraphs: [
          'Select a supported provider and model, review the recipient and data disclosure, grant its browser host permission, and enter a key only in extension-owned settings. Test with a synthetic post, choose category rules, then explicitly consent and enable. Browser permission alone is not consent. This flow is not yet available for live use.',
        ],
      },
      {
        title: 'Costs and limits',
        paragraphs: [
          'Provider API usage may cost money separately from any chat subscription. Planned request accounting reserves attempts before dispatch; failures and retries can still be billed. An estimated cost cap is not a provider billing guarantee. Pricing and supported models must be verified before enablement.',
        ],
      },
      {
        title: 'Credential custody is still under review',
        paragraphs: [
          'The proposed key store is trusted browser-session storage, never persistent local or sync storage. Client-side credentials have security limitations. Browser restart and permission checks and provider-specific custody decisions remain release blockers. Never paste an API key into this website.',
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Know where your data goes',
    description:
      'Current preview data practices and the proposed live classification flow.',
    sections: [
      {
        title: 'This website and demo',
        paragraphs: [
          'Vercel hosts clearedin.sush.dev. The sample posts and rules load with the page. Your choices stay in this tab and reset when you reload. The demo accesses neither your LinkedIn account nor an AI provider.',
          'Vercel receives the requests needed to serve the site. The demo code includes no analytics. We have yet to confirm the hosting account’s logging and retention settings.',
        ],
      },
      {
        title: 'The current extension',
        paragraphs: [
          'Category preferences and request limits are saved in extension-local storage through a trusted background broker. Clear all data resets that local state. Provider credential entry, remote classification, and live feed extraction are disabled in the production entrypoints. The separate UI simulation does not persist its changes.',
        ],
      },
      {
        title: 'Proposed live data flow',
        paragraphs: [
          'A future enabled extension would minimize rendered home-feed text and send it with classification instructions directly to your chosen provider. Author details, comments, messages, tracking URLs, and local post identifiers are excluded from the planned payload. No ClearedIn feed backend or key relay is implemented.',
        ],
      },
      {
        title: 'Provider retention and consent',
        paragraphs: [
          'Provider retention varies by provider, account, and configuration. No zero-retention promise is made. The chosen recipient, applicable retention information, and explicit consent must be presented before live transmission. Withdrawal must stop requests and restore posts.',
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
          'The website filters sample posts. Your LinkedIn feed stays as it is. The extension for live filtering is still in development.',
        ],
      },
      {
        title: 'Why is a post still visible?',
        paragraphs: [
          'Always show overrides Hide. Uncertain or incomplete classifications also stay visible. In this development build, live filtering is disabled for every post.',
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
          'Pause it or disable it in your browser. Current builds do not modify the live feed. Future runtime errors must leave posts visible, and selector repairs must ship as reviewed extension updates.',
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
