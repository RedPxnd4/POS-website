/*
  # Seed Data for POS System

  1. Initial Data
    - Default admin user
    - Sample menu categories and items
    - Basic modifier groups
    - Sample inventory items
    - Suppliers

  2. Test Data
    - Sample customers
    - Demo orders for testing
*/

-- Insert default admin user (password: Admin123!)
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active) VALUES
('admin@pos.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9PS', 'System', 'Administrator', 'admin', true),
('manager@pos.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9PS', 'John', 'Manager', 'manager', true),
('staff@pos.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9PS', 'Jane', 'Staff', 'staff', true);

-- Insert menu categories
INSERT INTO menu_categories (name, description, display_order, is_active) VALUES
('Appetizers', 'Start your meal right with our delicious appetizers', 1, true),
('Main Courses', 'Hearty and satisfying main dishes', 2, true),
('Wraps & Sandwiches', 'Fresh wraps and sandwiches made to order', 3, true),
('Beverages', 'Refreshing drinks to complement your meal', 4, true),
('Desserts', 'Sweet treats to end your meal perfectly', 5, true);

-- Get category IDs for menu items
DO $$
DECLARE
    appetizers_id UUID;
    mains_id UUID;
    wraps_id UUID;
    beverages_id UUID;
    desserts_id UUID;
BEGIN
    SELECT id INTO appetizers_id FROM menu_categories WHERE name = 'Appetizers';
    SELECT id INTO mains_id FROM menu_categories WHERE name = 'Main Courses';
    SELECT id INTO wraps_id FROM menu_categories WHERE name = 'Wraps & Sandwiches';
    SELECT id INTO beverages_id FROM menu_categories WHERE name = 'Beverages';
    SELECT id INTO desserts_id FROM menu_categories WHERE name = 'Desserts';

    -- Insert menu items
    INSERT INTO menu_items (category_id, name, description, price, cost, prep_time_minutes, calories, is_available, dietary_restrictions, allergens) VALUES
    -- Appetizers
    (appetizers_id, 'Hummus & Pita', 'Creamy hummus served with warm pita bread and olive oil drizzle', 8.99, 3.50, 5, 320, true, ARRAY['vegetarian', 'vegan'], ARRAY['gluten']),
    (appetizers_id, 'Falafel Plate', 'Six crispy chickpea fritters with tahini sauce and fresh vegetables', 9.99, 4.00, 8, 280, true, ARRAY['vegetarian', 'vegan'], ARRAY[]::text[]),
    (appetizers_id, 'Stuffed Grape Leaves', 'Rice-stuffed grape leaves with herbs and spices', 7.99, 3.00, 3, 180, true, ARRAY['vegetarian', 'vegan'], ARRAY[]::text[]),
    (appetizers_id, 'Mediterranean Sampler', 'Hummus, baba ganoush, tabbouleh, and pita bread', 12.99, 5.50, 7, 450, true, ARRAY['vegetarian'], ARRAY['gluten']),
    
    -- Main Courses
    (mains_id, 'Chicken Shawarma Platter', 'Marinated grilled chicken over seasoned rice with salad', 14.99, 7.00, 15, 580, true, ARRAY['gluten-free'], ARRAY[]::text[]),
    (mains_id, 'Lamb Kabob Platter', 'Tender lamb kabobs with rice, grilled vegetables, and tzatziki', 18.99, 9.50, 18, 650, true, ARRAY[]::text[], ARRAY['dairy']),
    (mains_id, 'Mixed Grill Platter', 'Combination of chicken and lamb with rice and salad', 16.99, 8.00, 20, 720, true, ARRAY[]::text[], ARRAY['dairy']),
    (mains_id, 'Vegetarian Moussaka', 'Layers of eggplant, lentils, and béchamel sauce', 13.99, 6.00, 25, 480, true, ARRAY['vegetarian'], ARRAY['dairy', 'gluten']),
    
    -- Wraps & Sandwiches
    (wraps_id, 'Chicken Shawarma Wrap', 'Marinated chicken with vegetables and garlic sauce in pita', 9.99, 4.50, 8, 420, true, ARRAY[]::text[], ARRAY['gluten']),
    (wraps_id, 'Lamb Gyro Wrap', 'Sliced lamb gyro with tzatziki and vegetables in pita', 10.99, 5.00, 8, 460, true, ARRAY[]::text[], ARRAY['gluten', 'dairy']),
    (wraps_id, 'Falafel Wrap', 'Crispy falafel with tahini sauce and fresh vegetables', 8.99, 3.50, 6, 380, true, ARRAY['vegetarian', 'vegan'], ARRAY['gluten']),
    (wraps_id, 'Grilled Halloumi Wrap', 'Grilled halloumi cheese with vegetables and herbs', 9.49, 4.00, 7, 390, true, ARRAY['vegetarian'], ARRAY['gluten', 'dairy']),
    
    -- Beverages
    (beverages_id, 'Fresh Mint Lemonade', 'Refreshing lemonade with fresh mint and rose water', 4.99, 1.50, 3, 120, true, ARRAY['vegan'], ARRAY[]::text[]),
    (beverages_id, 'Turkish Coffee', 'Traditional Turkish coffee served with Turkish delight', 3.99, 1.00, 5, 15, true, ARRAY['vegan'], ARRAY[]::text[]),
    (beverages_id, 'Mango Lassi', 'Creamy yogurt drink blended with fresh mango', 4.49, 1.80, 3, 180, true, ARRAY['vegetarian'], ARRAY['dairy']),
    (beverages_id, 'Hibiscus Iced Tea', 'Refreshing herbal tea with a hint of citrus', 3.49, 1.20, 2, 25, true, ARRAY['vegan'], ARRAY[]::text[]),
    
    -- Desserts
    (desserts_id, 'Baklava', 'Layers of phyllo pastry with nuts and honey syrup', 5.99, 2.50, 2, 280, true, ARRAY['vegetarian'], ARRAY['gluten', 'nuts']),
    (desserts_id, 'Rice Pudding', 'Creamy rice pudding with cinnamon and pistachios', 4.99, 2.00, 3, 220, true, ARRAY['vegetarian'], ARRAY['dairy', 'nuts']),
    (desserts_id, 'Kunafa', 'Sweet cheese pastry with crispy shredded phyllo', 6.99, 3.00, 5, 320, true, ARRAY['vegetarian'], ARRAY['gluten', 'dairy']);
