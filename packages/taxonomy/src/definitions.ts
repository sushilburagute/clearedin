import { CATEGORY_IDS, type CategoryId } from '@clearedin/contracts';

/** Increment when definitions or examples change; category IDs are stable. */
export const TAXONOMY_VERSION = '1.0.0';

export interface CategoryDefinition {
  readonly id: CategoryId;
  readonly label: string;
  readonly definition: string;
  readonly boundary: string;
  readonly source: 'model' | 'local_disclosure';
  readonly positiveExample: string;
  readonly negativeExample: string;
}

const definitions = {
  job_posting: {
    label: 'Job postings',
    definition: 'A concrete hiring opening or recruiting call.',
    boundary: 'General job-search advice alone is not a vacancy.',
    source: 'model',
    positiveExample:
      'We are hiring a backend engineer. Applications close Friday.',
    negativeExample:
      'Here are three ways to prepare for an engineering interview.',
  },
  referral: {
    label: 'Referrals',
    definition: 'A request or offer for an introduction or job referral.',
    boundary: 'Generic networking without a referral request is excluded.',
    source: 'model',
    positiveExample: 'I can refer applicants to our open engineering roles.',
    negativeExample: 'I enjoyed meeting other engineers at the meetup.',
  },
  motivational_story: {
    label: 'Generic motivational stories',
    definition:
      'An anecdote whose main purpose is a broad inspirational or business lesson.',
    boundary:
      'A substantive technical incident report is not included merely for being a story.',
    source: 'model',
    positiveExample:
      'I missed a flight. Here are seven leadership lessons it taught me.',
    negativeExample:
      'Our outage exposed a lock-ordering bug; here is the trace and fix.',
  },
  engagement_bait: {
    label: 'Engagement bait',
    definition:
      'A request primarily designed to solicit comments or reactions.',
    boundary: 'A genuine, specific technical question is not sufficient.',
    source: 'model',
    positiveExample:
      'Comment YES and I will send you my secret growth formula.',
    negativeExample:
      'How would you avoid this deadlock in the attached minimal example?',
  },
  product_launch: {
    label: 'Product launches',
    definition:
      'A new product, release, feature, or availability announcement.',
    boundary: 'Can overlap technical content or promotion.',
    source: 'model',
    positiveExample:
      'Our compiler version 2 is available today with incremental parsing.',
    negativeExample: 'Here is how incremental parsers generally handle edits.',
  },
  technical_content: {
    label: 'Technical blogs and projects',
    definition:
      'An engineering explanation, code, research, demo, or substantial project detail.',
    boundary: 'A product claim without technical substance is insufficient.',
    source: 'model',
    positiveExample:
      'This parser uses a persistent syntax tree; here are the benchmark results.',
    negativeExample:
      'Our revolutionary platform will change everything. Buy now.',
  },
  career_advice: {
    label: 'Career advice',
    definition: 'Interview, hiring-process, workplace, or job-search guidance.',
    boundary:
      'May overlap a motivational story when advice is generic and anecdotal.',
    source: 'model',
    positiveExample:
      'Prepare two examples of debugging tradeoffs for your next interview.',
    negativeExample:
      'We have an open frontend role with applications due Friday.',
  },
  industry_news: {
    label: 'Industry news and analysis',
    definition: 'News or substantive analysis relevant to an industry.',
    boundary: 'A launch announcement can carry both news and launch labels.',
    source: 'model',
    positiveExample:
      'The new interoperability standard changes these three deployment assumptions.',
    negativeExample: 'I am excited about the future of technology.',
  },
  personal_update: {
    label: 'Personal milestones',
    definition:
      'A new role, promotion, anniversary, award, or professional personal update.',
    boundary: 'Concrete recruiting asks also receive job or referral labels.',
    source: 'model',
    positiveExample: 'Today I started my new role as a platform engineer.',
    negativeExample: 'The platform engineer position is open for applications.',
  },
  event: {
    label: 'Events and learning',
    definition: 'A conference, meetup, webinar, course, or event invitation.',
    boundary:
      'May overlap promotion; an event reference alone is not an invitation.',
    source: 'model',
    positiveExample: 'Join our free systems debugging workshop next Thursday.',
    negativeExample:
      'At a workshop last year I learned to write smaller functions.',
  },
  promotion: {
    label: 'Sales and self-promotion',
    definition: 'A service pitch, lead generation, or direct call to buy.',
    boundary:
      'Technical discussion is not promotion simply because the author has a business.',
    source: 'model',
    positiveExample:
      'Book my consulting package today for a free discovery call.',
    negativeExample:
      'Here is a reproducible benchmark comparing two queue implementations.',
  },
  sponsored: {
    label: 'Sponsored posts',
    definition:
      'A reliable visible Sponsored or Promoted disclosure on the post.',
    boundary:
      'Determined by a tested localized DOM marker, never guessed from tone.',
    source: 'local_disclosure',
    positiveExample:
      'The post container has a verified visible Sponsored disclosure.',
    negativeExample:
      'The author enthusiastically recommends a product with no disclosure.',
  },
} as const satisfies Record<CategoryId, Omit<CategoryDefinition, 'id'>>;

/** Ordered exactly like CATEGORY_IDS; all example text is synthetic. */
export const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] =
  Object.freeze(
    CATEGORY_IDS.map((id) => Object.freeze({ id, ...definitions[id] })),
  );

export const CATEGORY_DEFINITION_BY_ID: Readonly<
  Record<CategoryId, CategoryDefinition>
> = Object.freeze(
  Object.fromEntries(
    CATEGORY_DEFINITIONS.map((entry) => [entry.id, entry]),
  ) as Record<CategoryId, CategoryDefinition>,
);
