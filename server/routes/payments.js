const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, requirePermission, auditLog } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Create payment intent
// @route   POST /api/payments/create-intent
// @access  Private (Staff+)
router.post('/create-intent',
  authenticateToken,
  requirePermission('staff'),
  asyncHandler(async (req, res) => {
    const { orderId, amount, currency = 'usd', paymentMethodTypes = ['card'] } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        error: 'Order ID and amount are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Verify order exists and get details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    if (order.status === 'completed') {
      return res.status(400).json({
        error: 'Order is already completed',
        code: 'ORDER_COMPLETED'
      });
    }

    // Verify amount matches order total
    const orderTotal = Math.round(parseFloat(order.total_amount) * 100); // Convert to cents
    const requestedAmount = Math.round(parseFloat(amount) * 100);

    if (requestedAmount !== orderTotal) {
      return res.status(400).json({
        error: 'Payment amount does not match order total',
        code: 'AMOUNT_MISMATCH',
        orderTotal: orderTotal / 100,
        requestedAmount: requestedAmount / 100
      });
    }

    try {
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: requestedAmount,
        currency: currency,
        payment_method_types: paymentMethodTypes,
        metadata: {
          orderId: orderId,
          orderNumber: order.order_number
        },
        description: `Payment for order ${order.order_number}`
      });

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          payment_method: 'card',
          amount: amount,
          payment_gateway_id: paymentIntent.id,
          payment_intent_id: paymentIntent.id,
          status: 'pending'
        })
        .select()
        .single();

      if (paymentError) {
        logger.error('Failed to create payment record:', paymentError);
        return res.status(500).json({
          error: 'Failed to create payment record',
          code: 'PAYMENT_RECORD_ERROR'
        });
      }

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentId: payment.id,
        amount: requestedAmount / 100
      });
    } catch (error) {
      logger.error('Stripe payment intent creation failed:', error);
      return res.status(500).json({
        error: 'Failed to create payment intent',
        code: 'STRIPE_ERROR',
        message: error.message
      });
    }
  })
);

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Private (Staff+)
router.post('/confirm',
  authenticateToken,
  requirePermission('staff'),
  auditLog('CONFIRM_PAYMENT'),
  asyncHandler(async (req, res) => {
    const { paymentIntentId, tipAmount = 0 } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'Payment intent ID is required',
        code: 'MISSING_PAYMENT_INTENT'
      });
    }

    try {
      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          error: 'Payment has not succeeded',
          code: 'PAYMENT_NOT_SUCCEEDED',
          status: paymentIntent.status
        });
      }

      // Update payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          tip_amount: tipAmount,
          processed_at: new Date().toISOString()
        })
        .eq('payment_intent_id', paymentIntentId)
        .select('order_id')
        .single();

      if (paymentError || !payment) {
        return res.status(404).json({
          error: 'Payment record not found',
          code: 'PAYMENT_NOT_FOUND'
        });
      }

      // Update order status to completed
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          tip_amount: tipAmount,
          completed_at: new Date().toISOString()
        })
        .eq('id', payment.order_id);

      if (orderError) {
        logger.error('Failed to update order status:', orderError);
        return res.status(500).json({
          error: 'Failed to update order status',
          code: 'ORDER_UPDATE_ERROR'
        });
      }

      res.json({
        message: 'Payment confirmed successfully',
        paymentStatus: 'completed',
        orderStatus: 'completed'
      });
    } catch (error) {
      logger.error('Payment confirmation failed:', error);
      return res.status(500).json({
        error: 'Failed to confirm payment',
        code: 'CONFIRMATION_ERROR',
        message: error.message
      });
    }
  })
);

