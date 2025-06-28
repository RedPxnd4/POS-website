const express = require('express');
const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private (Manager+)
router.get('/',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    const { lowStock, search, supplierId } = req.query;

    let query = supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers(name, contact_person, email, phone)
      `);

    if (lowStock === 'true') {
      query = query.lt('current_stock', supabase.raw('minimum_stock'));
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: items, error } = await query.order('name');

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch inventory items',
        code: 'FETCH_ERROR'
      });
    }

    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unitOfMeasure: item.unit_of_measure,
      currentStock: parseFloat(item.current_stock),
      minimumStock: parseFloat(item.minimum_stock),
      maximumStock: item.maximum_stock ? parseFloat(item.maximum_stock) : null,
      costPerUnit: parseFloat(item.cost_per_unit),
      totalValue: parseFloat(item.current_stock) * parseFloat(item.cost_per_unit),
      isLowStock: parseFloat(item.current_stock) <= parseFloat(item.minimum_stock),
      lastRestocked: item.last_restocked,
      supplier: item.suppliers ? {
        id: item.supplier_id,
        name: item.suppliers.name,
        contactPerson: item.suppliers.contact_person,
        email: item.suppliers.email,
        phone: item.suppliers.phone
      } : null,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    res.json({
      items: formattedItems,
      summary: {
        totalItems: formattedItems.length,
        lowStockItems: formattedItems.filter(item => item.isLowStock).length,
        totalValue: formattedItems.reduce((sum, item) => sum + item.totalValue, 0)
      }
    });
  })
);

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private (Manager+)
router.get('/:id',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers(name, contact_person, email, phone),
        recipe_ingredients(
          menu_items(id, name, price)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({
        error: 'Inventory item not found',
        code: 'ITEM_NOT_FOUND'
      });
    }

    const formattedItem = {
      id: item.id,
      name: item.name,
      sku: item.sku,
      unitOfMeasure: item.unit_of_measure,
      currentStock: parseFloat(item.current_stock),
      minimumStock: parseFloat(item.minimum_stock),
      maximumStock: item.maximum_stock ? parseFloat(item.maximum_stock) : null,
      costPerUnit: parseFloat(item.cost_per_unit),
      totalValue: parseFloat(item.current_stock) * parseFloat(item.cost_per_unit),
      isLowStock: parseFloat(item.current_stock) <= parseFloat(item.minimum_stock),
      lastRestocked: item.last_restocked,
      supplier: item.suppliers ? {
        id: item.supplier_id,
        name: item.suppliers.name,
        contactPerson: item.suppliers.contact_person,
        email: item.suppliers.email,
        phone: item.suppliers.phone
      } : null,
      usedInMenuItems: item.recipe_ingredients.map(ri => ({
        id: ri.menu_items.id,
        name: ri.menu_items.name,
        price: parseFloat(ri.menu_items.price)
      })),
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };

    res.json({ item: formattedItem });
  })
);

// @desc    Create inventory item
// @route   POST /api/inventory
// @access  Private (Manager+)
router.post('/',
  authenticateToken,
  requirePermission('manager'),
  auditLog('CREATE_INVENTORY_ITEM'),
  asyncHandler(async (req, res) => {
    const {
      name,
      sku,
      unitOfMeasure,
      currentStock,
      minimumStock,
      maximumStock,
      costPerUnit,
      supplierId
    } = req.body;

    if (!name || !unitOfMeasure || currentStock === undefined || minimumStock === undefined || costPerUnit === undefined) {
      return res.status(400).json({
        error: 'Name, unit of measure, current stock, minimum stock, and cost per unit are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Check if SKU already exists
    if (sku) {
      const { data: existingItem } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('sku', sku)
        .single();

      if (existingItem) {
        return res.status(409).json({
          error: 'SKU already exists',
          code: 'SKU_EXISTS'
        });
      }
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        name,
        sku,
        unit_of_measure: unitOfMeasure,
        current_stock: parseFloat(currentStock),
        minimum_stock: parseFloat(minimumStock),
        maximum_stock: maximumStock ? parseFloat(maximumStock) : null,
        cost_per_unit: parseFloat(costPerUnit),
        supplier_id: supplierId,
        last_restocked: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to create inventory item',
        code: 'CREATE_ERROR'
      });
    }

    res.status(201).json({
      message: 'Inventory item created successfully',
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unitOfMeasure: item.unit_of_measure,
        currentStock: parseFloat(item.current_stock),
        minimumStock: parseFloat(item.minimum_stock),
        maximumStock: item.maximum_stock ? parseFloat(item.maximum_stock) : null,
        costPerUnit: parseFloat(item.cost_per_unit),
        totalValue: parseFloat(item.current_stock) * parseFloat(item.cost_per_unit),
        isLowStock: parseFloat(item.current_stock) <= parseFloat(item.minimum_stock),
        lastRestocked: item.last_restocked,
        createdAt: item.created_at
      }
    });
  })
);

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private (Manager+)
router.put('/:id',
  authenticateToken,
  requirePermission('manager'),
  auditLog('UPDATE_INVENTORY_ITEM'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      sku,
      unitOfMeasure,
      minimumStock,
      maximumStock,
      costPerUnit,
      supplierId
    } = req.body;

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (sku !== undefined) updateData.sku = sku;
    if (unitOfMeasure !== undefined) updateData.unit_of_measure = unitOfMeasure;
    if (minimumStock !== undefined) updateData.minimum_stock = parseFloat(minimumStock);
    if (maximumStock !== undefined) updateData.maximum_stock = maximumStock ? parseFloat(maximumStock) : null;
    if (costPerUnit !== undefined) updateData.cost_per_unit = parseFloat(costPerUnit);
    if (supplierId !== undefined) updateData.supplier_id = supplierId;

    // Check if SKU already exists (excluding current item)
    if (sku) {
      const { data: existingItem } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('sku', sku)
        .neq('id', id)
        .single();

      if (existingItem) {
        return res.status(409).json({
          error: 'SKU already exists',
          code: 'SKU_EXISTS'
        });
      }
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update inventory item',
        code: 'UPDATE_ERROR'
      });
    }

    if (!item) {
      return res.status(404).json({
        error: 'Inventory item not found',
        code: 'ITEM_NOT_FOUND'
      });
    }

    res.json({
      message: 'Inventory item updated successfully',
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unitOfMeasure: item.unit_of_measure,
        currentStock: parseFloat(item.current_stock),
        minimumStock: parseFloat(item.minimum_stock),
        maximumStock: item.maximum_stock ? parseFloat(item.maximum_stock) : null,
        costPerUnit: parseFloat(item.cost_per_unit),
        totalValue: parseFloat(item.current_stock) * parseFloat(item.cost_per_unit),
        isLowStock: parseFloat(item.current_stock) <= parseFloat(item.minimum_stock),
        lastRestocked: item.last_restocked,
        updatedAt: item.updated_at
      }
    });
  })
);

// @desc    Adjust inventory stock
// @route   PATCH /api/inventory/:id/adjust
// @access  Private (Manager+)
router.patch('/:id/adjust',
  authenticateToken,
  requirePermission('manager'),
  auditLog('ADJUST_INVENTORY_STOCK'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adjustment, reason, type = 'adjustment' } = req.body;

    if (adjustment === undefined || adjustment === 0) {
      return res.status(400).json({
        error: 'Stock adjustment amount is required',
        code: 'MISSING_ADJUSTMENT'
      });
    }

    const validTypes = ['adjustment', 'restock', 'waste', 'sale'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid adjustment type',
        code: 'INVALID_TYPE',
        validTypes
      });
    }

    // Get current stock
    const { data: currentItem, error: fetchError } = await supabase
      .from('inventory_items')
      .select('current_stock, name')
      .eq('id', id)
      .single();

    if (fetchError || !currentItem) {
      return res.status(404).json({
        error: 'Inventory item not found',
        code: 'ITEM_NOT_FOUND'
      });
    }

    const currentStock = parseFloat(currentItem.current_stock);
    const adjustmentAmount = parseFloat(adjustment);
    const newStock = currentStock + adjustmentAmount;

    if (newStock < 0) {
      return res.status(400).json({
        error: 'Stock cannot be negative',
        code: 'NEGATIVE_STOCK',
        currentStock: currentStock,
        adjustment: adjustmentAmount,
        resultingStock: newStock
      });
    }

    // Update stock
    const updateData = {
      current_stock: newStock
    };

    if (type === 'restock' && adjustmentAmount > 0) {
      updateData.last_restocked = new Date().toISOString();
    }

    const { data: item, error: updateError } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to adjust inventory stock',
        code: 'UPDATE_ERROR'
      });
    }

    res.json({
      message: 'Inventory stock adjusted successfully',
      adjustment: {
        itemName: currentItem.name,
        previousStock: currentStock,
        adjustment: adjustmentAmount,
        newStock: newStock,
        type: type,
        reason: reason || 'No reason provided'
      }
    });
  })
);

// @desc    Get low stock alerts
// @route   GET /api/inventory/alerts
// @access  Private (Manager+)
router.get('/alerts',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    const { data: lowStockItems, error } = await supabase
      .from('inventory_items')
      .select(`
        id,
        name,
        sku,
        current_stock,
        minimum_stock,
        unit_of_measure,
        suppliers(name)
      `)
      .lt('current_stock', supabase.raw('minimum_stock'))
      .order('current_stock');

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch low stock alerts',
        code: 'FETCH_ERROR'
      });
    }

    const alerts = lowStockItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      currentStock: parseFloat(item.current_stock),
      minimumStock: parseFloat(item.minimum_stock),
      unitOfMeasure: item.unit_of_measure,
      shortage: parseFloat(item.minimum_stock) - parseFloat(item.current_stock),
      supplier: item.suppliers?.name || 'No supplier',
      severity: parseFloat(item.current_stock) === 0 ? 'critical' : 'warning'
    }));

    res.json({
      alerts: alerts,
      summary: {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(alert => alert.severity === 'critical').length,
        warningAlerts: alerts.filter(alert => alert.severity === 'warning').length
      }
    });
  })
);

// @desc    Get suppliers
// @route   GET /api/inventory/suppliers
// @access  Private (Manager+)
router.get('/suppliers',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        inventory_items(id)
      `)
      .eq('is_active', true)
      .order('name');

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch suppliers',
        code: 'FETCH_ERROR'
      });
    }

    const formattedSuppliers = suppliers.map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contact_person,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      isActive: supplier.is_active,
      itemCount: supplier.inventory_items.length,
      createdAt: supplier.created_at
    }));

    res.json({
      suppliers: formattedSuppliers
    });
  })
);

module.exports = router;