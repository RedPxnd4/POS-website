const request = require('supertest');
const app = require('../index');
const { supabase } = require('../config/database');

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Mock successful user lookup
      supabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'test@example.com',
          password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9PS', // Admin123!
          first_name: 'Test',
          last_name: 'User',
          role: 'staff',
          is_active: true,
          two_factor_enabled: false,
          failed_login_attempts: 0,
          locked_until: null
        },
        error: null
      });

      // Mock session creation
      supabase.from().insert().select.mockResolvedValue({
        data: [{ id: 'session-123' }],
        error: null
      });

      // Mock user update
      supabase.from().update().eq.mockResolvedValue({
        data: null,
        error: null
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Admin123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject invalid credentials', async () => {
      // Mock user not found
      supabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      // Mock user doesn't exist
      supabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      // Mock successful user creation
      supabase.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'newuser@example.com',
          first_name: 'New',
          last_name: 'User',
          role: 'staff',
          is_active: true,
          created_at: new Date().toISOString()
        },
        error: null
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'NewUser123!',
          firstName: 'New',
          lastName: 'User',
          role: 'staff'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@example.com');
    });

    it('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'weak',
          firstName: 'New',
          lastName: 'User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_PASSWORD');
    });

    it('should reject duplicate email', async () => {
      // Mock user already exists
      supabase.from().select().eq().single.mockResolvedValue({
        data: { id: 'existing-user' },
        error: null
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'ValidPass123!',
          firstName: 'Existing',
          lastName: 'User'
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // Mock valid session
      supabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'session-123',
          user_id: 'user-123',
          refresh_token: 'valid-refresh-token',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        error: null
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      // Mock session not found
      supabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Session not found' }
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
});