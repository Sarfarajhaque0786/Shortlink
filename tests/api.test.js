const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
process.env.BASE_URL = 'http://localhost:5000';

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  // Note: app.js never calls cache.connect(), so the Redis wrapper stays
  // in "not ready" mode here and every call gracefully no-ops — the app
  // is tested through its MongoDB fallback path, exactly as it would
  // behave in production if Redis were briefly down.
  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Auth', () => {
  const user = { name: 'Test User', email: 'test@example.com', password: 'password123' };

  test('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  test('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(409);
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });
});

describe('URL shortening + redirect', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Url User', email: 'urluser@example.com', password: 'password123' });
    token = res.body.token;
  });

  test('rejects request with no auth token', async () => {
    const res = await request(app).post('/api/urls').send({ url: 'https://example.com' });
    expect(res.status).toBe(401);
  });

  test('creates a short URL for a valid link', async () => {
    const res = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/some/very/long/path?x=1' });
    expect(res.status).toBe(201);
    expect(res.body.shortCode).toBeDefined();
    expect(res.body.shortUrl).toContain(res.body.shortCode);
  });

  test('rejects an invalid URL', async () => {
    const res = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  test('creates and honors a custom alias', async () => {
    const res = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/custom-target', customAlias: 'my-custom-link' });
    expect(res.status).toBe(201);
    expect(res.body.shortCode).toBe('my-custom-link');
  });

  test('rejects a duplicate custom alias', async () => {
    const res = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/another-target', customAlias: 'my-custom-link' });
    expect(res.status).toBe(409);
  });

  test('rejects a reserved alias', async () => {
    const res = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/x', customAlias: 'admin' });
    expect(res.status).toBe(409);
  });

  test('redirects a valid short code (302) to the original URL', async () => {
    const create = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/redirect-target' });

    const res = await request(app).get(`/${create.body.shortCode}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/redirect-target');
  });

  test('returns 404 for an unknown short code', async () => {
    const res = await request(app).get('/does-not-exist-code');
    expect(res.status).toBe(404);
  });

  test('increments clickCount after a redirect and reflects it in stats', async () => {
    const create = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/click-count-test' });

    await request(app).get(`/${create.body.shortCode}`);
    // give the fire-and-forget click recording a tick to finish
    await new Promise((r) => setTimeout(r, 50));

    const stats = await request(app)
      .get(`/api/urls/${create.body.shortCode}/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(stats.body.clickCount).toBeGreaterThanOrEqual(1);
  });

  test('returns 410 for an expired short URL', async () => {
    const create = await request(app)
      .post('/api/urls')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/expiring', expiresAt: new Date(Date.now() + 1000).toISOString() });

    // Force it into the past directly via the model to simulate expiry
    // without waiting in real time.
    const Url = require('../src/models/Url');
    await Url.updateOne({ shortCode: create.body.shortCode }, { expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app).get(`/${create.body.shortCode}`);
    expect(res.status).toBe(410);
  });
});
