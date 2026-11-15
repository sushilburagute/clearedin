import { expect, it, vi } from 'vitest';
import { createSessionProbe, SESSION_KEY } from '../src/session.ts';

function area() {
  const memory: Record<string, unknown> = {};
  return {
    memory,
    setAccessLevel: vi.fn(async () => {}),
    get: vi.fn(async () => ({ ...memory })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(memory, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete memory[key];
    }),
  };
}
it('awaits access restriction before any credential write', async () => {
  const storage = area();
  let release!: () => void;
  storage.setAccessLevel.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const probe = createSessionProbe(storage);
  const pending = probe.seed();
  expect(storage.set.mock.calls.length).toBe(0);
  release();
  expect(await pending).toBe(true);
  expect(storage.setAccessLevel).toHaveBeenCalledWith({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
});
it('models background restart with the same browser session, and removal', async () => {
  const storage = area();
  expect(await createSessionProbe(storage).configured()).toBe(false);
  await createSessionProbe(storage).seed();
  const restarted = createSessionProbe(storage);
  expect(await restarted.configured()).toBe(true);
  await restarted.clear();
  expect(Object.hasOwn(storage.memory, SESSION_KEY)).toBe(false);
});
it('models browser restart as a fresh session area, without disk fallback', async () => {
  await createSessionProbe(area()).seed();
  expect(await createSessionProbe(area()).configured()).toBe(false);
});
it('fails closed when API or restriction method is missing or rejects', async () => {
  const storage = area();
  storage.setAccessLevel.mockRejectedValue(new Error('unsupported'));
  const withoutAccessControl = {
    get: storage.get,
    set: storage.set,
    remove: storage.remove,
  };
  for (const candidate of [undefined, storage, withoutAccessControl]) {
    const probe = createSessionProbe(candidate);
    expect(await probe.ready).toBe(false);
    expect(await probe.seed()).toBe(false);
    expect(await probe.configured()).toBe(false);
  }
  expect(storage.set.mock.calls.length).toBe(0);
});
it('probes Firefox native session isolation explicitly without a Chrome-only setter', async () => {
  const storage = area();
  const native = { get: storage.get, set: storage.set, remove: storage.remove };
  const firefox = createSessionProbe(native, 'firefox');
  expect(await firefox.seed()).toBe(true);
  expect(await firefox.configured()).toBe(true);
  expect(await createSessionProbe(undefined, 'firefox').ready).toBe(false);
});