// @desc    Process cash payment
// @route   POST /api/payments/cash
// @access  Private (Staff+)
router.post('/cash',
  authenticateToken,
  requirePermission('staff'),
  auditLog('PROCESS_CASH_PAYMENT'),
  asyncHandler(async (req, res) => {
    const { orderId, amountReceived, tipAmount = 0 } = req.body;

    if (!orderId || !amountReceived) {
      return res.status(400).json({
        error: 'Order ID and amount received are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    if (order.status === 'completed') {
      return res.status(400).json({
        error: 'Order is already completed',
        code: 'ORDER_COMPLETED'
      });
    }

    const orderTotal = parseFloat(order.total_amount);
    const received = parseFloat(amountReceived);
    const tip = parseFloat(tipAmount);

    if (received < orderTotal) {
      return res.status(400).json({
        error: 'Insufficient payment amount',
        code: 'INSUFFICIENT_AMOUNT',
        required: orderTotal,
        received: received,
        shortage: orderTotal - received
      });
    }

    const change = received - orderTotal - tip;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        payment_method: 'cash',
        amount: orderTotal,
        tip_amount: tip,
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      return res.status(500).json({
        error: 'Failed to create payment record',
        code: 'PAYMENT_RECORD_ERROR'
      });
    }

    // Update order status
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        tip_amount: tip,
        completed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      return res.status(500).json({
        error: 'Failed to update order status',
        code: 'ORDER_UPDATE_ERROR'
      });
    }

    res.json({
      message: 'Cash payment processed successfully',
      payment: {
        id: payment.id,
        orderTotal: orderTotal,
        amountReceived: received,
        tipAmount: tip,
        change: change,
        status: 'completed'
      }
    });
  })
);

// @desc    Process refund
// @route   POST /api/payments/:id/refund
// @access  Private (Manager+)
router.post('/:id/refund',
  authenticateToken,
  requirePermission('manager'),
  auditLog('PROCESS_REFUND'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, reason } = req.body;

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({
        error: 'Payment not found',
        code: 'PAYMENT_NOT_FOUND'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        error: 'Can only refund completed payments',
        code: 'PAYMENT_NOT_COMPLETED'
      });
    }

    const refundAmount = amount ? parseFloat(amount) : parseFloat(payment.amount);
    const maxRefund = parseFloat(payment.amount) - parseFloat(payment.refund_amount || 0);

    if (refundAmount > maxRefund) {
      return res.status(400).json({
        error: 'Refund amount exceeds available amount',
        code: 'REFUND_EXCEEDS_AMOUNT',
        maxRefund: maxRefund,
        requested: refundAmount
      });
    }

    try {
      let refundResult = null;

      // Process refund based on payment method
      if (payment.payment_method === 'card' && payment.payment_intent_id) {
        // Stripe refund
        refundResult = await stripe.refunds.create({
          payment_intent: payment.payment_intent_id,
          amount: Math.round(refundAmount * 100), // Convert to cents
          reason: 'requested_by_customer',
          metadata: {
            reason: reason || 'Refund requested',
            processedBy: req.user.id
          }
        });
      }

      // Update payment record
      const newRefundAmount = parseFloat(payment.refund_amount || 0) + refundAmount;
      const newStatus = newRefundAmount >= parseFloat(payment.amount) ? 'refunded' : 'completed';

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          refund_amount: newRefundAmount,
          status: newStatus,
          refunded_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        return res.status(500).json({
          error: 'Failed to update payment record',
          code: 'UPDATE_ERROR'
        });
      }

      res.json({
        message: 'Refund processed successfully',
        refund: {
          amount: refundAmount,
          method: payment.payment_method,
          stripeRefundId: refundResult?.id || null,
          totalRefunded: newRefundAmount,
          status: newStatus
        }
      });
    } catch (error) {
      logger.error('Refund processing failed:', error);
      return res.status(500).json({
        error: 'Failed to process refund',
        code: 'REFUND_ERROR',
        message: error.message
      });
    }
  })
);

// @desc    Get payment history for order
// @route   GET /api/payments/order/:orderId
// @access  Private (Staff+)
router.get('/order/:orderId',
  authenticateToken,
  requirePermission('staff'),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at');

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch payment history',
        code: 'FETCH_ERROR'
      });
    }

    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      method: payment.payment_method,
      amount: parseFloat(payment.amount),
      tipAmount: parseFloat(payment.tip_amount || 0),
      refundAmount: parseFloat(payment.refund_amount || 0),
      status: payment.status,
      paymentGatewayId: payment.payment_gateway_id,
      processedAt: payment.processed_at,
      refundedAt: payment.refunded_at,
      createdAt: payment.created_at
    }));

    res.json({
      payments: formattedPayments
    });
  })
);

// @desc    Stripe webhook handler
// @route   POST /api/payments/webhook
// @access  Public (Stripe webhook)
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Update payment status
      await supabase
        .from('payments')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('payment_intent_id', paymentIntent.id);

      logger.info(`Payment succeeded: ${paymentIntent.id}`);
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      
      // Update payment status
      await supabase
        .from('payments')
        .update({
          status: 'failed'
        })
        .eq('payment_intent_id', failedPayment.id);

      logger.info(`Payment failed: ${failedPayment.id}`);
      break;

    default:
      logger.info(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}));

module.exports = router;