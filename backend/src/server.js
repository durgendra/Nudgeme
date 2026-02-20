require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');

// Import routes
const authRoutes = require('./routes/auth');
const goalRoutes = require('./routes/goals');
const paymentRoutes = require('./routes/payments');
const verificationRoutes = require('./routes/verification');

// Import services
const { checkExpiredGoals, checkUpcomingDeadlines } = require('./services/goalService');
const { checkAndSendReminders } = require('./services/reminderService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Stripe webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/verification', verificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Schedule cron job to check for expired goals every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running expired goals check...');
  try {
    await checkExpiredGoals();
  } catch (error) {
    console.error('Error checking expired goals:', error);
  }
});

// Schedule cron job to check for upcoming deadlines and send reminders
// Run every 6 hours to catch reminder windows (7d, 3d, 1d, 12h)
cron.schedule('0 */6 * * *', async () => {
  console.log('Running upcoming deadlines check...');
  try {
    await checkUpcomingDeadlines();
  } catch (error) {
    console.error('Error checking upcoming deadlines:', error);
  }
});

// Schedule cron job to check and send progress reminders
// Run every hour to match user-preferred reminder times
cron.schedule('0 * * * *', async () => {
  console.log('Running progress reminders check...');
  try {
    await checkAndSendReminders();
  } catch (error) {
    console.error('Error sending progress reminders:', error);
  }
});

// Start server
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;

