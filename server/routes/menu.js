const express = require('express');
const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all menu categories
// @route   GET /api/menu/categories
// @access  Public
router.get('/categories', asyncHandler(async (req, res) => {
  const { data: categories, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    return res.status(500).json({
      error: 'Failed to fetch categories',
      code: 'FETCH_ERROR'
    });
  }

  res.json({
    categories: categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      displayOrder: cat.display_order,
      imageUrl: cat.image_url,
      isActive: cat.is_active
    }))
  });
}));

// @desc    Get menu items by category
// @route   GET /api/menu/categories/:categoryId/items
// @access  Public
router.get('/categories/:categoryId/items', asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  const { data: items, error } = await supabase
    .from('menu_items')
    .select(`
      *,
      menu_categories!inner(name),
      item_modifier_groups(
        modifier_groups(
          id,
          name,
          is_required,
          min_selections,
          max_selections,
          display_order,
          modifiers(
            id,
            name,
            price_adjustment,
            is_default,
            display_order
          )
        )
      )
    `)
    .eq('category_id', categoryId)
    .eq('is_available', true)
    .order('name');

  if (error) {
    return res.status(500).json({
      error: 'Failed to fetch menu items',
      code: 'FETCH_ERROR'
    });
  }

  const formattedItems = items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: parseFloat(item.price),
    prepTime: item.prep_time_minutes,
    calories: item.calories,
    isAvailable: item.is_available,
    isFeatured: item.is_featured,
    dietaryRestrictions: item.dietary_restrictions || [],
    allergens: item.allergens || [],
    imageUrl: item.image_url,
    category: item.menu_categories.name,
    modifierGroups: item.item_modifier_groups.map(img => ({
      id: img.modifier_groups.id,
      name: img.modifier_groups.name,
      isRequired: img.modifier_groups.is_required,
      minSelections: img.modifier_groups.min_selections,
      maxSelections: img.modifier_groups.max_selections,
      displayOrder: img.modifier_groups.display_order,
      modifiers: img.modifier_groups.modifiers.map(mod => ({
        id: mod.id,
        name: mod.name,
        priceAdjustment: parseFloat(mod.price_adjustment),
        isDefault: mod.is_default,
        displayOrder: mod.display_order
      })).sort((a, b) => a.displayOrder - b.displayOrder)
    })).sort((a, b) => a.displayOrder - b.displayOrder)
  }));

  res.json({
    items: formattedItems
  });
}));

// @desc    Get all menu items
// @route   GET /api/menu/items
// @access  Public
router.get('/items', asyncHandler(async (req, res) => {
  const { search, category, available } = req.query;

  let query = supabase
    .from('menu_items')
    .select(`
      *,
      menu_categories(name, id)
    `);

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (category) {
    query = query.eq('category_id', category);
  }

  if (available !== undefined) {
    query = query.eq('is_available', available === 'true');
  }

  const { data: items, error } = await query.order('name');

  if (error) {
    return res.status(500).json({
      error: 'Failed to fetch menu items',
      code: 'FETCH_ERROR'
    });
  }

  res.json({
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      cost: item.cost ? parseFloat(item.cost) : null,
      prepTime: item.prep_time_minutes,
      calories: item.calories,
      isAvailable: item.is_available,
      isFeatured: item.is_featured,
      dietaryRestrictions: item.dietary_restrictions || [],
      allergens: item.allergens || [],
      imageUrl: item.image_url,
      category: item.menu_categories
    }))
  });
}));

// @desc    Create menu category
// @route   POST /api/menu/categories
// @access  Private (Manager+)
router.post('/categories', 
  authenticateToken, 
  requirePermission('manager'), 
  auditLog('CREATE_CATEGORY'),
  asyncHandler(async (req, res) => {
    const { name, description, displayOrder, imageUrl } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Category name is required',
        code: 'MISSING_NAME'
      });
    }

    const { data: category, error } = await supabase
      .from('menu_categories')
      .insert({
        name,
        description,
        display_order: displayOrder || 0,
        image_url: imageUrl
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to create category',
        code: 'CREATE_ERROR'
      });
    }

    res.status(201).json({
      message: 'Category created successfully',
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        displayOrder: category.display_order,
        imageUrl: category.image_url,
        isActive: category.is_active
      }
    });
  })
);

