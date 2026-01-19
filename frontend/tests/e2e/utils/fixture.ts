import { testClient } from "tests/mocks/anvil"

const fixtureCache = new Map()
export const loadFixture = async (fixtureFn: (args: any) => Promise<any>, args: any) => {
  const cacheKey = fixtureFn.name || fixtureFn.toString()
  
  if (fixtureCache.has(cacheKey)) {
    await testClient.revert({ id: fixtureCache.get(cacheKey) })
  } else {
      fixtureCache.set(cacheKey, await testClient.snapshot())
    }

  return fixtureFn(args)
}
