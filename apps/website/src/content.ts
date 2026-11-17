export const pages = [
  {
    slug: 'how-it-works',
    title: 'Rules you can reason about',
    description: 'Category rules, overlapping labels, uncertainty, and reveal.',
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
        title: 'Current support',
        paragraphs: [
          'The demo uses fixed examples and the shared policy engine. Live LinkedIn filtering is unavailable. Desktop home-feed compatibility, browser installation, and live provider access still need validation.',
        ],
      },
    ],
  },
  {
    slug: 'install',
    title: 'Installation is coming later',
    description:
      'Chrome and Firefox installation status for the development preview.',
    sections: [
      {
        title: 'Chrome: not available in the store',
        paragraphs: [
          'No Chrome Web Store listing has been approved or configured. There is no public installation link.',
        ],
      },
      {
        title: 'Firefox: not available in the store',
        paragraphs: [
          'No Firefox Add-ons listing has been approved or configured. Development builds are not a supported public release.',
        ],
      },
      {
        title: 'For repository contributors',
        paragraphs: [
          'Use the repository README to install its pinned toolchain, run checks, and generate separate Chrome and Firefox development packages. The options page saves category preferences locally and offers a separate synthetic UI demo. Live filtering and credentials remain unavailable.',
        ],
      },
      {
        title: 'Before public release',
        paragraphs: [
          'Browser and credential validation, independently evaluated classification quality, platform and distribution decisions, and operator/support details must be completed. Building a ZIP does not satisfy those gates.',
        ],
      },
    ],
  },
  {
    slug: 'setup',
    title: 'Choose a provider with context',
    description: 'Provider choices, planned consent flow, and request limits.',
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
          'The site is static. The demo runs locally on fixed synthetic posts, does not ask for credentials, and makes no provider requests. Demo controls are held in page memory and reset on reload. No analytics or application backend is implemented. A future hosting operator may keep ordinary access logs; the host, operator, and retention policy must be identified before launch.',
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
      {
        title: 'Release facts still pending',
        paragraphs: [
          'The operating entity, support/privacy contact, public domain, hosting log policy, and provider/browser support matrix are unresolved. This development notice is not a completed production privacy policy.',
        ],
      },
    ],
  },
  {
    slug: 'support',
    title: 'Questions before you start',
    description:
      'Frequently asked questions, limitations, and safe development feedback.',
    sections: [
      {
        title: 'Does it filter my LinkedIn feed today?',
        paragraphs: [
          'No. The working demo is synthetic. Local extension settings and component implementations exist, but live filtering is gated on runtime, browser, security, and quality validation.',
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
          'A public support contact is pending. Repository collaborators can report a reproduction using synthetic text, the build version, browser version, and sanitized error codes. Never include API keys, private messages, raw provider responses, or real-feed screenshots.',
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
];
