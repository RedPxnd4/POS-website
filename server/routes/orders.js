const express = require('express');
const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Staff+)
router.get('/',
  authenticateToken,
  requirePermission('staff'),
  asyncHandler(async (req, res) => {
    const { status, date, customerId, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        customers(first_name, last_name, email, phone),
        users!orders_staff_id_fkey(first_name, last_name),
        order_items(
          *,
          menu_items(name, price),
          order_item_modifiers(
            modifiers(name, price_adjustment)
          )
        ),
        payments(*)
      `);

    if (status) {
      query = query.eq('status', status);
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query = query.gte('created_at', startDate.toISOString())
                  .lt('created_at', endDate.toISOString());
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: orders, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch orders',
        code: 'FETCH_ERROR'
      });
    }

    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      customer: order.customers ? {
        id: order.customer_id,
        name: `${order.customers.first_name} ${order.customers.last_name}`.trim(),
        email: order.customers.email,
        phone: order.customers.phone
      } : null,
      staff: {
        id: order.staff_id,
        name: `${order.users.first_name} ${order.users.last_name}`
      },
      orderType: order.order_type,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      taxAmount: parseFloat(order.tax_amount),
      discountAmount: parseFloat(order.discount_amount || 0),
      tipAmount: parseFloat(order.tip_amount || 0),
      totalAmount: parseFloat(order.total_amount),
      notes: order.notes,
      tableNumber: order.table_number,
      estimatedReadyTime: order.estimated_ready_time,
      completedAt: order.completed_at,
      createdAt: order.created_at,
      items: order.order_items.map(item => ({
        id: item.id,
        menuItem: {
          id: item.menu_item_id,
          name: item.menu_items.name,
          basePrice: parseFloat(item.menu_items.price)
        },
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        specialInstructions: item.special_instructions,
        modifiers: item.order_item_modifiers.map(mod => ({
          id: mod.modifiers.id,
          name: mod.modifiers.name,
          priceAdjustment: parseFloat(mod.modifiers.price_adjustment)
        }))
      })),
      payments: order.payments.map(payment => ({
        id: payment.id,
        method: payment.payment_method,
        amount: parseFloat(payment.amount),
        tipAmount: parseFloat(payment.tip_amount || 0),
        status: payment.status,
        processedAt: payment.processed_at
      }))
    }));

    res.json({
      orders: formattedOrders,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: orders.length === parseInt(limit)
      }
    });
  })
);

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private (Staff+)
router.get('/:id',
  authenticateToken,
  requirePermission('staff'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers(first_name, last_name, email, phone),
        users!orders_staff_id_fkey(first_name, last_name),
        order_items(
          *,
          menu_items(name, price),
          order_item_modifiers(
            modifiers(name, price_adjustment)
          )
        ),
        payments(*)
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const formattedOrder = {
      id: order.id,
      orderNumber: order.order_number,
      customer: order.customers ? {
        id: order.customer_id,
        name: `${order.customers.first_name} ${order.customers.last_name}`.trim(),
        email: order.customers.email,
        phone: order.customers.phone
      } : null,
      staff: {
        id: order.staff_id,
        name: `${order.users.first_name} ${order.users.last_name}`
      },
      orderType: order.order_type,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      taxAmount: parseFloat(order.tax_amount),
      discountAmount: parseFloat(order.discount_amount || 0),
      tipAmount: parseFloat(order.tip_amount || 0),
      totalAmount: parseFloat(order.total_amount),
      notes: order.notes,
      tableNumber: order.table_number,
      estimatedReadyTime: order.estimated_ready_time,
      completedAt: order.completed_at,
      createdAt: order.created_at,
      items: order.order_items.map(item => ({
        id: item.id,
        menuItem: {
          id: item.menu_item_id,
          name: item.menu_items.name,
          basePrice: parseFloat(item.menu_items.price)
        },
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        specialInstructions: item.special_instructions,
        modifiers: item.order_item_modifiers.map(mod => ({
          id: mod.modifiers.id,
          name: mod.modifiers.name,
          priceAdjustment: parseFloat(mod.modifiers.price_adjustment)
        }))
      })),
      payments: order.payments.map(payment => ({
        id: payment.id,
        method: payment.payment_method,
        amount: parseFloat(payment.amount),
        tipAmount: parseFloat(payment.tip_amount || 0),
        status: payment.status,
        processedAt: payment.processed_at
      }))
    };

    res.json({ order: formattedOrder });
  })
);

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Staff+)
router.post('/',
  authenticateToken,
  requirePermission('staff'),
  auditLog('CREATE_ORDER'),
  asyncHandler(async (req, res) => {
    const {
      customerId,
      orderType,
      items,
      notes,
      tableNumber,
      taxRate = 0.08 // Default 8% tax
    } = req.body;

    if (!orderType || !items || items.length === 0) {
      return res.status(400).json({
        error: 'Order type and items are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Calculate order totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      // Get menu item details
      const { data: menuItem, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, price')
        .eq('id', item.menuItemId)
        .single();

      if (menuError || !menuItem) {
        return res.status(400).json({
          error: `Menu item not found: ${item.menuItemId}`,
          code: 'MENU_ITEM_NOT_FOUND'
        });
      }

      let itemPrice = parseFloat(menuItem.price);

      // Add modifier prices
      if (item.modifiers && item.modifiers.length > 0) {
        const { data: modifiers, error: modError } = await supabase
          .from('modifiers')
          .select('id, price_adjustment')
          .in('id', item.modifiers);

        if (modError) {
          return res.status(500).json({
            error: 'Failed to fetch modifiers',
            code: 'MODIFIER_ERROR'
          });
        }

        modifiers.forEach(mod => {
          itemPrice += parseFloat(mod.price_adjustment);
        });
      }

      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: itemPrice,
        totalPrice: itemTotal,
        specialInstructions: item.specialInstructions,
        modifiers: item.modifiers || []
      });
    }

    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Generate order number
    const { data: orderNumberResult, error: orderNumberError } = await supabase
      .rpc('generate_order_number');

    if (orderNumberError) {
      return res.status(500).json({
        error: 'Failed to generate order number',
        code: 'ORDER_NUMBER_ERROR'
      });
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumberResult,
        customer_id: customerId || null,
        staff_id: req.user.id,
        order_type: orderType,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: notes,
        table_number: tableNumber
      })
      .select()
      .single();

    if (orderError) {
      return res.status(500).json({
        error: 'Failed to create order',
        code: 'ORDER_CREATE_ERROR'
      });
    }

    // Create order items
    const orderItemsData = orderItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      special_instructions: item.specialInstructions
    }));

    const { data: createdItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)
      .select();

    if (itemsError) {
      return res.status(500).json({
        error: 'Failed to create order items',
        code: 'ORDER_ITEMS_ERROR'
      });
    }

    // Add modifiers to order items
    for (let i = 0; i < createdItems.length; i++) {
      const item = createdItems[i];
      const modifiers = orderItems[i].modifiers;

      if (modifiers.length > 0) {
        const modifierData = modifiers.map(modifierId => ({
          order_item_id: item.id,
          modifier_id: modifierId
        }));

        await supabase
          .from('order_item_modifiers')
          .insert(modifierData);
      }
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        subtotal: parseFloat(order.subtotal),
        taxAmount: parseFloat(order.tax_amount),
        totalAmount: parseFloat(order.total_amount),
        createdAt: order.created_at
      }
    });
  })
);

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (Staff+)
router.patch('/:id/status',
  authenticateToken,
  requirePermission('staff'),
  auditLog('UPDATE_ORDER_STATUS'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, estimatedReadyTime } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Valid status is required',
        code: 'INVALID_STATUS',
        validStatuses
      });
    }

    const updateData = { status };
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    if (estimatedReadyTime) {
      updateData.estimated_ready_time = estimatedReadyTime;
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update order status',
        code: 'UPDATE_ERROR'
      });
    }

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    res.json({
      message: 'Order status updated successfully',
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        estimatedReadyTime: order.estimated_ready_time,
        completedAt: order.completed_at
      }
    });
  })
);

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private (Manager+)
router.delete('/:id',
  authenticateToken,
  requirePermission('manager'),
  auditLog('CANCEL_ORDER'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    // Check if order can be cancelled
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status, total_amount')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        error: 'Cannot cancel completed or already cancelled order',
        code: 'CANNOT_CANCEL'
      });
    }

    // Update order status to cancelled
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled'
      })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to cancel order',
        code: 'CANCEL_ERROR'
      });
    }

    res.json({
      message: 'Order cancelled successfully'
    });
  })
);

module.exports = router;