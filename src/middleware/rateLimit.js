const buckets = new Map();

export function rateLimit({ windowMs, max, keyFn, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip;
    const entry = buckets.get(key);

    if (!entry || entry.reset < now) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retry = Math.ceil((entry.reset - now) / 1000);
      res.set("Retry-After", String(retry));
      return res.status(429).json({ error: message || "Too many requests" });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.reset < now) buckets.delete(key);
  }
}, 60_000).unref();
