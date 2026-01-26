import express from 'express';
import { body, validationResult } from 'express-validator';
import ldapService from '../config/ldap.js';
import emailService from '../utils/emailService.js';
import { User, Department } from '../models/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = express.Router();

// Login route
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password } = req.body;

    // Authenticate with LDAP
    const ldapUser = await ldapService.authenticateUser(username, password);

    if (!ldapUser) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    // Find or create user in database
    let user = await User.findOne({
      where: { email: ldapUser.email },
      include: [{
        model: Department,
        as: 'Department'
      }]
    });

    if (!user) {
      // Find or create department using Department attribute only (not OU)
      let department = null;
      let departmentName = null;

      // Use Department attribute from user profile
      if (ldapUser.department && ldapUser.department.trim()) {
        departmentName = ldapUser.department.trim();
        console.log(`✅ Login: Found department "${departmentName}" from Department attribute`);
      }

      if (!departmentName) {
        console.log(`⚠️ Login: No department attribute found for user ${ldapUser.username || ldapUser.email}`);
      }

      // Find or create department if we have a name
      if (departmentName) {
        // Try to find by name
        department = await Department.findOne({
          where: { name: departmentName }
        });

        // Create department if it doesn't exist
        if (!department) {
          department = await Department.create({
            name: departmentName,
            description: departmentName,
            ad_dn: null, // No OU DN stored when using attributes
            is_active: true,
            last_ad_sync: new Date()
          });
        }
      }

      // Create new user with default role (generate username from email if not available)
      const usernameValue = ldapUser.username || ldapUser.email.split('@')[0];

      user = await User.create({
        username: usernameValue,
        email: ldapUser.email,
        first_name: ldapUser.firstName || '',
        last_name: ldapUser.lastName || '',
        department_id: department?.id,
        title: ldapUser.title,
        phone: ldapUser.phone,
        role: 'requestor', // Default role - will be manually assigned by admin
        ad_dn: ldapUser.dn,
        ad_groups: ldapUser.groups,
        last_ad_sync: new Date(),
        last_login: new Date(),
        is_active: true
      });

      // Reload with department
      user = await User.findByPk(user.id, {
        include: [{
          model: Department,
          as: 'Department'
        }]
      });
    } else {
      // Update existing user with latest AD data (keep existing role)

      // Find department using Department attribute only (not OU)
      let department = user.Department;
      let currentDepartmentName = null;

      // Use Department attribute from user profile
      if (ldapUser.department && ldapUser.department.trim()) {
        currentDepartmentName = ldapUser.department.trim();
        console.log(`✅ Login (update): Found department "${currentDepartmentName}" from Department attribute`);
      }

      if (!currentDepartmentName) {
        console.log(`⚠️ Login (update): No department attribute found for user ${ldapUser.username || ldapUser.email}`);
      }

      // Update department if found and different from current
      if (currentDepartmentName && (!department || department.name !== currentDepartmentName)) {
        // Try to find by name
        let newDepartment = await Department.findOne({
          where: { name: currentDepartmentName }
        });

        // Create department if it doesn't exist
        if (!newDepartment) {
          newDepartment = await Department.create({
            name: currentDepartmentName,
            description: currentDepartmentName,
            ad_dn: null, // No OU DN stored when using attributes
            is_active: true,
            last_ad_sync: new Date()
          });
        }

        department = newDepartment;
      }

      // Update user data
      await user.update({
        first_name: ldapUser.firstName || user.first_name,
        last_name: ldapUser.lastName || user.last_name,
        department_id: department?.id || user.department_id,
        title: ldapUser.title || user.title,
        phone: ldapUser.phone || user.phone,
        ad_dn: ldapUser.dn,
        ad_groups: ldapUser.groups,
        last_ad_sync: new Date(),
        last_login: new Date()
      });

      // Reload with department
      user = await User.findByPk(user.id, {
        include: [{
          model: Department,
          as: 'Department'
        }]
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Audit Log: Login
    await logAudit({
      actor: user,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: {
        success: true,
        method: 'local'
      },
      req
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        department: user.Department ? {
          id: user.Department.id,
          name: user.Department.name
        } : null,
        title: user.title,
        phone: user.phone,
        isActive: user.is_active,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    // Audit Log: Login Error
    await logAudit({
      actor: { username: req.body.username, email: req.body.username }, // Use provided username for actor
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: null,
      details: {
        success: false,
        method: 'local',
        reason: error.message || 'An error occurred during login'
      },
      req
    });
    res.status(500).json({
      error: 'Login failed',
      message: error.message || 'An error occurred during login'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Department,
        as: 'Department'
      }],
      attributes: { exclude: ['ad_groups'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      department: user.Department ? {
        id: user.Department.id,
        name: user.Department.name
      } : null,
      title: user.title,
      phone: user.phone,
      isActive: user.is_active,
      lastLogin: user.last_login
    };

    res.json({ user: userData });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: error.message
    });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Department,
        as: 'Department'
      }],
      attributes: { exclude: ['ad_groups'] }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const token = generateToken(user);

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      department: user.Department ? {
        id: user.Department.id,
        name: user.Department.name
      } : null,
      title: user.title,
      phone: user.phone,
      isActive: user.is_active,
      lastLogin: user.last_login
    };

    res.json({ token, user: userData });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      message: error.message
    });
  }
});

// Logout route (client-side token removal, but we can log it server-side)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // But we can log the logout event if needed
    // Audit Log: Logout
    if (req.user) { // Ensure user is authenticated
      await logAudit({
        actor: req.user,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: req.user.id,
        details: { success: true },
        req
      });
    }
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    // Audit Log: Logout Error
    if (req.user) {
      await logAudit({
        actor: req.user,
        action: 'LOGOUT_FAILED',
        entityType: 'User',
        entityId: req.user.id,
        details: { success: false, reason: error.message },
        req
      });
    }
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

// Test LDAP connection
router.get('/test-ldap', authenticateToken, async (req, res) => {
  try {
    // Only allow admins to test LDAP
    if (req.user.role !== 'super_administrator' && req.user.role !== 'it_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const testResult = await ldapService.testConnection();
    res.json(testResult);
  } catch (error) {
    console.error('LDAP test error:', error);
    res.status(500).json({
      error: 'LDAP test failed',
      message: error.message
    });
  }
});

// Test Email connection
router.get('/test-email', authenticateToken, async (req, res) => {
  try {
    // Only allow admins to test email
    if (req.user.role !== 'super_administrator' && req.user.role !== 'it_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const testResult = await emailService.testEmailConnection();
    res.json(testResult);
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      error: 'Email test failed',
      message: error.message
    });
  }
});

// Send test email
router.post('/test-email/send', authenticateToken, [
  body('email').isEmail().withMessage('Valid email address is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Only allow admins to send test emails
    if (req.user.role !== 'super_administrator' && req.user.role !== 'it_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email } = req.body;
    const result = await emailService.sendTestEmail(email);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        details: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send test email',
        details: result
      });
    }
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      message: error.message
    });
  }
});

// Validate token
router.get('/validate', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

export default router;
