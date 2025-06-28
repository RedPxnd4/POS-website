const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
router.get('/',
  authenticateToken,
  requirePermission('admin'),
  asyncHandler(async (req, res) => {
    const { role, active, search } = req.query;

    let query = supabase
      .from('users')
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at');

    if (role) {
      query = query.eq('role', role);
    }

    if (active !== undefined) {
      query = query.eq('is_active', active === 'true');
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch users',
        code: 'FETCH_ERROR'
      });
    }

    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      role: user.role,
      isActive: user.is_active,
      lastLogin: user.last_login,
      createdAt: user.created_at
    }));

    res.json({
      users: formattedUsers
    });
  })
);

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin only or own profile)
router.get('/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, is_active, two_factor_enabled, last_login, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        role: user.role,
        isActive: user.is_active,
        twoFactorEnabled: user.two_factor_enabled,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  })
);

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only or own profile for limited fields)
router.put('/:id',
  authenticateToken,
  auditLog('UPDATE_USER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { email, firstName, lastName, role, isActive } = req.body;

    // Users can only update their own profile (limited fields) unless they're admin
    const isOwnProfile = req.user.id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Build update object based on permissions
    const updateData = {};

    // All users can update their own basic info
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;

    // Only admins can update these fields
    if (isAdmin) {
      if (email !== undefined) {
        if (!validator.isEmail(email)) {
          return res.status(400).json({
            error: 'Invalid email format',
            code: 'INVALID_EMAIL'
          });
        }
        updateData.email = email.toLowerCase();
      }
      if (role !== undefined) {
        const validRoles = ['admin', 'manager', 'staff'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            error: 'Invalid role',
            code: 'INVALID_ROLE',
            validRoles
          });
        }
        updateData.role = role;
      }
      if (isActive !== undefined) updateData.is_active = isActive;
    }

    // Check if email already exists (if updating email)
    if (updateData.email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', updateData.email)
        .neq('id', id)
        .single();

      if (existingUser) {
        return res.status(409).json({
          error: 'Email already exists',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, first_name, last_name, role, is_active, two_factor_enabled, last_login, created_at, updated_at')
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update user',
        code: 'UPDATE_ERROR'
      });
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        role: user.role,
        isActive: user.is_active,
        twoFactorEnabled: user.two_factor_enabled,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  })
);

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
router.delete('/:id',
  authenticateToken,
  requirePermission('admin'),
  auditLog('DELETE_USER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        error: 'Cannot delete your own account',
        code: 'CANNOT_DELETE_SELF'
      });
    }

    // Check if user has orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('staff_id', id)
      .limit(1);

    if (ordersError) {
      return res.status(500).json({
        error: 'Failed to check user orders',
        code: 'CHECK_ERROR'
      });
    }

    if (orders && orders.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete user with existing orders',
        code: 'HAS_ORDERS'
      });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({
        error: 'Failed to delete user',
        code: 'DELETE_ERROR'
      });
    }

    res.json({
      message: 'User deleted successfully'
    });
  })
);

// @desc    Get user activity
// @route   GET /api/users/:id/activity
// @access  Private (Admin only or own profile)
router.get('/:id/activity',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Users can only view their own activity unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get recent orders created by this user
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        status,
        created_at,
        customers(first_name, last_name)
      `)
      .eq('staff_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ordersError) {
      return res.status(500).json({
        error: 'Failed to fetch user orders',
        code: 'FETCH_ERROR'
      });
    }

    // Get audit logs if admin is viewing
    let auditLogs = [];
    if (req.user.role === 'admin') {
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('id, action, table_name, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!logsError) {
        auditLogs = logs;
      }
    }

    const activity = {
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
        customer: order.customers ? 
          `${order.customers.first_name} ${order.customers.last_name}`.trim() : 
          'Walk-in',
        createdAt: order.created_at
      })),
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        tableName: log.table_name,
        createdAt: log.created_at
      }))
    };

    res.json({
      activity,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: orders.length === parseInt(limit)
      }
    });
  })
);

// @desc    Reset user password (Admin only)
// @route   POST /api/users/:id/reset-password
// @access  Private (Admin only)
router.post('/:id/reset-password',
  authenticateToken,
  requirePermission('admin'),
  auditLog('RESET_USER_PASSWORD'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        error: 'New password is required',
        code: 'MISSING_PASSWORD'
      });
    }

    // Validate password strength
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
        code: 'INVALID_PASSWORD'
      });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const { error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        failed_login_attempts: 0,
        locked_until: null
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({
        error: 'Failed to reset password',
        code: 'RESET_ERROR'
      });
    }

    res.json({
      message: 'Password reset successfully'
    });
  })
);

// Password validation helper
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return 'Password must be at least 8 characters long';
  }
  if (!hasUpperCase) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!hasLowerCase) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!hasNumbers) {
    return 'Password must contain at least one number';
  }
  if (!hasSpecialChar) {
    return 'Password must contain at least one special character';
  }
  return null;
};

module.exports = router;