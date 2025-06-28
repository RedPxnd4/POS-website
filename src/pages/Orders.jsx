import React, { useState, useEffect } from 'react';
import { ordersAPI, menuAPI, customersAPI, paymentsAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  BanknotesIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';

const Orders = () => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [ordersResponse, categoriesResponse, customersResponse] = await Promise.all([
        ordersAPI.getAll({ status: 'pending,confirmed,preparing,ready', limit: 20 }),
        menuAPI.getCategories(),
        customersAPI.getAll({ limit: 100 })
      ]);

      setOrders(ordersResponse.data.orders || []);
      setMenuCategories(categoriesResponse.data.categories || []);
      setCustomers(customersResponse.data.customers || []);

      // Load first category items
      if (categoriesResponse.data.categories.length > 0) {
        const firstCategory = categoriesResponse.data.categories[0];
        setSelectedCategory(firstCategory.id);
        loadCategoryItems(firstCategory.id);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryItems = async (categoryId) => {
    try {
      const response = await menuAPI.getCategoryItems(categoryId);
      setMenuItems(response.data.items || []);
    } catch (error) {
      console.error('Failed to load menu items:', error);
      showError('Failed to load menu items');
    }
  };

  const createNewOrder = () => {
    setCurrentOrder({
      id: null,
      items: [],
      customer: null,
      orderType: 'dine-in',
      subtotal: 0,
      tax: 0,
      total: 0,
      notes: ''
    });
  };

  const addItemToOrder = (item) => {
    if (!currentOrder) {
      createNewOrder();
    }

    const existingItemIndex = currentOrder.items.findIndex(
      orderItem => orderItem.menuItemId === item.id
    );

    let updatedItems;
    if (existingItemIndex >= 0) {
      updatedItems = [...currentOrder.items];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].totalPrice = 
        updatedItems[existingItemIndex].quantity * item.price;
    } else {
      updatedItems = [...currentOrder.items, {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        totalPrice: item.price,
        modifiers: [],
        specialInstructions: ''
      }];
    }

    const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;

    setCurrentOrder({
      ...currentOrder,
      items: updatedItems,
      subtotal,
      tax,
      total
    });
  };

  const removeItemFromOrder = (index) => {
    const updatedItems = currentOrder.items.filter((_, i) => i !== index);
    const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    setCurrentOrder({
      ...currentOrder,
      items: updatedItems,
      subtotal,
      tax,
      total
    });
  };

  const updateItemQuantity = (index, quantity) => {
    if (quantity <= 0) {
      removeItemFromOrder(index);
      return;
    }

    const updatedItems = [...currentOrder.items];
    updatedItems[index].quantity = quantity;
    updatedItems[index].totalPrice = quantity * updatedItems[index].price;

    const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    setCurrentOrder({
      ...currentOrder,
      items: updatedItems,
      subtotal,
      tax,
      total
    });
  };

  const submitOrder = async () => {
    if (!currentOrder || currentOrder.items.length === 0) {
      showError('Please add items to the order');
      return;
    }

    try {
      const orderData = {
        customerId: currentOrder.customer?.id,
        orderType: currentOrder.orderType,
        items: currentOrder.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          modifiers: item.modifiers
        })),
        notes: currentOrder.notes
      };

      const response = await ordersAPI.create(orderData);
      
      showSuccess('Order created successfully');
      setCurrentOrder(null);
      loadInitialData(); // Refresh orders list
    } catch (error) {
      console.error('Failed to create order:', error);
      showError(error.response?.data?.error || 'Failed to create order');
    }
  };

  const processPayment = async () => {
    if (!currentOrder) return;

    try {
      if (paymentMethod === 'cash') {
        const response = await paymentsAPI.processCash({
          orderId: currentOrder.id,
          amountReceived: parseFloat(paymentAmount),
          tipAmount: parseFloat(tipAmount) || 0
        });

        showSuccess('Payment processed successfully');
        setShowPaymentModal(false);
        setCurrentOrder(null);
        loadInitialData();
      } else {
        // Handle card payment with Stripe
        showError('Card payments not implemented in demo');
      }
    } catch (error) {
      console.error('Payment failed:', error);
      showError(error.response?.data?.error || 'Payment failed');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await ordersAPI.updateStatus(orderId, { status });
      showSuccess(`Order status updated to ${status}`);
      loadInitialData();
    } catch (error) {
      console.error('Failed to update order status:', error);
      showError('Failed to update order status');
    }
  };

  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Menu Section */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex space-x-1 overflow-x-auto">
            {menuCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  loadCategoryItems(category.id);
                }}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                  selectedCategory === category.id
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => addItemToOrder(item)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                  <span className="text-lg font-bold text-yellow-600">
                    ${item.price.toFixed(2)}
                  </span>
                </div>
                <p className="text-gray-600 text-xs mb-3 line-clamp-2">
                  {item.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {item.prepTime}min prep
                  </span>
                  <button className="bg-yellow-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-yellow-600">
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order Panel */}
      <div className="w-96 bg-white shadow-lg border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Order</h2>
            {!currentOrder && (
              <button
                onClick={createNewOrder}
                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-yellow-600"
              >
                <PlusIcon className="w-4 h-4 inline mr-1" />
                New Order
              </button>
            )}
          </div>

          {currentOrder && (
            <div className="space-y-3">
              <select
                value={currentOrder.orderType}
                onChange={(e) => setCurrentOrder({...currentOrder, orderType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
              >
                <option value="dine-in">Dine In</option>
                <option value="takeout">Takeout</option>
                <option value="delivery">Delivery</option>
              </select>

              <select
                value={currentOrder.customer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === e.target.value);
                  setCurrentOrder({...currentOrder, customer});
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">Select Customer (Optional)</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName} - {customer.phone}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentOrder || currentOrder.items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCartIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No items in order</p>
              <p className="text-gray-400 text-sm">Add items from the menu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentOrder.items.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                    <button
                      onClick={() => removeItemFromOrder(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateItemQuantity(index, item.quantity - 1)}
                        className="w-6 h-6 bg-gray-200 rounded text-sm hover:bg-gray-300"
                      >
                        -
                      </button>
                      <span className="text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateItemQuantity(index, item.quantity + 1)}
                        className="w-6 h-6 bg-gray-200 rounded text-sm hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-semibold text-yellow-600">
                      ${item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Summary */}
        {currentOrder && currentOrder.items.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${currentOrder.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (8%):</span>
                <span>${currentOrder.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-yellow-600">${currentOrder.total.toFixed(2)}</span>
              </div>
            </div>

            <textarea
              placeholder="Order notes (optional)"
              value={currentOrder.notes}
              onChange={(e) => setCurrentOrder({...currentOrder, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 resize-none"
              rows="2"
            />

            <div className="space-y-2">
              <button
                onClick={submitOrder}
                className="w-full bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600"
              >
                Submit Order
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 text-sm"
                >
                  <CreditCardIcon className="w-4 h-4 inline mr-1" />
                  Pay Now
                </button>
                <button className="bg-gray-500 text-white py-2 rounded-lg font-medium hover:bg-gray-600 text-sm">
                  <PrinterIcon className="w-4 h-4 inline mr-1" />
                  Print
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Orders Sidebar */}
      <div className="w-80 bg-gray-100 border-l border-gray-200 p-4 overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Orders</h3>
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">#{order.orderNumber}</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {order.customer?.name || 'Walk-in'} • {order.orderType}
              </p>
              <p className="font-semibold text-yellow-600 mb-3">
                ${order.totalAmount.toFixed(2)}
              </p>
              
              <div className="flex space-x-1">
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'confirmed')}
                    className="flex-1 bg-blue-500 text-white py-1 px-2 rounded text-xs hover:bg-blue-600"
                  >
                    Confirm
                  </button>
                )}
                {order.status === 'confirmed' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    className="flex-1 bg-orange-500 text-white py-1 px-2 rounded text-xs hover:bg-orange-600"
                  >
                    Prepare
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                    className="flex-1 bg-green-500 text-white py-1 px-2 rounded text-xs hover:bg-green-600"
                  >
                    Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    className="flex-1 bg-gray-500 text-white py-1 px-2 rounded text-xs hover:bg-gray-600"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Process Payment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 rounded-lg border-2 ${
                      paymentMethod === 'cash' 
                        ? 'border-yellow-500 bg-yellow-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <BanknotesIcon className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-lg border-2 ${
                      paymentMethod === 'card' 
                        ? 'border-yellow-500 bg-yellow-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <CreditCardIcon className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Card</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Received
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tip Amount (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      placeholder="0.00"
                    />
                  </div>

                  {paymentAmount && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Total Due:</span>
                        <span>${currentOrder?.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Amount Received:</span>
                        <span>${parseFloat(paymentAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tip:</span>
                        <span>${parseFloat(tipAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                        <span>Change:</span>
                        <span>
                          ${Math.max(0, parseFloat(paymentAmount || 0) - (currentOrder?.total || 0) - parseFloat(tipAmount || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                disabled={paymentMethod === 'cash' && (!paymentAmount || parseFloat(paymentAmount) < (currentOrder?.total || 0))}
                className="flex-1 bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;