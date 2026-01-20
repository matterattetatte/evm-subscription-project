import { testClient } from 'tests/mocks/anvil';

const fixtureSnapshots = new Map<string, `0x${string}`>();

export async function loadFixture<T>(
  fixtureFn: (args: any) => Promise<T>,
  args: any = {}
): Promise<T> {
  const cacheKey = fixtureFn.name || fixtureFn.toString();

  if (fixtureSnapshots.has(cacheKey)) {
    const snapshotId = fixtureSnapshots.get(cacheKey)!;
    await testClient.revert({ id: snapshotId });
  } else {
    await fixtureFn(args);

    const snapshotId = await testClient.snapshot();
    fixtureSnapshots.set(cacheKey, snapshotId);
  }

  return fixtureFn(args);
}