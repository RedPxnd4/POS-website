const request = require('supertest');
const app = require('../index');
const { supabase } = require('../config/database');
const jwt = require('jsonwebtoken');

// Helper function to create auth token
const createAuthToken = (userId, role = 'staff') => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
};

describe('Orders Endpoints', () => {
  let authToken;

  beforeEach(() => {
    authToken = createAuthToken('user-123', 'staff');
    
    // Mock user lookup for auth middleware
    supabase.from().select().eq().single.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'staff',
        is_active: true
      },
      error: null
    });
  });

  describe('GET /api/orders', () => {
    it('should return orders for authenticated user', async () => {
      // Mock orders query
      supabase.from().select().order().range.mockResolvedValue({
        data: [
          {
            id: 'order-123',
            order_number: '20240101-001',
            status: 'pending',
            total_amount: '25.99',
            created_at: new Date().toISOString(),
            customers: null,
            users: { first_name: 'Test', last_name: 'User' },
            order_items: [],
            payments: []
          }
        ],
        error: null
      });

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/orders');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('TOKEN_MISSING');
    });

    it('should filter orders by status', async () => {
      supabase.from().select().eq().order().range.mockResolvedValue({
        data: [],
        error: null
      });

      const response = await request(app)
        .get('/api/orders?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(supabase.from().eq).toHaveBeenCalledWith('status', 'pending');
    });
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      // Mock menu item lookup
      supabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'item-123',
            name: 'Test Item',
            price: '12.99'
          },
          error: null
        });

      // Mock order number generation
      supabase.rpc.mockResolvedValue({
        data: '20240101-001',
        error: null
      });

      // Mock order creation
      supabase.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'order-123',
          order_number: '20240101-001',
          status: 'pending',
          total_amount: '14.07', // 12.99 + 8% tax
          created_at: new Date().toISOString()
        },
        error: null
      });

      // Mock order items creation
      supabase.from().insert().select.mockResolvedValue({
        data: [
          {
            id: 'item-123',
            order_id: 'order-123',
            menu_item_id: 'item-123',
            quantity: 1,
            unit_price: '12.99',
            total_price: '12.99'
          }
        ],
        error: null
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'dine-in',
          items: [
            {
              menuItemId: 'item-123',
              quantity: 1,
              modifiers: [],
              specialInstructions: ''
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('order');
      expect(response.body.order.orderNumber).toBe('20240101-001');
    });

    it('should require order type and items', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing orderType and items
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MISSING_FIELDS');
    });

    it('should validate menu items exist', async () => {
      // Mock menu item not found
      supabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Item not found' }
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'dine-in',
          items: [
            {
              menuItemId: 'nonexistent-item',
              quantity: 1
            }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MENU_ITEM_NOT_FOUND');
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    it('should update order status', async () => {
      // Mock order update
      supabase.from().update().eq().select().single.mockResolvedValue({
        data: {
          id: 'order-123',
          order_number: '20240101-001',
          status: 'confirmed',
          estimated_ready_time: null,
          completed_at: null
        },
        error: null
      });

      const response = await request(app)
        .patch('/api/orders/order-123/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'confirmed'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('order');
      expect(response.body.order.status).toBe('confirmed');
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .patch('/api/orders/order-123/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid-status'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_STATUS');
    });

    it('should set completed_at when status is completed', async () => {
      supabase.from().update().eq().select().single.mockResolvedValue({
        data: {
          id: 'order-123',
          order_number: '20240101-001',
          status: 'completed',
          completed_at: new Date().toISOString()
        },
        error: null
      });

      const response = await request(app)
        .patch('/api/orders/order-123/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed'
        });

      expect(response.status).toBe(200);
      expect(response.body.order.completedAt).toBeTruthy();
    });
  });

  describe('DELETE /api/orders/:id', () => {
    beforeEach(() => {
      // Mock manager role for cancellation
      supabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'user-123',
          role: 'manager',
          is_active: true
        },
        error: null
      });
    });

    it('should cancel order if not completed', async () => {
      // Mock order lookup
      supabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'order-123',
            status: 'pending',
            total_amount: '25.99'
          },
          error: null
        });

      // Mock order update
      supabase.from().update().eq.mockResolvedValue({
        data: null,
        error: null
      });

      const response = await request(app)
        .delete('/api/orders/order-123')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Customer requested cancellation'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should not cancel completed orders', async () => {
      // Mock completed order
      supabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'order-123',
          status: 'completed',
          total_amount: '25.99'
        },
        error: null
      });

      const response = await request(app)
        .delete('/api/orders/order-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('CANNOT_CANCEL');
    });

    it('should require manager role', async () => {
      // Mock staff role
      supabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'user-123',
          role: 'staff',
          is_active: true
        },
        error: null
      });

      const response = await request(app)
        .delete('/api/orders/order-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});