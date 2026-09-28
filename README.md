# ShortLink – High Performance URL Shortener

A full-stack URL shortener (Bitly-style) built as a B.Tech project, demonstrating Base62 encoding, MongoDB indexing, Redis caching with graceful fallback, JWT auth, custom aliases, click analytics, QR codes, and rate limiting.

## Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** MongoDB + Mongoose (MongoDB Atlas-ready)
- **Cache:** Redis
- **Auth:** JWT + bcrypt
- **Frontend:** HTML/CSS/JS + Chart.js
- **Testing:** Jest + Supertest + mongodb-memory-server
- **QR codes:** `qrcode` npm package

## Project Structure
```
shortlink/
  src/
    app.js              # Express app (middleware, routes)
    server.js            # Entry point — connects DB/Redis, starts server
    config/
      db.js               # MongoDB connection
      redis.js             # Redis client with graceful fallback
    models/
      User.js, Url.js, Click.js, Counter.js
    utils/
      base62.js            # Base62 encode/decode (with explanation in comments)
      shortCodeGenerator.js # Unique short code generation + collision handling
    middleware/
      auth.js               # JWT auth guard
      rateLimiter.js        # express-rate-limit configs
    controllers/
      authController.js, urlController.js, redirectController.js
    routes/
      authRoutes.js, urlRoutes.js
  public/                 # Static frontend (index.html, dashboard.html, css/js)
  tests/                  # Jest + Supertest test suite
```

## How Short Codes Are Generated (Base62 + Collision Handling)
1. A MongoDB `Counter` document is atomically incremented (`$inc` via `findOneAndUpdate`) to get a unique, ever-growing integer — this is race-condition-safe under concurrent requests.
2. That integer is Base62-encoded (`0-9a-zA-Z`, 62 symbols) into a short, URL-safe string. Base62 is preferred over hashing the URL because uniqueness comes **by construction** (from the counter), not statistically — no birthday-paradox collision risk to manage.
3. As a last line of defense, `shortCode` has a **unique index** in MongoDB. If a duplicate-key error (E11000) ever occurs (e.g. a manually inserted or custom-alias clash), the app catches it and retries with a fresh code rather than overwriting the existing link.

## Redirect Flow (Cache Hit/Miss)
`GET /:shortCode` →
1. Check Redis (`shortcode:<code>` → original URL). **Hit** → verify the link is still active/unexpired in Mongo, redirect (302), log the click.
2. **Miss** → look up MongoDB. Not found → 404. Expired/inactive → 410. Otherwise, populate Redis (1-hour TTL) and redirect.
3. If Redis is down/unreachable at any point, the app **falls back to MongoDB automatically** — it never crashes because of the cache.

A **302** (temporary) redirect is used deliberately, not 301, so browsers don't permanently cache the redirect — this keeps click analytics accurate and lets expiry/deactivation take effect immediately.

## Setup (Local Defaults)
``bash
npm install
cp .env.example .env       # defaults already point at localhost Mongo/Redis
npm run dev                # or: npm start
```
Requires MongoDB running on `localhost:27017` and Redis on `localhost:6379`. Install them locally, e.g.:
```bash
# MongoDB (Ubuntu/Debian)
sudo apt install -y mongodb
sudo systemctl start mongodb

# Redis
sudo apt install -y redis-server
sudo systemctl start redis-server
```
Or run both via Docker:
```bash
docker run -d -p 27017:27017 --name mongo mongo:7
docker run -d -p 6379:6379 --name redis redis:7
```
The app works even without Redis running (it just skips caching), but MongoDB is required.

## API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | Register a new user |
| POST | `/api/auth/login` | – | Log in, get a JWT |
| GET | `/api/auth/me` | ✅ | Current user profile |
| POST | `/api/urls` | ✅ | Create a short URL (`url`, optional `expiresAt`, `customAlias`) |
| GET | `/api/urls` | ✅ | List your URLs (paginated) |
| GET | `/api/urls/:shortCode/stats` | ✅ | Click analytics + time series |
| GET | `/api/urls/:shortCode/qrcode` | ✅ | QR code (base64 PNG) for the short link |
| DELETE | `/api/urls/:shortCode` | ✅ | Delete a short URL |
| GET | `/:shortCode` | – | Public redirect |

## Running Tests
```bash
npm test
```
Uses `mongodb-memory-server` to spin up an in-memory MongoDB for tests, so no real DB connection is needed to run the suite. (Note: the very first run downloads a MongoDB binary, which needs internet access.)

## Deployment Notes
- Set `MONGO_URI` to your MongoDB Atlas connection string.
- Set `REDIS_URL` to a Redis Cloud/Upstash connection string.
- Set a strong `JWT_SECRET`.
- Set `BASE_URL` to your deployed domain so generated short URLs are correct.
- Deploy to Render/Railway by pointing the build at `npm install` and start command at `npm start`.

## Concepts Explained (for report/viva)
- **Base62 vs hashing:** see comments in `src/utils/base62.js`.
- **Collision handling:** see comments in `src/utils/shortCodeGenerator.js` and `src/controllers/urlController.js` (`createUrl`).
- **Indexing trade-offs:** see comments in `src/models/Url.js`.
- **Cache hit/miss + TTL + graceful fallback:** see comments in `src/config/redis.js` and `src/controllers/redirectController.js`.
- **Expiration (app-level vs Redis TTL vs MongoDB TTL indexes):** application-level expiration is enforced via the `expiresAt` field checked on every redirect (`Url.isExpired()`); Redis TTL only controls how long a valid link stays cached (not when it "expires" as a link — a cached entry is invalidated early if the link turns out to be expired/deactivated); a MongoDB TTL index would auto-delete documents past a timestamp, which is deliberately *not* used here for the `urls` collection since we want to return a clear "expired" message (410) rather than a silent 404 after auto-deletion — but it would be well-suited to a future "auto-purge click logs older than N days" feature.
