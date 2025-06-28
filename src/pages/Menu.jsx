import React, { useState, useEffect } from 'react';
import { menuAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const Menu = () => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    cost: '',
    prepTime: '',
    calories: '',
    isAvailable: true,
    isFeatured: false,
    dietaryRestrictions: [],
    allergens: [],
    imageUrl: ''
  });

  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      const [categoriesResponse, itemsResponse] = await Promise.all([
        menuAPI.getCategories(),
        menuAPI.getItems()
      ]);

      setCategories(categoriesResponse.data.categories || []);
      setItems(itemsResponse.data.items || []);

      if (categoriesResponse.data.categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categoriesResponse.data.categories[0].id);
      }
    } catch (error) {
      console.error('Failed to load menu data:', error);
      showError('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = !selectedCategory || item.category.id === selectedCategory;
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const itemData = {
        ...itemForm,
        categoryId: selectedCategory,
        price: parseFloat(itemForm.price),
        cost: itemForm.cost ? parseFloat(itemForm.cost) : null,
        prepTime: itemForm.prepTime ? parseInt(itemForm.prepTime) : null,
        calories: itemForm.calories ? parseInt(itemForm.calories) : null
      };

      if (editingItem) {
        await menuAPI.updateItem(editingItem.id, itemData);
        showSuccess('Menu item updated successfully');
      } else {
        await menuAPI.createItem(itemData);
        showSuccess('Menu item created successfully');
      }

      setShowItemModal(false);
      setEditingItem(null);
      resetItemForm();
      loadMenuData();
    } catch (error) {
      console.error('Failed to save menu item:', error);
      showError(error.response?.data?.error || 'Failed to save menu item');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      cost: item.cost ? item.cost.toString() : '',
      prepTime: item.prepTime ? item.prepTime.toString() : '',
      calories: item.calories ? item.calories.toString() : '',
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      dietaryRestrictions: item.dietaryRestrictions || [],
      allergens: item.allergens || [],
      imageUrl: item.imageUrl || ''
    });
    setShowItemModal(true);
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      await menuAPI.deleteItem(item.id);
      showSuccess('Menu item deleted successfully');
      loadMenuData();
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      showError('Failed to delete menu item');
    }
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      description: '',
      price: '',
      cost: '',
      prepTime: '',
      calories: '',
      isAvailable: true,
      isFeatured: false,
      dietaryRestrictions: [],
      allergens: [],
      imageUrl: ''
    });
  };

  const handleNewItem = () => {
    resetItemForm();
    setEditingItem(null);
    setShowItemModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-600 mt-2">Manage your menu items and categories</p>
        </div>
        <button
          onClick={handleNewItem}
          className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-600 flex items-center"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>
          
          <div className="sm:w-64">
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-lg">{item.name}</h3>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEditItem(item)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {item.description}
              </p>
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-yellow-600">
                  ${item.price.toFixed(2)}
                </span>
                {item.cost && (
                  <span className="text-sm text-gray-500">
                    Cost: ${item.cost.toFixed(2)}
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span>{item.category.name}</span>
                {item.prepTime && <span>{item.prepTime}min prep</span>}
              </div>
              
              <div className="flex flex-wrap gap-1 mb-3">
                {!item.isAvailable && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    Unavailable
                  </span>
                )}
                {item.isFeatured && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    Featured
                  </span>
                )}
                {item.dietaryRestrictions.map((restriction) => (
                  <span key={restriction} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    {restriction}
                  </span>
                ))}
              </div>
              
              {item.allergens.length > 0 && (
                <div className="text-xs text-red-600">
                  <strong>Allergens:</strong> {item.allergens.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🍽️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first menu item'
            }
          </p>
          {!searchTerm && !selectedCategory && (
            <button
              onClick={handleNewItem}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-600"
            >
              Add First Item
            </button>
          )}
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              
              <form onSubmit={handleItemSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={itemForm.price}
                      onChange={(e) => setItemForm({...itemForm, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemForm.cost}
                      onChange={(e) => setItemForm({...itemForm, cost: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prep Time (min)
                    </label>
                    <input
                      type="number"
                      value={itemForm.prepTime}
                      onChange={(e) => setItemForm({...itemForm, prepTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Calories
                    </label>
                    <input
                      type="number"
                      value={itemForm.calories}
                      onChange={(e) => setItemForm({...itemForm, calories: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={itemForm.isAvailable}
                      onChange={(e) => setItemForm({...itemForm, isAvailable: e.target.checked})}
                      className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Available</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={itemForm.isFeatured}
                      onChange={(e) => setItemForm({...itemForm, isFeatured: e.target.checked})}
                      className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Featured</span>
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowItemModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;