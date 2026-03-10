const { createClient } = require("redis");
const env = require("./env");

let clientPromise = null;

async function getCacheClient() {
  if (!env.cacheEnabled || !env.redisUrl) {
    return null;
  }

  if (!clientPromise) {
    const client = createClient({ url: env.redisUrl });

    client.on("error", () => {
      clientPromise = null;
    });

    clientPromise = client
      .connect()
      .then(() => client)
      .catch(() => {
        clientPromise = null;
        return null;
      });
  }

  return clientPromise;
}

async function withCache(key, ttlSeconds, resolver) {
  const client = await getCacheClient();

  if (!client) {
    return resolver();
  }

  const cached = await client.get(key).catch(() => null);

  if (cached) {
    return JSON.parse(cached);
  }

  const freshValue = await resolver();
  await client.set(key, JSON.stringify(freshValue), { EX: ttlSeconds }).catch(() => null);
  return freshValue;
}

async function clearCacheByPrefix(prefix) {
  const client = await getCacheClient();

  if (!client) {
    return;
  }

  try {
    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 50 })) {
      await client.del(key);
    }
  } catch (_error) {
    // Cache invalidation is best-effort only.
  }
}

module.exports = {
  getCacheClient,
  withCache,
  clearCacheByPrefix,
};
