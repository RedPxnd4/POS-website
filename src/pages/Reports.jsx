import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UsersIcon,
  TrendingUpIcon,
  CalendarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const Reports = () => {
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [salesData, setSalesData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [customerData, setCustomerData] = useState(null);

  useEffect(() => {
    loadReportsData();
  }, [dateRange, activeTab]);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      
      switch (activeTab) {
        case 'sales':
          const salesResponse = await reportsAPI.getSales(dateRange);
          setSalesData(salesResponse.data);
          break;
        case 'inventory':
          const inventoryResponse = await reportsAPI.getInventory();
          setInventoryData(inventoryResponse.data);
          break;
        case 'customers':
          const customerResponse = await reportsAPI.getCustomers(dateRange);
          setCustomerData(customerResponse.data);
          break;
      }
    } catch (error) {
      console.error('Failed to load reports data:', error);
      showError('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'sales', name: 'Sales', icon: CurrencyDollarIcon },
    { id: 'inventory', name: 'Inventory', icon: ChartBarIcon },
    { id: 'customers', name: 'Customers', icon: UsersIcon }
  ];

  const renderSalesReport = () => {
    if (!salesData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${salesData.summary.totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCartIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {salesData.summary.totalOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUpIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${salesData.summary.averageOrderValue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tips</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${salesData.summary.totalTips.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Selling Items</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {salesData.topSellingItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{item.quantity} sold</p>
                    <p className="text-sm text-gray-600">${item.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Type Breakdown */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Order Type Breakdown</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(salesData.orderTypeBreakdown).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{type.replace('-', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{data.count} orders</p>
                    <p className="text-sm text-gray-600">${data.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Performance */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Staff Performance</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {salesData.staffPerformance.map((staff, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{staff.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{staff.orders} orders</p>
                    <p className="text-sm text-gray-600">${staff.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryReport = () => {
    if (!inventoryData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inventoryData.summary.totalItems}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${inventoryData.summary.totalValue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUpIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inventoryData.summary.lowStockCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUpIcon className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inventoryData.summary.outOfStockCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Most Valuable Items */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Most Valuable Items</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {inventoryData.mostValuableItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.supplier}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">${item.totalValue.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">
                      {item.currentStock} @ ${item.costPerUnit.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Supplier Breakdown */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Supplier Breakdown</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {inventoryData.supplierBreakdown.map((supplier, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{supplier.name}</p>
                    <p className="text-sm text-gray-600">{supplier.itemCount} items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">${supplier.totalValue.toFixed(2)}</p>
                    <p className="text-sm text-red-600">{supplier.lowStockCount} low stock</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerReport = () => {
    if (!customerData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customerData.summary.totalCustomers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUpIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customerData.summary.activeCustomers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <UsersIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">New Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customerData.summary.newCustomers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUpIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Period</p>
                <p className="text-sm font-bold text-gray-900">
                  {new Date(customerData.summary.period.start).toLocaleDateString()} - {new Date(customerData.summary.period.end).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {customerData.topCustomers.map((customer, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">${customer.revenueInPeriod.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{customer.ordersInPeriod} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Customer Segments */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Customer Segments</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{customerData.segments.new}</p>
                <p className="text-sm text-gray-600">New (1 visit)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{customerData.segments.regular}</p>
                <p className="text-sm text-gray-600">Regular (2-5 visits)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{customerData.segments.loyal}</p>
                <p className="text-sm text-gray-600">Loyal (6-15 visits)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{customerData.segments.vip}</p>
                <p className="text-sm text-gray-600">VIP (15+ visits)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-2">Analyze your business performance</p>
        </div>
        
        {/* Date Range Picker */}
        {activeTab !== 'inventory' && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div>
          {activeTab === 'sales' && renderSalesReport()}
          {activeTab === 'inventory' && renderInventoryReport()}
          {activeTab === 'customers' && renderCustomerReport()}
        </div>
      )}
    </div>
  );
};

export default Reports;