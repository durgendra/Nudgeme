const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { auth, generateToken } = require('../middleware/auth');
const { User } = require('../models');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();

// Register with email/password
router.post('/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Create user
      const user = new User({ email, password, name });
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        message: 'Registration successful',
        user: user.toJSON(),
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login with email/password
router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        message: 'Login successful',
        user: user.toJSON(),
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Google OAuth
router.post('/google',
  [
    body('idToken').notEmpty().withMessage('ID token is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { idToken } = req.body;

      // Verify Google token
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      
      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      // Find or create user
      let user = await User.findOne({ 
        $or: [{ googleId }, { email }] 
      });

      if (user) {
        // Update Google ID if user exists with email but no Google ID
        if (!user.googleId) {
          user.googleId = googleId;
          user.profileImage = picture;
          await user.save();
        }
      } else {
        // Create new user
        user = new User({
          email,
          name,
          googleId,
          profileImage: picture,
          isVerified: true
        });
        await user.save();
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        message: 'Google login successful',
        user: user.toJSON(),
        token
      });
    } catch (error) {
      console.error('Google auth error:', error);
      res.status(500).json({ error: 'Google authentication failed' });
    }
  }
);

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
router.put('/profile',
  auth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('profileImage').optional().isURL().withMessage('Profile image must be a valid URL')
  ],
  validate,
  async (req, res) => {
    try {
      const { name, profileImage } = req.body;
      
      // Update only provided fields
      if (name) {
        req.user.name = name;
      }
      if (profileImage !== undefined) {
        req.user.profileImage = profileImage;
      }
      
      await req.user.save();
      
      res.json({
        message: 'Profile updated successfully',
        user: req.user.toJSON()
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Update push token
router.put('/push-token', 
  auth,
  [
    body('pushToken').notEmpty().withMessage('Push token is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { pushToken } = req.body;
      
      req.user.pushToken = pushToken;
      await req.user.save();
      
      res.json({ message: 'Push token updated' });
    } catch (error) {
      console.error('Push token update error:', error);
      res.status(500).json({ error: 'Failed to update push token' });
    }
  }
);

// Refresh token
router.post('/refresh', auth, async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    res.json({ token });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Get user reminder preferences
router.get('/reminder-preferences', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // Return reminder preferences with defaults
    const reminderPreferences = {
      enabled: user.reminderPreferences?.enabled ?? true,
      defaultFrequency: user.reminderPreferences?.defaultFrequency || null,
      defaultReminderTime: user.reminderPreferences?.defaultReminderTime || '09:00',
      timezone: user.reminderPreferences?.timezone || null
    };
    
    res.json({ reminderPreferences });
  } catch (error) {
    console.error('Get reminder preferences error:', error);
    res.status(500).json({ error: 'Failed to get reminder preferences' });
  }
});

// Update user reminder preferences
router.put('/reminder-preferences',
  auth,
  [
    body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
    body('defaultFrequency')
      .optional({ nullable: true })
      .isIn(['daily', 'weekly', 'monthly', null])
      .withMessage('Frequency must be daily, weekly, monthly, or null'),
    body('defaultReminderTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Reminder time must be in HH:mm format'),
    body('timezone').optional({ nullable: true }).isString().withMessage('Timezone must be a string')
  ],
  validate,
  async (req, res) => {
    try {
      const { enabled, defaultFrequency, defaultReminderTime, timezone } = req.body;
      
      // Initialize reminderPreferences if not exists
      if (!req.user.reminderPreferences) {
        req.user.reminderPreferences = {
          enabled: true,
          defaultFrequency: null,
          defaultReminderTime: '09:00',
          timezone: null
        };
      }
      
      // Update only provided fields
      if (typeof enabled === 'boolean') {
        req.user.reminderPreferences.enabled = enabled;
      }
      if (defaultFrequency !== undefined) {
        req.user.reminderPreferences.defaultFrequency = defaultFrequency;
      }
      if (defaultReminderTime) {
        req.user.reminderPreferences.defaultReminderTime = defaultReminderTime;
      }
      if (timezone !== undefined) {
        req.user.reminderPreferences.timezone = timezone;
      }
      
      await req.user.save();
      
      res.json({
        message: 'Reminder preferences updated',
        reminderPreferences: req.user.reminderPreferences
      });
    } catch (error) {
      console.error('Update reminder preferences error:', error);
      res.status(500).json({ error: 'Failed to update reminder preferences' });
    }
  }
);

module.exports = router;

