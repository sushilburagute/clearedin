import {
  CATEGORY_IDS,
  CategoryModeSchema,
  type CategoryId,
  type ClassificationResult,
  createDefaultCategoryModes,
} from '@clearedin/contracts';
import { CATEGORY_DEFINITION_BY_ID } from '@clearedin/taxonomy';
import { createVisibilityEvaluator } from '@clearedin/decision-engine';
import { createPolicyInput } from '@clearedin/test-fixtures/policy';
import {
  createSyntheticClassifier,
  createSyntheticInput,
  SYNTHETIC_FIXTURES,
  SYNTHETIC_MODEL,
  type SyntheticFixtureId,
} from '@clearedin/test-fixtures/fake-classifier';
const modes = createDefaultCategoryModes();
const revealed = new Set<string>();
const results = new Map<string, ClassificationResult>();
const evaluate = createVisibilityEvaluator({ allowExperimental: true });
const feed = document.querySelector<HTMLDivElement>('#feed')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const rows = SYNTHETIC_FIXTURES.map((fixture) => {
  const article = document.createElement('article');
  article.className = 'post';
  const title = document.createElement('h2');
  title.textContent = 'Synthetic example';
  article.append(title);
  const detail = document.createElement('p');
  article.append(detail);
  const body = document.createElement('p');
  body.textContent = fixture.text;
  article.append(body);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Show post';
  article.append(button);
  button.addEventListener('click', () => {
    revealed.add(fixture.id);
    render();
    body.tabIndex = -1;
    body.focus();
    status.textContent = 'Post revealed for this demo session.';
  });
  feed.append(article);
  return { fixture, body, button, detail };
});
function render() {
  for (const { fixture, body, button, detail } of rows) {
    const input = createPolicyInput({
      categoryModes: modes,
      classification: results.get(fixture.id) ?? null,
      extraction: fixture.extraction,
      revealed: revealed.has(fixture.id),
    });
    if (input.thresholds)
      input.thresholds = { ...input.thresholds, model: SYNTHETIC_MODEL };
    const decision = evaluate(input);
    const hidden = decision.action === 'collapse';
    body.hidden = hidden;
    button.hidden = !hidden;
    const labels = decision.matchedCategories
      .map((id) => CATEGORY_DEFINITION_BY_ID[id].label)
      .join(', ');
    detail.textContent = hidden
      ? `Hidden: ${labels}`
      : decision.reason === 'protected'
        ? `Always shown: ${labels}`
        : decision.reason === 'insufficient'
          ? 'Kept visible: insufficient or uncertain evidence.'
          : decision.reason === 'revealed'
            ? 'Revealed for this session.'
            : 'Visible under your current rules.';
  }
}
for (const select of document.querySelectorAll<HTMLSelectElement>(
  '[data-category]',
)) {
  select.addEventListener('change', () => {
    const id = select.dataset['category'] as CategoryId;
    if (CATEGORY_IDS.includes(id)) {
      modes[id] = CategoryModeSchema.parse(select.value);
      render();
      status.textContent = 'Category preference updated.';
    }
  });
}
document.querySelector('#reset')!.addEventListener('click', () => {
  Object.assign(modes, createDefaultCategoryModes());
  revealed.clear();
  for (const select of document.querySelectorAll<HTMLSelectElement>(
    '[data-category]',
  ))
    select.value = 'show';
  render();
  status.textContent = 'Demo reset. All categories show normally.';
});
async function initialize() {
  const classifier = createSyntheticClassifier();
  for (const fixture of SYNTHETIC_FIXTURES)
    results.set(
      fixture.id,
      await classifier.classify(
        createSyntheticInput(fixture.id as SyntheticFixtureId),
        { signal: new AbortController().signal },
      ),
    );
  render();
}
void initialize().catch(() => {
  status.textContent = 'Demo unavailable. All examples remain visible.';
});
