const express = require('express');
const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// @desc    Get sales summary
// @route   GET /api/reports/sales
// @access  Private (Manager+)
router.get('/sales',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    const { 
      startDate, 
      endDate, 
      period = 'day',
      groupBy = 'date'
    } = req.query;

    // Default to today if no dates provided
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    
    if (!startDate) {
      start.setHours(0, 0, 0, 0);
    }
    if (!endDate) {
      end.setHours(23, 59, 59, 999);
    }

    // Get sales data
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        subtotal,
        tax_amount,
        tip_amount,
        status,
        order_type,
        created_at,
        order_items(
          quantity,
          total_price,
          menu_items(name, category_id, menu_categories(name))
        ),
        users!orders_staff_id_fkey(first_name, last_name)
      `)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .eq('status', 'completed')
      .order('created_at');

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch sales data',
        code: 'FETCH_ERROR'
      });
    }

    // Calculate summary metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
    const totalTips = orders.reduce((sum, order) => sum + parseFloat(order.tip_amount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Group by order type
    const orderTypeBreakdown = orders.reduce((acc, order) => {
      const type = order.order_type;
      if (!acc[type]) {
        acc[type] = { count: 0, revenue: 0 };
      }
      acc[type].count++;
      acc[type].revenue += parseFloat(order.total_amount);
      return acc;
    }, {});

    // Top selling items
    const itemSales = {};
    orders.forEach(order => {
      order.order_items.forEach(item => {
        const itemName = item.menu_items.name;
        if (!itemSales[itemName]) {
          itemSales[itemName] = {
            name: itemName,
            category: item.menu_items.menu_categories?.name || 'Unknown',
            quantity: 0,
            revenue: 0
          };
        }
        itemSales[itemName].quantity += item.quantity;
        itemSales[itemName].revenue += parseFloat(item.total_price);
      });
    });

    const topSellingItems = Object.values(itemSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Category breakdown
    const categoryBreakdown = {};
    orders.forEach(order => {
      order.order_items.forEach(item => {
        const category = item.menu_items.menu_categories?.name || 'Unknown';
        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = { revenue: 0, quantity: 0 };
        }
        categoryBreakdown[category].revenue += parseFloat(item.total_price);
        categoryBreakdown[category].quantity += item.quantity;
      });
    });

    // Staff performance
    const staffPerformance = {};
    orders.forEach(order => {
      const staffName = `${order.users.first_name} ${order.users.last_name}`;
      if (!staffPerformance[staffName]) {
        staffPerformance[staffName] = {
          name: staffName,
          orders: 0,
          revenue: 0
        };
      }
      staffPerformance[staffName].orders++;
      staffPerformance[staffName].revenue += parseFloat(order.total_amount);
    });

    // Hourly breakdown (for today only)
    let hourlyBreakdown = null;
    if (period === 'hour' || (start.toDateString() === end.toDateString() && start.toDateString() === new Date().toDateString())) {
      hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        orders: 0,
        revenue: 0
      }));

      orders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourlyBreakdown[hour].orders++;
        hourlyBreakdown[hour].revenue += parseFloat(order.total_amount);
      });
    }

    res.json({
      summary: {
        totalOrders,
        totalRevenue,
        totalTips,
        averageOrderValue,
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      },
      orderTypeBreakdown,
      topSellingItems,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([name, data]) => ({
        category: name,
        ...data
      })),
      staffPerformance: Object.values(staffPerformance).sort((a, b) => b.revenue - a.revenue),
      hourlyBreakdown
    });
  })
);

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private (Manager+)
router.get('/inventory',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    // Get inventory data
    const { data: items, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers(name)
      `)
      .order('name');

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch inventory data',
        code: 'FETCH_ERROR'
      });
    }

    // Calculate metrics
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => 
      sum + (parseFloat(item.current_stock) * parseFloat(item.cost_per_unit)), 0
    );
    
    const lowStockItems = items.filter(item => 
      parseFloat(item.current_stock) <= parseFloat(item.minimum_stock)
    );
    
    const outOfStockItems = items.filter(item => 
      parseFloat(item.current_stock) === 0
    );

    // Group by supplier
    const supplierBreakdown = {};
    items.forEach(item => {
      const supplierName = item.suppliers?.name || 'No Supplier';
      if (!supplierBreakdown[supplierName]) {
        supplierBreakdown[supplierName] = {
          name: supplierName,
          itemCount: 0,
          totalValue: 0,
          lowStockCount: 0
        };
      }
      supplierBreakdown[supplierName].itemCount++;
      supplierBreakdown[supplierName].totalValue += 
        parseFloat(item.current_stock) * parseFloat(item.cost_per_unit);
      
      if (parseFloat(item.current_stock) <= parseFloat(item.minimum_stock)) {
        supplierBreakdown[supplierName].lowStockCount++;
      }
    });

    // Most valuable items
    const mostValuableItems = items
      .map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        currentStock: parseFloat(item.current_stock),
        costPerUnit: parseFloat(item.cost_per_unit),
        totalValue: parseFloat(item.current_stock) * parseFloat(item.cost_per_unit),
        supplier: item.suppliers?.name || 'No Supplier'
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    res.json({
      summary: {
        totalItems,
        totalValue,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length
      },
      lowStockItems: lowStockItems.map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        currentStock: parseFloat(item.current_stock),
        minimumStock: parseFloat(item.minimum_stock),
        unitOfMeasure: item.unit_of_measure,
        supplier: item.suppliers?.name || 'No Supplier'
      })),
      outOfStockItems: outOfStockItems.map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        minimumStock: parseFloat(item.minimum_stock),
        unitOfMeasure: item.unit_of_measure,
        supplier: item.suppliers?.name || 'No Supplier'
      })),
      supplierBreakdown: Object.values(supplierBreakdown),
      mostValuableItems
    });
  })
);

