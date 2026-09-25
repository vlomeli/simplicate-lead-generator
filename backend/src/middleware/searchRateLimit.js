import { config } from '../config/env.js';

const oneMinuteInMilliseconds = 60_000;

// This small in-process limiter protects a single local/server instance from
// double-clicks and accidental bursts. A multi-instance deployment should move
// this state to shared storage before it scales out.
export function createPerUserSearchRateLimit({
  limit = config.googlePlacesRequestsPerMinute,
  windowMilliseconds = oneMinuteInMilliseconds,
  now = () => Date.now(),
} = {}) {
  const requestsByUser = new Map();

  return (request, response, next) => {
    const userId = request.user?.id;
    if (!userId) return next();

    const cutoff = now() - windowMilliseconds;
    const recentRequests = (requestsByUser.get(userId) ?? []).filter(timestamp => timestamp > cutoff);
    if (recentRequests.length >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((recentRequests[0] + windowMilliseconds - now()) / 1000));
      response.set('Retry-After', String(retryAfterSeconds));
      response.status(429).json({ error: `Search limit reached. Try again in ${retryAfterSeconds} seconds.` });
      return;
    }

    recentRequests.push(now());
    requestsByUser.set(userId, recentRequests);
    next();
  };
}

export const perUserSearchRateLimit = createPerUserSearchRateLimit();
