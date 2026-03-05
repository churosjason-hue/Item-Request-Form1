import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Department } from '../models/index.js';

// Lazy-load ApiKey to avoid circular dependency at module init time
async function getApiKeyModel() {
  const { ApiKey } = await import('../models/index.js');
  return ApiKey;
}

// Generate JWT token
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    department_id: user.department_id
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
}

// Verify JWT token middleware (also supports X-API-Key header)
export async function authenticateToken(req, res, next) {
  try {
    // ── API Key Authentication ─────────────────────────────────────────────
    const rawApiKey = req.headers['x-api-key'];
    if (rawApiKey) {
      const ApiKey = await getApiKeyModel();
      const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
      const apiKey = await ApiKey.findOne({ where: { key_hash: keyHash } });

      if (!apiKey) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'The provided API key is not recognized'
        });
      }

      if (!apiKey.is_active) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'This API key has been revoked'
        });
      }

      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'This API key has expired'
        });
      }

      // Update last_used_at (fire and forget — don't block the request)
      apiKey.update({ last_used_at: new Date() }).catch(() => { });

      // Synthesize a super_administrator identity so all role checks pass
      req.user = {
        id: null,
        username: `api_key:${apiKey.key_prefix}`,
        email: null,
        role: 'super_administrator',
        department_id: null,
        is_active: true,
        first_name: 'API',
        last_name: `Key (${apiKey.name})`,
        Department: null,
        // Helper methods expected by some checks
        getFullName: () => `API Key (${apiKey.name})`,
        isAdmin: () => true,
        canProcessRequests: () => true,
        hasCustomRole: () => false
      };

      req.isApiKeyAuth = true; // Flag for audit logging etc.
      return next();
    }

    // ── JWT Authentication ─────────────────────────────────────────────────
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid authentication token or X-API-Key header'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get fresh user data from database
    const user = await User.findByPk(decoded.id, {
      include: [{
        model: Department,
        as: 'Department'
      }],
      attributes: { exclude: ['ad_groups'] } // Exclude sensitive data
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found or inactive'
      });
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'The provided token has expired'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}


// Role-based authorization middleware
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    // Flatten the allowedRoles array in case arrays are passed
    const roles = allowedRoles.flat();

    // Debug logging (can be removed in production)
    console.log('Role check:', {
      userRole: req.user.role,
      allowedRoles: roles,
      user: req.user.username
    });

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
}

// Department-specific authorization
export function requireDepartmentAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  // Super administrators can access all departments
  if (req.user.role === 'super_administrator') {
    return next();
  }

  // IT managers can access all departments
  if (req.user.role === 'it_manager') {
    return next();
  }

  // Department approvers can only access their own department
  if (req.user.role === 'department_approver') {
    const requestedDepartmentId = req.params.departmentId || req.body.department_id;

    if (requestedDepartmentId && requestedDepartmentId !== req.user.department_id) {
      return res.status(403).json({
        error: 'Department access denied',
        message: 'You can only access resources from your own department'
      });
    }
  }

  next();
}

// Request ownership or approval authorization
export function requireRequestAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  // Super administrators can access all requests
  if (req.user.role === 'super_administrator') {
    return next();
  }

  // This will be enhanced in the request routes to check specific request ownership
  next();
}

// Optional authentication (for public endpoints that can benefit from user context)
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        include: [{
          model: Department,
          as: 'Department'
        }]
      });

      if (user && user.is_active) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    console.log('Optional auth failed (ignored):', error.message);
  }

  next();
}

// Rate limiting for sensitive operations
export function sensitiveOperationLimit(req, res, next) {
  // This would typically integrate with a Redis-based rate limiter
  // For now, we'll use a simple in-memory approach
  const userKey = req.user?.id || req.ip;
  const now = Date.now();

  if (!req.app.locals.rateLimitStore) {
    req.app.locals.rateLimitStore = new Map();
  }

  const userAttempts = req.app.locals.rateLimitStore.get(userKey) || [];
  const recentAttempts = userAttempts.filter(time => now - time < 60000); // Last minute

  if (recentAttempts.length >= 5) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many attempts. Please try again in a minute.'
    });
  }

  recentAttempts.push(now);
  req.app.locals.rateLimitStore.set(userKey, recentAttempts);

  next();
}

