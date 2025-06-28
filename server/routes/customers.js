const express = require('express');
const validator = require('validator');
const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private (Staff+)
router.get('/',
  authenticateToken,
  requirePermission('staff'),
  asyncHandler(async (req, res) => {
    const { search, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('customers')
      .select('*');

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch customers',
        code: 'FETCH_ERROR'
      });
    }

    const formattedCustomers = customers.map(customer => ({
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      firstName: customer.first_name,
      lastName: customer.last_name,
      fullName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      dateOfBirth: customer.date_of_birth,
      loyaltyPoints: customer.loyalty_points,
      totalSpent: parseFloat(customer.total_spent),
      visitCount: customer.visit_count,
      lastVisit: customer.last_visit,
      preferences: customer.preferences || {},
      createdAt: customer.created_at
    }));

    res.json({
      customers: formattedCustomers,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: customers.length === parseInt(limit)
      }
    });
  })
);

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private (Staff+)
router.get('/:id',
  authenticateToken,
  requirePermission('staff'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: customer, error } = await supabase
      .from('customers')
      .select(`
        *,
        orders(
          id,
          order_number,
          status,
          total_amount,
          created_at
        ),
        loyalty_transactions(
          id,
          transaction_type,
          points,
          description,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error || !customer) {
      return res.status(404).json({
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    const formattedCustomer = {
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      firstName: customer.first_name,
      lastName: customer.last_name,
      fullName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      dateOfBirth: customer.date_of_birth,
      loyaltyPoints: customer.loyalty_points,
      totalSpent: parseFloat(customer.total_spent),
      visitCount: customer.visit_count,
      lastVisit: customer.last_visit,
      preferences: customer.preferences || {},
      createdAt: customer.created_at,
      orders: customer.orders.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        totalAmount: parseFloat(order.total_amount),
        createdAt: order.created_at
      })),
      loyaltyTransactions: customer.loyalty_transactions.map(transaction => ({
        id: transaction.id,
        type: transaction.transaction_type,
        points: transaction.points,
        description: transaction.description,
        createdAt: transaction.created_at
      }))
    };

    res.json({ customer: formattedCustomer });
  })
);

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private (Staff+)
router.post('/',
  authenticateToken,
  requirePermission('staff'),
  auditLog('CREATE_CUSTOMER'),
  asyncHandler(async (req, res) => {
    const {
      email,
      phone,
      firstName,
      lastName,
      dateOfBirth,
      preferences
    } = req.body;

    // Validation
    if (!firstName && !lastName && !email && !phone) {
      return res.status(400).json({
        error: 'At least one of first name, last name, email, or phone is required',
        code: 'MISSING_FIELDS'
      });
    }

    if (email && !validator.isEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    if (phone && !validator.isMobilePhone(phone, 'any')) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      });
    }

    if (dateOfBirth && !validator.isDate(dateOfBirth)) {
      return res.status(400).json({
        error: 'Invalid date of birth format',
        code: 'INVALID_DATE'
      });
    }

    // Check for existing customer with same email or phone
    if (email || phone) {
      let existingQuery = supabase.from('customers').select('id');
      
      if (email && phone) {
        existingQuery = existingQuery.or(`email.eq.${email},phone.eq.${phone}`);
      } else if (email) {
        existingQuery = existingQuery.eq('email', email);
      } else if (phone) {
        existingQuery = existingQuery.eq('phone', phone);
      }

      const { data: existingCustomer } = await existingQuery.single();

      if (existingCustomer) {
        return res.status(409).json({
          error: 'Customer already exists with this email or phone number',
          code: 'CUSTOMER_EXISTS'
        });
      }
    }

    // Create customer
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        email: email ? email.toLowerCase() : null,
        phone: phone,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        preferences: preferences || {}
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to create customer',
        code: 'CREATE_ERROR'
      });
    }

    res.status(201).json({
      message: 'Customer created successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.first_name,
        lastName: customer.last_name,
        fullName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        dateOfBirth: customer.date_of_birth,
        loyaltyPoints: customer.loyalty_points,
        totalSpent: parseFloat(customer.total_spent),
        visitCount: customer.visit_count,
        preferences: customer.preferences || {},
        createdAt: customer.created_at
      }
    });
  })
);

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (Staff+)
router.put('/:id',
  authenticateToken,
  requirePermission('staff'),
  auditLog('UPDATE_CUSTOMER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      email,
      phone,
      firstName,
      lastName,
      dateOfBirth,
      preferences
    } = req.body;

    // Validation
    if (email && !validator.isEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    if (phone && !validator.isMobilePhone(phone, 'any')) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      });
    }

    if (dateOfBirth && !validator.isDate(dateOfBirth)) {
      return res.status(400).json({
        error: 'Invalid date of birth format',
        code: 'INVALID_DATE'
      });
    }

    // Build update object
    const updateData = {};
    if (email !== undefined) updateData.email = email ? email.toLowerCase() : null;
    if (phone !== undefined) updateData.phone = phone;
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (dateOfBirth !== undefined) updateData.date_of_birth = dateOfBirth;
    if (preferences !== undefined) updateData.preferences = preferences;

    // Check for existing customer with same email or phone (excluding current customer)
    if (email || phone) {
      let existingQuery = supabase
        .from('customers')
        .select('id')
        .neq('id', id);
      
      if (email && phone) {
        existingQuery = existingQuery.or(`email.eq.${email},phone.eq.${phone}`);
      } else if (email) {
        existingQuery = existingQuery.eq('email', email);
      } else if (phone) {
        existingQuery = existingQuery.eq('phone', phone);
      }

      const { data: existingCustomer } = await existingQuery.single();

      if (existingCustomer) {
        return res.status(409).json({
          error: 'Another customer already exists with this email or phone number',
          code: 'CUSTOMER_EXISTS'
        });
      }
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update customer',
        code: 'UPDATE_ERROR'
      });
    }

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    res.json({
      message: 'Customer updated successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.first_name,
        lastName: customer.last_name,
        fullName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        dateOfBirth: customer.date_of_birth,
        loyaltyPoints: customer.loyalty_points,
        totalSpent: parseFloat(customer.total_spent),
        visitCount: customer.visit_count,
        preferences: customer.preferences || {},
        createdAt: customer.created_at
      }
    });
  })
);

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Manager+)
router.delete('/:id',
  authenticateToken,
  requirePermission('manager'),
  auditLog('DELETE_CUSTOMER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if customer has orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    if (ordersError) {
      return res.status(500).json({
        error: 'Failed to check customer orders',
        code: 'CHECK_ERROR'
      });
    }

    if (orders && orders.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete customer with existing orders',
        code: 'HAS_ORDERS'
      });
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({
        error: 'Failed to delete customer',
        code: 'DELETE_ERROR'
      });
    }

    res.json({
      message: 'Customer deleted successfully'
    });
  })
);

// @desc    Add loyalty points
// @route   POST /api/customers/:id/loyalty
// @access  Private (Staff+)
router.post('/:id/loyalty',
  authenticateToken,
  requirePermission('staff'),
  auditLog('ADD_LOYALTY_POINTS'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { points, description, transactionType = 'earned' } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        error: 'Valid points amount is required',
        code: 'INVALID_POINTS'
      });
    }

    const validTypes = ['earned', 'redeemed', 'expired', 'adjusted'];
    if (!validTypes.includes(transactionType)) {
      return res.status(400).json({
        error: 'Invalid transaction type',
        code: 'INVALID_TYPE',
        validTypes
      });
    }

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, loyalty_points')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Calculate new points balance
    let pointsChange = points;
    if (transactionType === 'redeemed' || transactionType === 'expired') {
      pointsChange = -points;
    }

    const newBalance = customer.loyalty_points + pointsChange;

    if (newBalance < 0) {
      return res.status(400).json({
        error: 'Insufficient loyalty points',
        code: 'INSUFFICIENT_POINTS',
        currentBalance: customer.loyalty_points,
        requested: points
      });
    }

    // Create loyalty transaction
    const { error: transactionError } = await supabase
      .from('loyalty_transactions')
      .insert({
        customer_id: id,
        transaction_type: transactionType,
        points: pointsChange,
        description: description || `${transactionType} points`
      });

    if (transactionError) {
      return res.status(500).json({
        error: 'Failed to create loyalty transaction',
        code: 'TRANSACTION_ERROR'
      });
    }

    // Update customer points balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        loyalty_points: newBalance
      })
      .eq('i', id);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to update customer points',
        code: 'UPDATE_ERROR'
      });
    }

    res.json({
      message: 'Loyalty points updated successfully',
      transaction: {
        type: transactionType,
        points: pointsChange,
        newBalance: newBalance,
        description: description
      }
    });
  })
);

module.exports = router;