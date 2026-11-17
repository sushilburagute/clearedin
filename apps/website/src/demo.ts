import {
  createDefaultCategoryModes,
  CategoryModeSchema,
  type CategoryId,
} from '@clearedin/contracts';
import { CATEGORY_DEFINITIONS as CATEGORIES } from '@clearedin/taxonomy';
import {
  createExperimentalThresholdProfile,
  createVisibilityEvaluator,
} from '@clearedin/decision-engine';
import {
  SYNTHETIC_FIXTURES,
  SYNTHETIC_MODEL,
  createSyntheticInput,
  createSyntheticClassifier,
  type SyntheticFixtureId,
} from '@clearedin/test-fixtures/fake-classifier';

export async function mountDemo(document: Document) {
  const classifier = createSyntheticClassifier();
  const results = await Promise.all(
    SYNTHETIC_FIXTURES.map((fixture) =>
      classifier.classify(
        createSyntheticInput(fixture.id as SyntheticFixtureId),
        { signal: new AbortController().signal },
      ),
    ),
  );
  const evaluate = createVisibilityEvaluator({ allowExperimental: true });
  const thresholds = createExperimentalThresholdProfile(
    'typesafe',
    SYNTHETIC_MODEL,
  );
  let modes = createDefaultCategoryModes();
  let paused = false;
  const revealed = new Set<Element>();
  const posts = [...document.querySelectorAll<HTMLElement>('.demo-post')];
  const pause = document.querySelector<HTMLButtonElement>('#pause')!;
  const selects = [
    ...document.querySelectorAll<HTMLSelectElement>('[data-category]'),
  ];
  const status = document.querySelector<HTMLElement>('#demo-status')!;
  function render() {
    let hidden = 0;
    posts.forEach((post, index) => {
      const body = post.querySelector<HTMLElement>('[data-body]')!;
      const button = post.querySelector<HTMLButtonElement>('[data-reveal]')!;
      const reason = post.querySelector<HTMLElement>('[data-reason]')!;
      const decision = evaluate({
        enabled: !paused,
        consentGranted: true,
        supportedRoute: true,
        validIdentity: true,
        extractorHealthy: true,
        revealed: revealed.has(post),
        extraction: SYNTHETIC_FIXTURES[index]?.extraction ?? 'complete',
        localSponsored: post.hasAttribute('data-sponsored'),
        categoryModes: modes,
        classification: results[index] ?? null,
        thresholds,
      });
      const collapse = decision.action === 'collapse';
      body.hidden = collapse;
      button.hidden = !collapse;
      if (collapse) ++hidden;
      const labels = decision.matchedCategories
        .map((id) => CATEGORIES.find((category) => category.id === id)!.label)
        .join(', ');
      reason.textContent = collapse
        ? `Hidden: ${labels}`
        : decision.reason === 'protected'
          ? `Always show: ${labels}`
          : decision.reason === 'revealed'
            ? 'Revealed for this page session'
            : paused
              ? 'Visible: demo paused'
              : decision.reason === 'insufficient'
                ? 'Visible: insufficient or uncertain classification'
                : 'Visible: no hidden category matched';
    });
    status.textContent = paused
      ? 'Demo paused. All sample posts are visible.'
      : `${hidden} of ${posts.length} synthetic posts hidden. Reveal any hidden post below.`;
  }
  document
    .querySelector('form')
    ?.addEventListener('submit', (event) => event.preventDefault());
  selects.forEach((select) =>
    select.addEventListener('change', () => {
      modes = {
        ...modes,
        [select.dataset.category as CategoryId]: CategoryModeSchema.parse(
          select.value,
        ),
      };
      render();
    }),
  );
  posts.forEach((post) =>
    post
      .querySelector<HTMLButtonElement>('[data-reveal]')!
      .addEventListener('click', () => {
        revealed.add(post);
        render();
        post.tabIndex = -1;
        post.focus();
      }),
  );
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? 'Resume demo' : 'Pause demo';
    pause.setAttribute('aria-pressed', String(paused));
    render();
  });
  document.querySelector('#reset')!.addEventListener('click', () => {
    modes = createDefaultCategoryModes();
    revealed.clear();
    paused = false;
    selects.forEach((select) => {
      for (const option of select.options)
        option.selected = option.value === 'show';
    });
    pause.textContent = 'Pause demo';
    pause.setAttribute('aria-pressed', 'false');
    render();
  });
  render();
}
