import { type BroadcastMessage } from '@clearedin/contracts';
import { describe, expect, it } from 'vitest';
import { createStorageBrowserFixture } from '../src/storage/index';

describe('synthetic storage browser fixture', () => {
  it('clones both storage writes and reads without sharing state across fixtures', async () => {
    const fixture = createStorageBrowserFixture();
    const value = { categoryModes: { job_posting: 'hide' } };
    await fixture.ports.localStorage.set('settings', value);
    value.categoryModes.job_posting = 'show';
    const read = (await fixture.ports.localStorage.get(
      'settings',
    )) as typeof value;
    expect(read.categoryModes.job_posting).toBe('hide');
    read.categoryModes.job_posting = 'always_show';
    expect(await fixture.ports.localStorage.get('settings')).toEqual({
      categoryModes: { job_posting: 'hide' },
    });
    expect(
      await createStorageBrowserFixture().ports.localStorage.get('settings'),
    ).toBeUndefined();
  });

  it('keeps fixture-local durable state and session state across worker recreation', async () => {
    const fixture = createStorageBrowserFixture();
    await fixture.ports.localStorage.set('attempts', 2);
    await fixture.ports.trustedSessionStorage?.set(
      'dummy',
      'synthetic-session-value',
    );
    const restarted = fixture.restartBackground();
    expect(restarted).not.toBe(fixture.ports);
    expect(restarted.localStorage).not.toBe(fixture.ports.localStorage);
    expect(await restarted.localStorage.get('attempts')).toBe(2);
    expect(await restarted.trustedSessionStorage?.get('dummy')).toBe(
      'synthetic-session-value',
    );
    expect(fixture.snapshot().local).toEqual({ attempts: 2 });
  });

  it('models session loss on browser end while retaining preferences and permissions', async () => {
    const fixture = createStorageBrowserFixture({ family: 'firefox' });
    await fixture.ports.localStorage.set('preferences', { enabled: false });
    await fixture.ports.trustedSessionStorage?.set(
      'dummy',
      'synthetic-session-value',
    );
    fixture.setProviderPermission('typesafe', true);
    const reopened = fixture.endBrowserSession();
    expect(await reopened.localStorage.get('preferences')).toEqual({
      enabled: false,
    });
    expect(await reopened.trustedSessionStorage?.get('dummy')).toBeUndefined();
    expect(await reopened.hasProviderPermission('typesafe')).toBe(true);
    expect(reopened.capabilities.family).toBe('firefox');
  });

  it('models unsupported session isolation and session loss on worker restart independently', async () => {
    const unsupported = createStorageBrowserFixture({
      trustedSessionStorage: false,
    });
    expect(unsupported.ports.trustedSessionStorage).toBeNull();
    expect(unsupported.restartBackground().trustedSessionStorage).toBeNull();
    const volatile = createStorageBrowserFixture({
      sessionSurvivesBackgroundRestart: false,
    });
    await volatile.ports.trustedSessionStorage?.set(
      'dummy',
      'synthetic-session-value',
    );
    expect(
      await volatile.restartBackground().trustedSessionStorage?.get('dummy'),
    ).toBeUndefined();
  });

  it('supports deletion and cloned snapshots for both stores', async () => {
    const fixture = createStorageBrowserFixture();
    for (const port of [
      fixture.ports.localStorage,
      fixture.ports.trustedSessionStorage!,
    ]) {
      await port.set('first', { count: 1 });
      await port.set('second', 2);
      await port.remove('second');
    }
    const snapshot = fixture.snapshot();
    (snapshot.local.first as { count: number }).count = 99;
    expect(fixture.snapshot().local.first).toEqual({ count: 1 });
    await fixture.ports.localStorage.clear();
    await fixture.ports.trustedSessionStorage?.clear();
    expect(fixture.snapshot()).toEqual({
      local: {},
      session: {},
      broadcasts: [],
    });
  });

  it('runs cancellable timers deterministically, including timers scheduled by callbacks', () => {
    const fixture = createStorageBrowserFixture({ now: 100 });
    const calls: number[] = [];
    fixture.clock.schedule(() => {
      calls.push(fixture.clock.now());
      fixture.clock.schedule(() => calls.push(fixture.clock.now()), 5);
    }, 10);
    fixture.clock.schedule(() => calls.push(-1), 10)();
    fixture.clock.schedule(() => calls.push(fixture.clock.now()), 20);
    fixture.advance(30);
    expect(calls).toEqual([110, 115, 120]);
    expect(fixture.clock.now()).toBe(130);
  });

  it('permits deterministic wall-clock rollback and drops timers when the worker restarts', () => {
    const fixture = createStorageBrowserFixture({ now: 100 });
    const calls: number[] = [];
    fixture.clock.schedule(() => calls.push(fixture.clock.now()), 10);
    fixture.setTime(50);
    expect(fixture.clock.now()).toBe(50);
    fixture.setTime(110);
    expect(calls).toEqual([110]);
    fixture.clock.schedule(() => calls.push(-1), 5);
    fixture.restartBackground();
    fixture.advance(10);
    expect(calls).toEqual([110]);
  });

  it('never grants a provider permission without an explicit fixture choice', async () => {
    const fixture = createStorageBrowserFixture();
    expect(await fixture.ports.requestProviderPermission('openai')).toBe(false);
    fixture.setProviderPermission('openai', true);
    expect(await fixture.ports.requestProviderPermission('openai')).toBe(true);
    fixture.setProviderPermission('openai', false);
    expect(await fixture.ports.hasProviderPermission('openai')).toBe(false);
  });

  it('validates and copies broadcasts without retaining extra payloads', async () => {
    const fixture = createStorageBrowserFixture();
    const event: BroadcastMessage = {
      protocolVersion: 1,
      type: 'RESTORE_ALL',
      requestId: 'synthetic-reset',
      enablementGeneration: 1,
      reason: 'data_cleared',
    };
    await fixture.ports.broadcast(event);
    event.requestId = 'changed';
    expect(fixture.snapshot().broadcasts[0]?.requestId).toBe('synthetic-reset');
    const snapshot = fixture.snapshot();
    snapshot.broadcasts.length = 0;
    expect(fixture.snapshot().broadcasts).toHaveLength(1);
    await expect(
      fixture.ports.broadcast({
        ...event,
        text: 'private',
      } as BroadcastMessage),
    ).rejects.toThrow('Invalid fixture broadcast.');
    expect(fixture.snapshot().broadcasts).toHaveLength(1);
  });

  it('rejects invalid time instead of silently corrupting deterministic accounting tests', () => {
    expect(() => createStorageBrowserFixture({ now: Number.NaN })).toThrow();
    const fixture = createStorageBrowserFixture();
    expect(() => fixture.advance(-1)).toThrow();
    expect(() => fixture.setTime(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => fixture.clock.schedule(() => {}, -1)).toThrow();
  });
});