END $$;

-- Insert modifier groups
INSERT INTO modifier_groups (name, is_required, min_selections, max_selections, display_order) VALUES
('Size Options', true, 1, 1, 1),
('Spice Level', false, 0, 1, 2),
('Add-ons', false, 0, 5, 3),
('Sauce Options', false, 0, 3, 4),
('Temperature', false, 0, 1, 5);

-- Get modifier group IDs and insert modifiers
DO $$
DECLARE
    size_group_id UUID;
    spice_group_id UUID;
    addons_group_id UUID;
    sauce_group_id UUID;
    temp_group_id UUID;
BEGIN
    SELECT id INTO size_group_id FROM modifier_groups WHERE name = 'Size Options';
    SELECT id INTO spice_group_id FROM modifier_groups WHERE name = 'Spice Level';
    SELECT id INTO addons_group_id FROM modifier_groups WHERE name = 'Add-ons';
    SELECT id INTO sauce_group_id FROM modifier_groups WHERE name = 'Sauce Options';
    SELECT id INTO temp_group_id FROM modifier_groups WHERE name = 'Temperature';

    -- Size modifiers
    INSERT INTO modifiers (group_id, name, price_adjustment, is_default, display_order) VALUES
    (size_group_id, 'Regular', 0.00, true, 1),
    (size_group_id, 'Large', 2.00, false, 2),
    (size_group_id, 'Extra Large', 3.50, false, 3),
    
    -- Spice level modifiers
    (spice_group_id, 'Mild', 0.00, true, 1),
    (spice_group_id, 'Medium', 0.00, false, 2),
    (spice_group_id, 'Hot', 0.00, false, 3),
    (spice_group_id, 'Extra Hot', 0.00, false, 4),
    
    -- Add-ons
    (addons_group_id, 'Extra Meat', 3.00, false, 1),
    (addons_group_id, 'Extra Cheese', 1.50, false, 2),
    (addons_group_id, 'Avocado', 2.00, false, 3),
    (addons_group_id, 'Extra Vegetables', 1.00, false, 4),
    (addons_group_id, 'Pickles', 0.50, false, 5),
    
    -- Sauce options
    (sauce_group_id, 'Garlic Sauce', 0.00, false, 1),
    (sauce_group_id, 'Tahini Sauce', 0.00, false, 2),
    (sauce_group_id, 'Hot Sauce', 0.00, false, 3),
    (sauce_group_id, 'Tzatziki', 0.50, false, 4),
    
    -- Temperature
    (temp_group_id, 'Hot', 0.00, true, 1),
    (temp_group_id, 'Warm', 0.00, false, 2),
    (temp_group_id, 'Cold', 0.00, false, 3);
END $$;

-- Insert suppliers
INSERT INTO suppliers (name, contact_person, email, phone, address, is_active) VALUES
('Fresh Produce Co.', 'Mike Johnson', 'mike@freshproduce.com', '555-0101', '123 Market St, City, State 12345', true),
('Mediterranean Imports', 'Sarah Ahmed', 'sarah@medimports.com', '555-0102', '456 Trade Ave, City, State 12345', true),
('Local Dairy Farm', 'Tom Wilson', 'tom@localdairy.com', '555-0103', '789 Farm Rd, City, State 12345', true),
('Spice World', 'Maria Garcia', 'maria@spiceworld.com', '555-0104', '321 Spice Lane, City, State 12345', true);