// @desc    Create menu item
// @route   POST /api/menu/items
// @access  Private (Manager+)
router.post('/items',
  authenticateToken,
  requirePermission('manager'),
  auditLog('CREATE_MENU_ITEM'),
  asyncHandler(async (req, res) => {
    const {
      categoryId,
      name,
      description,
      price,
      cost,
      prepTime,
      calories,
      dietaryRestrictions,
      allergens,
      imageUrl,
      modifierGroups
    } = req.body;

    if (!categoryId || !name || !price) {
      return res.status(400).json({
        error: 'Category ID, name, and price are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Create menu item
    const { data: item, error } = await supabase
      .from('menu_items')
      .insert({
        category_id: categoryId,
        name,
        description,
        price: parseFloat(price),
        cost: cost ? parseFloat(cost) : null,
        prep_time_minutes: prepTime || 0,
        calories: calories || null,
        dietary_restrictions: dietaryRestrictions || [],
        allergens: allergens || [],
        image_url: imageUrl
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to create menu item',
        code: 'CREATE_ERROR'
      });
    }

    // Link modifier groups if provided
    if (modifierGroups && modifierGroups.length > 0) {
      const modifierGroupLinks = modifierGroups.map(groupId => ({
        item_id: item.id,
        group_id: groupId
      }));

      await supabase
        .from('item_modifier_groups')
        .insert(modifierGroupLinks);
    }

    res.status(201).json({
      message: 'Menu item created successfully',
      item: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price),
        cost: item.cost ? parseFloat(item.cost) : null,
        prepTime: item.prep_time_minutes,
        calories: item.calories,
        isAvailable: item.is_available,
        isFeatured: item.is_featured,
        dietaryRestrictions: item.dietary_restrictions || [],
        allergens: item.allergens || [],
        imageUrl: item.image_url
      }
    });
  })
);

// @desc    Update menu item
// @route   PUT /api/menu/items/:id
// @access  Private (Manager+)
router.put('/items/:id',
  authenticateToken,
  requirePermission('manager'),
  auditLog('UPDATE_MENU_ITEM'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      cost,
      prepTime,
      calories,
      isAvailable,
      isFeatured,
      dietaryRestrictions,
      allergens,
      imageUrl
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (cost !== undefined) updateData.cost = cost ? parseFloat(cost) : null;
    if (prepTime !== undefined) updateData.prep_time_minutes = prepTime;
    if (calories !== undefined) updateData.calories = calories;
    if (isAvailable !== undefined) updateData.is_available = isAvailable;
    if (isFeatured !== undefined) updateData.is_featured = isFeatured;
    if (dietaryRestrictions !== undefined) updateData.dietary_restrictions = dietaryRestrictions;
    if (allergens !== undefined) updateData.allergens = allergens;
    if (imageUrl !== undefined) updateData.image_url = imageUrl;

    const { data: item, error } = await supabase
      .from('menu_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update menu item',
        code: 'UPDATE_ERROR'
      });
    }

    if (!item) {
      return res.status(404).json({
        error: 'Menu item not found',
        code: 'ITEM_NOT_FOUND'
      });
    }

    res.json({
      message: 'Menu item updated successfully',
      item: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price),
        cost: item.cost ? parseFloat(item.cost) : null,
        prepTime: item.prep_time_minutes,
        calories: item.calories,
        isAvailable: item.is_available,
        isFeatured: item.is_featured,
        dietaryRestrictions: item.dietary_restrictions || [],
        allergens: item.allergens || [],
        imageUrl: item.image_url
      }
    });
  })
);

// @desc    Delete menu item
// @route   DELETE /api/menu/items/:id
// @access  Private (Manager+)
router.delete('/items/:id',
  authenticateToken,
  requirePermission('manager'),
  auditLog('DELETE_MENU_ITEM'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({
        error: 'Failed to delete menu item',
        code: 'DELETE_ERROR'
      });
    }

    res.json({
      message: 'Menu item deleted successfully'
    });
  })
);

// @desc    Get modifier groups
// @route   GET /api/menu/modifier-groups
// @access  Private (Manager+)
router.get('/modifier-groups',
  authenticateToken,
  requirePermission('manager'),
  asyncHandler(async (req, res) => {
    const { data: groups, error } = await supabase
      .from('modifier_groups')
      .select(`
        *,
        modifiers(*)
      `)
      .order('display_order');

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch modifier groups',
        code: 'FETCH_ERROR'
      });
    }

    res.json({
      modifierGroups: groups.map(group => ({
        id: group.id,
        name: group.name,
        isRequired: group.is_required,
        minSelections: group.min_selections,
        maxSelections: group.max_selections,
        displayOrder: group.display_order,
        modifiers: group.modifiers.map(mod => ({
          id: mod.id,
          name: mod.name,
          priceAdjustment: parseFloat(mod.price_adjustment),
          isDefault: mod.is_default,
          displayOrder: mod.display_order
        })).sort((a, b) => a.displayOrder - b.displayOrder)
      }))
    });
  })
);

module.exports = router;