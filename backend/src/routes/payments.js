const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { auth } = require('../middleware/auth');
const { User, Transaction } = require('../models');
const Stripe = require('stripe');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get wallet balance
router.get('/wallet-balance', auth, async (req, res) => {
  try {
    res.json({
      balanceCents: req.user.walletBalance,
      balanceDollars: (req.user.walletBalance / 100).toFixed(2)
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get wallet balance' });
  }
});

// Create payment intent to add funds
router.post('/add-funds',
  auth,
  [
    body('amount').isInt({ min: 100 }).withMessage('Minimum amount is $1 (100 cents)')
  ],
  validate,
  async (req, res) => {
    try {
      const { amount } = req.body;
      const isDevelopment = process.env.NODE_ENV === 'development';

      // In development mode, skip Stripe and directly add funds
      if (isDevelopment) {
        // Add to wallet balance directly
        req.user.walletBalance += amount;
        await req.user.save();

        // Create transaction record
        await Transaction.create({
          userId: req.user._id,
          type: 'deposit',
          amount,
          direction: 'credit',
          status: 'completed',
          description: 'Wallet deposit (DEV MODE - no actual charge)'
        });

        return res.json({
          message: 'Funds added successfully (DEV MODE)',
          newBalance: req.user.walletBalance,
          newBalanceDollars: (req.user.walletBalance / 100).toFixed(2),
          devMode: true
        });
      }

      // Production: Use Stripe
      // Get or create Stripe customer
      let stripeCustomerId = req.user.stripeCustomerId;
      
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user.name,
          metadata: { userId: req.user._id.toString() }
        });
        stripeCustomerId = customer.id;
        req.user.stripeCustomerId = stripeCustomerId;
        await req.user.save();
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: stripeCustomerId,
        metadata: {
          userId: req.user._id.toString(),
          type: 'wallet_deposit'
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error('Add funds error:', error);
      res.status(500).json({ error: 'Failed to create payment intent' });
    }
  }
);

// Request withdrawal
router.post('/withdraw',
  auth,
  [
    body('amount').isInt({ min: 100 }).withMessage('Minimum withdrawal is $1 (100 cents)')
  ],
  validate,
  async (req, res) => {
    try {
      const { amount } = req.body;

      // Check wallet balance
      if (req.user.walletBalance < amount) {
        return res.status(400).json({
          error: 'Insufficient balance',
          available: req.user.walletBalance,
          requested: amount
        });
      }

      // For withdrawals, we need the user to have connected a bank account via Stripe Connect
      // For MVP, we can use Stripe Payouts if the platform holds funds
      // or create a transfer to the user's connected account

      // Create pending withdrawal transaction
      const transaction = await Transaction.create({
        userId: req.user._id,
        type: 'withdrawal',
        amount,
        direction: 'debit',
        status: 'pending',
        description: 'Withdrawal request'
      });

      // Deduct from wallet
      req.user.walletBalance -= amount;
      await req.user.save();

      // Note: In production, you would process the actual payout here
      // For now, we mark it as pending for manual processing
      // or implement Stripe Connect for direct payouts

      res.json({
        message: 'Withdrawal request submitted',
        transaction,
        note: 'Withdrawal will be processed within 2-3 business days'
      });
    } catch (error) {
      console.error('Withdrawal error:', error);
      res.status(500).json({ error: 'Failed to process withdrawal' });
    }
  }
);

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;

    const query = { userId: req.user._id };
    if (type) query.type = type;

    const transactions = await Transaction.find(query)
      .populate('goalId', 'title')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    const total = await Transaction.countDocuments(query);

    const formattedTransactions = transactions.map(t => ({
      ...t,
      amountDollars: (t.amount / 100).toFixed(2)
    }));

    res.json({
      transactions: formattedTransactions,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  try {
    const { userId, type } = paymentIntent.metadata;

    if (type === 'wallet_deposit') {
      const user = await User.findById(userId);
      if (!user) {
        console.error('User not found for payment:', userId);
        return;
      }

      // Add to wallet balance
      user.walletBalance += paymentIntent.amount;
      await user.save();

      // Create transaction record
      await Transaction.create({
        userId,
        type: 'deposit',
        amount: paymentIntent.amount,
        direction: 'credit',
        stripePaymentIntentId: paymentIntent.id,
        status: 'completed',
        description: 'Wallet deposit'
      });

      console.log(`Wallet deposit successful: ${paymentIntent.amount} cents for user ${userId}`);
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Handle failed payment
async function handlePaymentFailure(paymentIntent) {
  try {
    const { userId, type } = paymentIntent.metadata;

    if (type === 'wallet_deposit') {
      // Create failed transaction record
      await Transaction.create({
        userId,
        type: 'deposit',
        amount: paymentIntent.amount,
        direction: 'credit',
        stripePaymentIntentId: paymentIntent.id,
        status: 'failed',
        description: 'Wallet deposit failed'
      });

      console.log(`Wallet deposit failed for user ${userId}`);
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

module.exports = router;