-- Insert inventory items
DO $$
DECLARE
    fresh_produce_id UUID;
    med_imports_id UUID;
    dairy_farm_id UUID;
    spice_world_id UUID;
BEGIN
    SELECT id INTO fresh_produce_id FROM suppliers WHERE name = 'Fresh Produce Co.';
    SELECT id INTO med_imports_id FROM suppliers WHERE name = 'Mediterranean Imports';
    SELECT id INTO dairy_farm_id FROM suppliers WHERE name = 'Local Dairy Farm';
    SELECT id INTO spice_world_id FROM suppliers WHERE name = 'Spice World';

    INSERT INTO inventory_items (name, sku, unit_of_measure, current_stock, minimum_stock, maximum_stock, cost_per_unit, supplier_id) VALUES
    -- Proteins
    ('Chicken Breast', 'CHKN-001', 'lbs', 50.0, 10.0, 100.0, 4.99, fresh_produce_id),
    ('Ground Lamb', 'LAMB-001', 'lbs', 30.0, 5.0, 60.0, 8.99, fresh_produce_id),
    ('Chickpeas (Dried)', 'CHKP-001', 'lbs', 25.0, 5.0, 50.0, 2.49, med_imports_id),
    
    -- Vegetables
    ('Tomatoes', 'TOMA-001', 'lbs', 20.0, 5.0, 40.0, 2.99, fresh_produce_id),
    ('Onions', 'ONIO-001', 'lbs', 30.0, 10.0, 60.0, 1.99, fresh_produce_id),
    ('Lettuce', 'LETT-001', 'heads', 15.0, 5.0, 30.0, 1.49, fresh_produce_id),
    ('Cucumbers', 'CUCU-001', 'lbs', 12.0, 3.0, 25.0, 1.99, fresh_produce_id),
    
    -- Dairy
    ('Yogurt (Greek)', 'YOGU-001', 'lbs', 10.0, 2.0, 20.0, 3.99, dairy_farm_id),
    ('Feta Cheese', 'FETA-001', 'lbs', 8.0, 2.0, 15.0, 6.99, dairy_farm_id),
    ('Halloumi Cheese', 'HALL-001', 'lbs', 6.0, 1.0, 12.0, 8.99, dairy_farm_id),
    
    -- Grains & Bread
    ('Basmati Rice', 'RICE-001', 'lbs', 40.0, 10.0, 80.0, 2.99, med_imports_id),
    ('Pita Bread', 'PITA-001', 'pieces', 100.0, 20.0, 200.0, 0.75, med_imports_id),
    ('Phyllo Pastry', 'PHYL-001', 'packages', 10.0, 2.0, 20.0, 4.99, med_imports_id),
    
    -- Spices & Seasonings
    ('Cumin (Ground)', 'CUMI-001', 'oz', 16.0, 4.0, 32.0, 0.99, spice_world_id),
    ('Paprika', 'PAPR-001', 'oz', 12.0, 3.0, 24.0, 1.49, spice_world_id),
    ('Garlic Powder', 'GARL-001', 'oz', 20.0, 5.0, 40.0, 0.79, spice_world_id),
    ('Tahini', 'TAHI-001', 'jars', 8.0, 2.0, 15.0, 5.99, med_imports_id),
    
    -- Beverages
    ('Coffee Beans (Turkish)', 'COFF-001', 'lbs', 15.0, 3.0, 30.0, 12.99, med_imports_id),
    ('Mint (Fresh)', 'MINT-001', 'bunches', 10.0, 2.0, 20.0, 1.99, fresh_produce_id),
    ('Lemons', 'LEMO-001', 'lbs', 15.0, 5.0, 30.0, 2.49, fresh_produce_id);
END $$;

-- Sample customers for testing
INSERT INTO customers (email, phone, first_name, last_name, loyalty_points, total_spent, visit_count) VALUES
('john.doe@email.com', '555-1001', 'John', 'Doe', 150, 89.50, 8),
('jane.smith@email.com', '555-1002', 'Jane', 'Smith', 75, 45.25, 4),
('mike.johnson@email.com', '555-1003', 'Mike', 'Johnson', 200, 125.75, 12),
('sarah.wilson@email.com', '555-1004', 'Sarah', 'Wilson', 50, 32.50, 3);

-- Link some menu items to modifier groups (for items that can be customized)
DO $$
DECLARE
    size_group_id UUID;
    spice_group_id UUID;
    addons_group_id UUID;
    sauce_group_id UUID;
    temp_group_id UUID;
    
    chicken_platter_id UUID;
    lamb_platter_id UUID;
    chicken_wrap_id UUID;
    lamb_wrap_id UUID;
    coffee_id UUID;
