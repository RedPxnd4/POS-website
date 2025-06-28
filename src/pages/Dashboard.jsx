import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI, ordersAPI, inventoryAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  TrendingUpIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    todaySales: null,
    activeOrders: [],
    lowStockAlerts: [],
    recentActivity: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Load today's sales data
      const salesPromise = hasRole('manager') 
        ? reportsAPI.getSales({ startDate: today, endDate: today })
        : Promise.resolve({ data: null });

      // Load active orders
      const ordersPromise = ordersAPI.getAll({ 
        status: 'pending,confirmed,preparing,ready',
        limit: 10 
      });

      // Load low stock alerts
      const inventoryPromise = hasRole('manager')
        ? inventoryAPI.getAlerts()
        : Promise.resolve({ data: { alerts: [] } });

      const [salesResponse, ordersResponse, inventoryResponse] = await Promise.all([
        salesPromise,
        ordersPromise,
        inventoryPromise
      ]);

      setDashboardData({
        todaySales: salesResponse.data,
        activeOrders: ordersResponse.data.orders || [],
        lowStockAlerts: inventoryResponse.data.alerts || [],
        recentActivity: []
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const { todaySales, activeOrders, lowStockAlerts } = dashboardData;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      {hasRole('manager') && todaySales && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${todaySales.summary?.totalRevenue?.toFixed(2) || '0.00'}
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
                <p className="text-sm font-medium text-gray-600">Orders Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {todaySales.summary?.totalOrders || 0}
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
                  ${todaySales.summary?.averageOrderValue?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UsersIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeOrders.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Orders */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Active Orders</h2>
              <ClockIcon className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          <div className="p-6">
            {activeOrders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCartIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No active orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">#{order.orderNumber}</p>
                      <p className="text-sm text-gray-600">
                        {order.customer?.name || 'Walk-in'} • {order.orderType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${order.totalAmount.toFixed(2)}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        {hasRole('manager') && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Inventory Alerts</h2>
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
            <div className="p-6">
              {lowStockAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <ExclamationTriangleIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No inventory alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lowStockAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                      <div>
                        <p className="font-medium text-gray-900">{alert.name}</p>
                        <p className="text-sm text-gray-600">
                          Current: {alert.currentStock} {alert.unitOfMeasure}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/orders"
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ShoppingCartIcon className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-900">New Order</span>
          </a>
          
          <a
            href="/customers"
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <UsersIcon className="w-8 h-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-900">Customers</span>
          </a>
          
          {hasRole('manager') && (
            <>
              <a
                href="/inventory"
                className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600 mb-2" />
                <span className="text-sm font-medium text-yellow-900">Inventory</span>
              </a>
              
              <a
                href="/reports"
                className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <TrendingUpIcon className="w-8 h-8 text-purple-600 mb-2" />
                <span className="text-sm font-medium text-purple-900">Reports</span>
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;