import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

const Inventory = () => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    unitOfMeasure: '',
    currentStock: '',
    minimumStock: '',
    maximumStock: '',
    costPerUnit: '',
    supplierId: ''
  });
  const [adjustForm, setAdjustForm] = useState({
    adjustment: '',
    reason: '',
    type: 'adjustment'
  });

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const [itemsResponse, alertsResponse, suppliersResponse] = await Promise.all([
        inventoryAPI.getAll(),
        inventoryAPI.getAlerts(),
        inventoryAPI.getSuppliers()
      ]);

      setItems(itemsResponse.data.items || []);
      setAlerts(alertsResponse.data.alerts || []);
      setSuppliers(suppliersResponse.data.suppliers || []);
    } catch (error) {
      console.error('Failed to load inventory data:', error);
      showError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterLowStock || item.isLowStock;
    return matchesSearch && matchesFilter;
  });

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const itemData = {
        ...itemForm,
        currentStock: parseFloat(itemForm.currentStock),
        minimumStock: parseFloat(itemForm.minimumStock),
        maximumStock: itemForm.maximumStock ? parseFloat(itemForm.maximumStock) : null,
        costPerUnit: parseFloat(itemForm.costPerUnit),
        supplierId: itemForm.supplierId || null
      };

      if (editingItem) {
        await inventoryAPI.update(editingItem.id, itemData);
        showSuccess('Inventory item updated successfully');
      } else {
        await inventoryAPI.create(itemData);
        showSuccess('Inventory item created successfully');
      }

      setShowItemModal(false);
      setEditingItem(null);
      resetItemForm();
      loadInventoryData();
    } catch (error) {
      console.error('Failed to save inventory item:', error);
      showError(error.response?.data?.error || 'Failed to save inventory item');
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await inventoryAPI.adjustStock(adjustingItem.id, {
        adjustment: parseFloat(adjustForm.adjustment),
        reason: adjustForm.reason,
        type: adjustForm.type
      });

      showSuccess('Stock adjusted successfully');
      setShowAdjustModal(false);
      setAdjustingItem(null);
      resetAdjustForm();
      loadInventoryData();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      showError(error.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku || '',
      unitOfMeasure: item.unitOfMeasure,
      currentStock: item.currentStock.toString(),
      minimumStock: item.minimumStock.toString(),
      maximumStock: item.maximumStock ? item.maximumStock.toString() : '',
      costPerUnit: item.costPerUnit.toString(),
      supplierId: item.supplier?.id || ''
    });
    setShowItemModal(true);
  };

  const handleAdjustStock = (item) => {
    setAdjustingItem(item);
    resetAdjustForm();
    setShowAdjustModal(true);
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      sku: '',
      unitOfMeasure: '',
      currentStock: '',
      minimumStock: '',
      maximumStock: '',
      costPerUnit: '',
      supplierId: ''
    });
  };

  const resetAdjustForm = () => {
    setAdjustForm({
      adjustment: '',
      reason: '',
      type: 'adjustment'
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
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-2">Track and manage your inventory levels</p>
        </div>
        <button
          onClick={handleNewItem}
          className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-600 flex items-center"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Item
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            <h3 className="font-medium text-red-900">Low Stock Alerts ({alerts.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 6).map((alert) => (
              <div key={alert.id} className="bg-white rounded p-3 border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{alert.name}</p>
                    <p className="text-sm text-gray-600">
                      {alert.currentStock} {alert.unitOfMeasure} remaining
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterLowStock}
                onChange={(e) => setFilterLowStock(e.target.checked)}
                className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="ml-2 text-sm text-gray-700">Show low stock only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Min/Max
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className={item.isLowStock ? 'bg-red-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.unitOfMeasure}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.sku || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        item.isLowStock ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {item.currentStock}
                      </span>
                      {item.isLowStock && (
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500 ml-1" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.minimumStock} / {item.maximumStock || '∞'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">${item.totalValue.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">${item.costPerUnit.toFixed(2)} each</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.supplier?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditItem(item)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAdjustStock(item)}
                        className="text-green-600 hover:text-green-900"
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterLowStock
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first inventory item'
            }
          </p>
          {!searchTerm && !filterLowStock && (
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
                {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
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
                      SKU
                    </label>
                    <input
                      type="text"
                      value={itemForm.sku}
                      onChange={(e) => setItemForm({...itemForm, sku: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit of Measure *
                    </label>
                    <input
                      type="text"
                      required
                      value={itemForm.unitOfMeasure}
                      onChange={(e) => setItemForm({...itemForm, unitOfMeasure: e.target.value})}
                      placeholder="e.g., lbs, pieces, gallons"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost Per Unit *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={itemForm.costPerUnit}
                      onChange={(e) => setItemForm({...itemForm, costPerUnit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Stock *
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={itemForm.currentStock}
                      onChange={(e) => setItemForm({...itemForm, currentStock: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Stock *
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={itemForm.minimumStock}
                      onChange={(e) => setItemForm({...itemForm, minimumStock: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Stock
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={itemForm.maximumStock}
                      onChange={(e) => setItemForm({...itemForm, maximumStock: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier
                  </label>
                  <select
                    value={itemForm.supplierId}
                    onChange={(e) => setItemForm({...itemForm, supplierId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    <option value="">Select a supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
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

      {/* Adjust Stock Modal */}
      {showAdjustModal && adjustingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Adjust Stock - {adjustingItem.name}
              </h3>
              
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Current Stock:</p>
                <p className="text-lg font-semibold">{adjustingItem.currentStock} {adjustingItem.unitOfMeasure}</p>
              </div>
              
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjustment Type
                  </label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({...adjustForm, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    <option value="adjustment">Manual Adjustment</option>
                    <option value="restock">Restock</option>
                    <option value="waste">Waste/Loss</option>
                    <option value="sale">Sale/Usage</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjustment Amount *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={adjustForm.adjustment}
                    onChange={(e) => setAdjustForm({...adjustForm, adjustment: e.target.value})}
                    placeholder="Use negative numbers to decrease stock"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    New stock will be: {adjustingItem.currentStock + parseFloat(adjustForm.adjustment || 0)} {adjustingItem.unitOfMeasure}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <textarea
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm({...adjustForm, reason: e.target.value})}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Optional reason for adjustment"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    Adjust Stock
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

export default Inventory;