BEGIN
    -- Get modifier group IDs
    SELECT id INTO size_group_id FROM modifier_groups WHERE name = 'Size Options';
    SELECT id INTO spice_group_id FROM modifier_groups WHERE name = 'Spice Level';
    SELECT id INTO addons_group_id FROM modifier_groups WHERE name = 'Add-ons';
    SELECT id INTO sauce_group_id FROM modifier_groups WHERE name = 'Sauce Options';
    SELECT id INTO temp_group_id FROM modifier_groups WHERE name = 'Temperature';
    
    -- Get menu item IDs
    SELECT id INTO chicken_platter_id FROM menu_items WHERE name = 'Chicken Shawarma Platter';
    SELECT id INTO lamb_platter_id FROM menu_items WHERE name = 'Lamb Kabob Platter';
    SELECT id INTO chicken_wrap_id FROM menu_items WHERE name = 'Chicken Shawarma Wrap';
    SELECT id INTO lamb_wrap_id FROM menu_items WHERE name = 'Lamb Gyro Wrap';
    SELECT id INTO coffee_id FROM menu_items WHERE name = 'Turkish Coffee';
    
    -- Link items to modifier groups
    INSERT INTO item_modifier_groups (item_id, group_id) VALUES
    -- Platters can have size, spice, add-ons, and sauce options
    (chicken_platter_id, size_group_id),
    (chicken_platter_id, spice_group_id),
    (chicken_platter_id, addons_group_id),
    (chicken_platter_id, sauce_group_id),
    
    (lamb_platter_id, size_group_id),
    (lamb_platter_id, spice_group_id),
    (lamb_platter_id, addons_group_id),
    (lamb_platter_id, sauce_group_id),
    
    -- Wraps can have spice, add-ons, and sauce options
    (chicken_wrap_id, spice_group_id),
    (chicken_wrap_id, addons_group_id),
    (chicken_wrap_id, sauce_group_id),
    
    (lamb_wrap_id, spice_group_id),
    (lamb_wrap_id, addons_group_id),
    (lamb_wrap_id, sauce_group_id),
    
    -- Coffee can have temperature
    (coffee_id, temp_group_id);
END $$;

-- Create some recipe ingredients (linking menu items to inventory)
DO $$
DECLARE
    chicken_platter_id UUID;
    lamb_platter_id UUID;
    chicken_wrap_id UUID;
    hummus_id UUID;
    
    chicken_id UUID;
    lamb_id UUID;
    rice_id UUID;
    pita_id UUID;
    chickpeas_id UUID;
    tahini_id UUID;
BEGIN
    -- Get menu item IDs
    SELECT id INTO chicken_platter_id FROM menu_items WHERE name = 'Chicken Shawarma Platter';
    SELECT id INTO lamb_platter_id FROM menu_items WHERE name = 'Lamb Kabob Platter';
    SELECT id INTO chicken_wrap_id FROM menu_items WHERE name = 'Chicken Shawarma Wrap';
    SELECT id INTO hummus_id FROM menu_items WHERE name = 'Hummus & Pita';
    
    -- Get inventory item IDs
    SELECT id INTO chicken_id FROM inventory_items WHERE name = 'Chicken Breast';
    SELECT id INTO lamb_id FROM inventory_items WHERE name = 'Ground Lamb';
    SELECT id INTO rice_id FROM inventory_items WHERE name = 'Basmati Rice';
    SELECT id INTO pita_id FROM inventory_items WHERE name = 'Pita Bread';
    SELECT id INTO chickpeas_id FROM inventory_items WHERE name = 'Chickpeas (Dried)';
    SELECT id INTO tahini_id FROM inventory_items WHERE name = 'Tahini';
    
    -- Create recipe ingredients
    INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, quantity_required) VALUES
    -- Chicken Shawarma Platter
    (chicken_platter_id, chicken_id, 0.5),  -- 0.5 lbs chicken
    (chicken_platter_id, rice_id, 0.25),    -- 0.25 lbs rice
    
    -- Lamb Kabob Platter
    (lamb_platter_id, lamb_id, 0.4),        -- 0.4 lbs lamb
    (lamb_platter_id, rice_id, 0.25),       -- 0.25 lbs rice
    
    -- Chicken Shawarma Wrap
    (chicken_wrap_id, chicken_id, 0.3),     -- 0.3 lbs chicken
    (chicken_wrap_id, pita_id, 1.0),        -- 1 pita bread
    
    -- Hummus & Pita
    (hummus_id, chickpeas_id, 0.1),         -- 0.1 lbs chickpeas
    (hummus_id, tahini_id, 0.05),           -- Small amount of tahini
    (hummus_id, pita_id, 2.0);              -- 2 pita breads
END $$;