// @desc    Get customer analytics
// @route   GET /api/reports/customers
// @access  Private (Manager+)
router.get('/customers',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get customer data
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select(`
        *,
        orders!inner(
          id,
          total_amount,
          created_at,
          status
        )
      `)
      .gte('orders.created_at', start.toISOString())
      .lte('orders.created_at', end.toISOString())
      .eq('orders.status', 'completed');

    if (customerError) {
      return res.status(500).json({
        error: 'Failed to fetch customer data',
        code: 'FETCH_ERROR'
      });
    }

    // Get all customers for total count
    const { data: allCustomers, error: allCustomersError } = await supabase
      .from('customers')
      .select('id, created_at, total_spent, visit_count, loyalty_points');

    if (allCustomersError) {
      return res.status(500).json({
        error: 'Failed to fetch all customers data',
        code: 'FETCH_ERROR'
      });
    }

    // Calculate metrics
    const totalCustomers = allCustomers.length;
    const activeCustomers = customers.length;
    const newCustomers = allCustomers.filter(customer => 
      new Date(customer.created_at) >= start && new Date(customer.created_at) <= end
    ).length;

    // Top customers by spending
    const topCustomers = customers
      .map(customer => ({
        id: customer.id,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown',
        email: customer.email,
        totalSpent: parseFloat(customer.total_spent),
        visitCount: customer.visit_count,
        loyaltyPoints: customer.loyalty_points,
        ordersInPeriod: customer.orders.length,
        revenueInPeriod: customer.orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
      }))
      .sort((a, b) => b.revenueInPeriod - a.revenueInPeriod)
      .slice(0, 10);

    // Customer segments
    const segments = {
      new: allCustomers.filter(c => c.visit_count <= 1).length,
      regular: allCustomers.filter(c => c.visit_count > 1 && c.visit_count <= 5).length,
      loyal: allCustomers.filter(c => c.visit_count > 5 && c.visit_count <= 15).length,
      vip: allCustomers.filter(c => c.visit_count > 15).length
    };

    // Loyalty points distribution
    const loyaltyDistribution = {
      noPoints: allCustomers.filter(c => c.loyalty_points === 0).length,
      lowPoints: allCustomers.filter(c => c.loyalty_points > 0 && c.loyalty_points <= 100).length,
      mediumPoints: allCustomers.filter(c => c.loyalty_points > 100 && c.loyalty_points <= 500).length,
      highPoints: allCustomers.filter(c => c.loyalty_points > 500).length
    };

    res.json({
      summary: {
        totalCustomers,
        activeCustomers,
        newCustomers,
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      },
      topCustomers,
      segments,
      loyaltyDistribution
    });
  })
);

// @desc    Get financial summary
// @route   GET /api/reports/financial
// @access  Private (Admin only)
router.get('/financial',
  authenticateToken,
  requirePermission('admin'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get completed orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        total_amount,
        subtotal,
        tax_amount,
        tip_amount,
        created_at,
        order_items(
          quantity,
          total_price,
          menu_items(cost)
        )
      `)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .eq('status', 'completed');

    if (ordersError) {
      return res.status(500).json({
        error: 'Failed to fetch orders data',
        code: 'FETCH_ERROR'
      });
    }

    // Get payments data
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('payment_method, amount, tip_amount, refund_amount, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .eq('status', 'completed');

    if (paymentsError) {
      return res.status(500).json({
        error: 'Failed to fetch payments data',
        code: 'FETCH_ERROR'
      });
    }

    // Calculate revenue metrics
    const grossRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
    const totalTips = orders.reduce((sum, order) => sum + parseFloat(order.tip_amount || 0), 0);
    const totalTax = orders.reduce((sum, order) => sum + parseFloat(order.tax_amount), 0);
    const netRevenue = grossRevenue - totalTax;

    // Calculate cost of goods sold (COGS)
    let totalCOGS = 0;
    orders.forEach(order => {
      order.order_items.forEach(item => {
        if (item.menu_items.cost) {
          totalCOGS += parseFloat(item.menu_items.cost) * item.quantity;
        }
      });
    });

    const grossProfit = netRevenue - totalCOGS;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // Payment method breakdown
    const paymentMethodBreakdown = payments.reduce((acc, payment) => {
      const method = payment.payment_method;
      if (!acc[method]) {
        acc[method] = { count: 0, amount: 0 };
      }
      acc[method].count++;
      acc[method].amount += parseFloat(payment.amount);
      return acc;
    }, {});

    // Refunds
    const totalRefunds = payments.reduce((sum, payment) => 
      sum + parseFloat(payment.refund_amount || 0), 0
    );

    // Daily breakdown
    const dailyBreakdown = {};
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = {
          date,
          revenue: 0,
          orders: 0,
          tips: 0
        };
      }
      dailyBreakdown[date].revenue += parseFloat(order.total_amount);
      dailyBreakdown[date].orders++;
      dailyBreakdown[date].tips += parseFloat(order.tip_amount || 0);
    });

    res.json({
      summary: {
        grossRevenue,
        netRevenue,
        totalTips,
        totalTax,
        totalCOGS,
        grossProfit,
        grossMargin,
        totalRefunds,
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      },
      paymentMethodBreakdown,
      dailyBreakdown: Object.values(dailyBreakdown).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      )
    });
  })
);

module.exports = router;