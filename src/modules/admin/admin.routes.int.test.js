const request = require('supertest');
const app = require('../../app');

// Mock AI routes to avoid loading ESM constants during this test
jest.mock('../ai/ai.routes', () => require('express').Router());

// Mock auth middleware to bypass token checks and set an admin user
jest.mock('../../middlewares/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

// Mock rate limit to be a no-op
jest.mock('../../middlewares/rate-limit.middleware', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

// Mock admin service so we don't touch the database
jest.mock('./admin.service', () => ({
  notifyUser: jest.fn(async (userId, payload, actorId) => ({ id: 'note-123', userId, ...payload, actorId })),
  reverifySample: jest.fn(async (sampleId, payload, actorId) => ({ id: sampleId, status: 'MORE_INFO_REQUESTED', payload, actorId })),
}));

describe('Admin routes (integration)', () => {
  it('POST /api/v1/admin/users/:userId/notify - sends notification', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users/user-42/notify')
      .send({ title: 'Hello', message: 'Please check', type: 'GENERAL' })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Notification sent successfully.');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id', 'note-123');
    expect(res.body.data).toMatchObject({ userId: 'user-42', title: 'Hello' });
  });

  it('POST /api/v1/admin/samples/:sampleId/re-verify - requests reverification', async () => {
    const res = await request(app)
      .post('/api/v1/admin/samples/sample-9/re-verify')
      .send({ message: 'Please fix photos.' })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Sample re-verification requested successfully.');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status', 'MORE_INFO_REQUESTED');
    expect(res.body.data).toHaveProperty('id', 'sample-9');
  });
});
