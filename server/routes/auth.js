const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('node-2fa');
const QRCode = require('qrcode');
const validator = require('validator');
const rateLimit = require('express-rate-limit');

const { supabase } = require('../config/database');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, auditLog } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return 'Password must be at least 8 characters long';
  }
  if (!hasUpperCase) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!hasLowerCase) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!hasNumbers) {
    return 'Password must contain at least one number';
  }
  if (!hasSpecialChar) {
    return 'Password must contain at least one special character';
  }
  return null;
};

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (Admin only in production)
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role = 'staff' } = req.body;

  // Validation
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      error: 'All fields are required',
      code: 'MISSING_FIELDS'
    });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({
      error: 'Invalid email format',
      code: 'INVALID_EMAIL'
    });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({
      error: passwordError,
      code: 'INVALID_PASSWORD'
    });
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    return res.status(409).json({
      error: 'User already exists with this email',
      code: 'USER_EXISTS'
    });
  }

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: role
    })
    .select('id, email, first_name, last_name, role, is_active, created_at')
    .single();

  if (error) {
    logger.error('User registration error:', error);
    return res.status(500).json({
      error: 'Failed to create user',
      code: 'REGISTRATION_FAILED'
    });
  }

  logger.info(`New user registered: ${email}`);

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at
    }
  });
}));

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, password, twoFactorCode } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required',
      code: 'MISSING_CREDENTIALS'
    });
  }

  // Get user from database
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) {
    return res.status(401).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(423).json({
      error: 'Account is temporarily locked due to too many failed attempts',
      code: 'ACCOUNT_LOCKED',
      lockedUntil: user.locked_until
    });
  }

  // Check if account is active
  if (!user.is_active) {
    return res.status(401).json({
      error: 'Account is deactivated',
      code: 'ACCOUNT_DEACTIVATED'
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    // Increment failed login attempts
    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    const lockUntil = failedAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null; // Lock for 30 minutes

    await supabase
      .from('users')
      .update({
        failed_login_attempts: failedAttempts,
        locked_until: lockUntil
      })
      .eq('id', user.id);

    return res.status(401).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
      attemptsRemaining: Math.max(0, 5 - failedAttempts)
    });
  }

  // Check 2FA if enabled
  if (user.two_factor_enabled) {
    if (!twoFactorCode) {
      return res.status(200).json({
        requiresTwoFactor: true,
        message: 'Two-factor authentication code required'
      });
    }

    const verified = speakeasy.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({
        error: 'Invalid two-factor authentication code',
        code: 'INVALID_2FA'
      });
    }
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Store refresh token
  await supabase
    .from('user_sessions')
    .insert({
      user_id: user.id,
      refresh_token: refreshToken,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

  // Reset failed login attempts and update last login
  await supabase
    .from('users')
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date().toISOString()
    })
    .eq('id', user.id);

  logger.info(`User logged in: ${email}`);

  res.json({
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      twoFactorEnabled: user.two_factor_enabled
    }
  });
}));

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      error: 'Refresh token required',
      code: 'TOKEN_MISSING'
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if refresh token exists in database
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('refresh_token', refreshToken)
      .eq('user_id', decoded.userId)
      .single();

    if (error || !session) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await supabase
        .from('user_sessions')
        .delete()
        .eq('id', session.id);

      return res.status(401).json({
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    // Generate new access token
    const { accessToken } = generateTokens(decoded.userId);

    res.json({
      accessToken
    });
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
}));

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticateToken, auditLog('USER_LOGOUT'), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Remove refresh token from database
    await supabase
      .from('user_sessions')
      .delete()
      .eq('refresh_token', refreshToken)
      .eq('user_id', req.user.id);
  }

  logger.info(`User logged out: ${req.user.email}`);

  res.json({
    message: 'Logout successful'
  });
}));

// @desc    Setup two-factor authentication
// @route   POST /api/auth/setup-2fa
// @access  Private
router.post('/setup-2fa', authenticateToken, asyncHandler(async (req, res) => {
  const { secret } = speakeasy.generateSecret({
    name: `${process.env.APP_NAME || 'POS System'} (${req.user.email})`,
    length: 32
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Store secret temporarily (not enabled until verified)
  await supabase
    .from('users')
    .update({
      two_factor_secret: secret.base32
    })
    .eq('id', req.user.id);

  res.json({
    secret: secret.base32,
    qrCode: qrCodeUrl,
    manualEntryKey: secret.base32
  });
}));

// @desc    Verify and enable two-factor authentication
// @route   POST /api/auth/verify-2fa
// @access  Private
router.post('/verify-2fa', authenticateToken, asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: 'Verification token required',
      code: 'TOKEN_MISSING'
    });
  }

  // Get user's 2FA secret
  const { data: user, error } = await supabase
    .from('users')
    .select('two_factor_secret')
    .eq('id', req.user.id)
    .single();

  if (error || !user.two_factor_secret) {
    return res.status(400).json({
      error: 'Two-factor authentication not set up',
      code: '2FA_NOT_SETUP'
    });
  }

  // Verify token
  const verified = speakeasy.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token: token,
    window: 2
  });

  if (!verified) {
    return res.status(400).json({
      error: 'Invalid verification token',
      code: 'INVALID_TOKEN'
    });
  }

  // Enable 2FA
  await supabase
    .from('users')
    .update({
      two_factor_enabled: true
    })
    .eq('id', req.user.id);

  logger.info(`2FA enabled for user: ${req.user.email}`);

  res.json({
    message: 'Two-factor authentication enabled successfully'
  });
}));

// @desc    Disable two-factor authentication
// @route   POST /api/auth/disable-2fa
// @access  Private
router.post('/disable-2fa', authenticateToken, asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({
      error: 'Verification token and password required',
      code: 'MISSING_FIELDS'
    });
  }

  // Get user data
  const { data: user, error } = await supabase
    .from('users')
    .select('password_hash, two_factor_secret, two_factor_enabled')
    .eq('id', req.user.id)
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Failed to retrieve user data',
      code: 'DATABASE_ERROR'
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({
      error: 'Invalid password',
      code: 'INVALID_PASSWORD'
    });
  }

  // Verify 2FA token if enabled
  if (user.two_factor_enabled) {
    const verified = speakeasy.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        error: 'Invalid verification token',
        code: 'INVALID_TOKEN'
      });
    }
  }

  // Disable 2FA
  await supabase
    .from('users')
    .update({
      two_factor_enabled: false,
      two_factor_secret: null
    })
    .eq('id', req.user.id);

  logger.info(`2FA disabled for user: ${req.user.email}`);

  res.json({
    message: 'Two-factor authentication disabled successfully'
  });
}));

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
router.post('/change-password', authenticateToken, auditLog('PASSWORD_CHANGE'), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Current password and new password are required',
      code: 'MISSING_FIELDS'
    });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({
      error: passwordError,
      code: 'INVALID_PASSWORD'
    });
  }

  // Get current password hash
  const { data: user, error } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', req.user.id)
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Failed to retrieve user data',
      code: 'DATABASE_ERROR'
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isCurrentPasswordValid) {
    return res.status(401).json({
      error: 'Current password is incorrect',
      code: 'INVALID_CURRENT_PASSWORD'
    });
  }

  // Hash new password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await supabase
    .from('users')
    .update({
      password_hash: newPasswordHash
    })
    .eq('id', req.user.id);

  logger.info(`Password changed for user: ${req.user.email}`);

  res.json({
    message: 'Password changed successfully'
  });
}));

module.exports = router;