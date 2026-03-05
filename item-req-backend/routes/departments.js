import express from 'express';
import { Op } from 'sequelize';
import { Department, User } from '../models/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import ldapService from '../config/ldap.js';
import exportService from '../utils/exportService.js';
import { logAudit, calculateChanges } from '../utils/auditLogger.js';

const router = express.Router();

// Get all departments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active = 'true' } = req.query;

    const whereClause = {};
    if (active !== 'all') {
      whereClause.is_active = active === 'true';
    }

    const departments = await Department.findAll({
      where: whereClause,
      include: [{
        model: Department,
        as: 'SubDepartments',
        where: { is_active: true },
        required: false
      }, {
        model: Department,
        as: 'ParentDepartment',
        required: false
      }],
      order: [['name', 'ASC']]
    });

    res.json({
      departments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        isActive: dept.is_active,
        lastAdSync: dept.last_ad_sync,
        adDn: dept.ad_dn,
        parentDepartment: dept.ParentDepartment ? {
          id: dept.ParentDepartment.id,
          name: dept.ParentDepartment.name
        } : null,
        subDepartments: dept.SubDepartments?.map(sub => ({
          id: sub.id,
          name: sub.name,
          description: sub.description
        })) || []
      }))
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      error: 'Failed to fetch departments',
      message: error.message
    });
  }
});

// Get department by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id, {
      include: [{
        model: Department,
        as: 'SubDepartments',
        where: { is_active: true },
        required: false
      }, {
        model: Department,
        as: 'ParentDepartment',
        required: false
      }, {
        model: User,
        as: 'Users',
        where: { is_active: true },
        required: false,
        attributes: ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'title']
      }]
    });

    if (!department) {
      return res.status(404).json({
        error: 'Department not found',
        message: 'The requested department does not exist'
      });
    }

    res.json({
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
        isActive: department.is_active,
        lastAdSync: department.last_ad_sync,
        adDn: department.ad_dn,
        parentDepartment: department.ParentDepartment ? {
          id: department.ParentDepartment.id,
          name: department.ParentDepartment.name,
          description: department.ParentDepartment.description
        } : null,
        subDepartments: department.SubDepartments?.map(sub => ({
          id: sub.id,
          name: sub.name,
          description: sub.description
        })) || [],
        users: department.Users?.map(user => ({
          id: user.id,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          title: user.title
        })) || []
      }
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({
      error: 'Failed to fetch department',
      message: error.message
    });
  }
});

// Create new department (super admin only)
router.post('/', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const { name, description, parentId } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Department name is required'
      });
    }

    // Check if department already exists
    const existingDept = await Department.findOne({
      where: { name: name.trim() }
    });

    if (existingDept) {
      return res.status(409).json({
        error: 'Department exists',
        message: 'A department with this name already exists'
      });
    }

    // Validate parent department if provided
    if (parentId) {
      const parentDepartment = await Department.findByPk(parentId);
      if (!parentDepartment) {
        return res.status(400).json({
          error: 'Invalid parent',
          message: 'Parent department not found'
        });
      }
    }

    // Create department in database only (no AD sync)
    const department = await Department.create({
      name: name.trim(),
      description: description?.trim() || name.trim(),
      parent_id: parentId || null,
      is_active: true
    });

    await logAudit({
      req,
      action: 'CREATE',
      entityType: 'Department',
      entityId: department.id,
      details: { name: department.name, description: department.description, parentId: department.parent_id }
    });

    res.status(201).json({
      message: 'Department created successfully',
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
        parentId: department.parent_id,
        isActive: department.is_active
      }
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({
      error: 'Failed to create department',
      message: error.message
    });
  }
});


// Update department (super admin only)
router.put('/:id', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentId, isActive } = req.body;

    const department = await Department.findByPk(id);

    if (!department) {
      return res.status(404).json({
        error: 'Department not found',
        message: 'The requested department does not exist'
      });
    }

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Department name cannot be empty'
        });
      }

      const existingDept = await Department.findOne({
        where: { name: name.trim(), id: { [Op.ne]: id } }
      });

      if (existingDept) {
        return res.status(409).json({
          error: 'Department exists',
          message: 'Another department with this name already exists'
        });
      }
    }

    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) {
        return res.status(400).json({
          error: 'Invalid parent',
          message: 'Department cannot be its own parent'
        });
      }

      const parentDepartment = await Department.findByPk(parentId);
      if (!parentDepartment) {
        return res.status(400).json({
          error: 'Invalid parent',
          message: 'Parent department not found'
        });
      }
    }

    const oldData = { name: department.name, description: department.description, parent_id: department.parent_id, is_active: department.is_active };
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || name?.trim() || department.name;
    if (parentId !== undefined) updateData.parent_id = parentId;
    if (isActive !== undefined) updateData.is_active = isActive;

    // Update database only (no AD sync)
    await department.update(updateData);

    const changes = calculateChanges(oldData, updateData);
    if (Object.keys(changes).length > 0) {
      await logAudit({
        req,
        action: 'UPDATE',
        entityType: 'Department',
        entityId: department.id,
        details: { changes }
      });
    }

    res.json({
      message: 'Department updated successfully',
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
        parentId: department.parent_id,
        isActive: department.is_active
      }
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({
      error: 'Failed to update department',
      message: error.message
    });
  }
});


// Delete department (super admin only)
router.delete('/:id', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id, {
      include: [
        { model: User, as: 'Users' },
        { model: Department, as: 'SubDepartments' }
      ]
    });

    if (!department) {
      return res.status(404).json({
        error: 'Department not found',
        message: 'The requested department does not exist'
      });
    }

    // Check if department has users
    if (department.Users && department.Users.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete department',
        message: 'Department has users assigned to it. Please reassign users before deleting.'
      });
    }

    // Check if department has sub-departments
    if (department.SubDepartments && department.SubDepartments.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete department',
        message: 'Department has sub-departments. Please reassign or delete sub-departments first.'
      });
    }

    const departmentDetails = { id: department.id, name: department.name, description: department.description, parentId: department.parent_id };

    // Delete from database only (no AD sync)
    await department.destroy();

    await logAudit({
      req,
      action: 'DELETE',
      entityType: 'Department',
      entityId: departmentDetails.id,
      details: { name: departmentDetails.name, description: departmentDetails.description, parentId: departmentDetails.parentId }
    });

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({
      error: 'Failed to delete department',
      message: error.message
    });
  }
});


// Sync department to AD (super admin only)
router.post('/:id/sync', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id, {
      include: [{
        model: Department,
        as: 'ParentDepartment',
        required: false
      }]
    });

    if (!department) {
      return res.status(404).json({
        error: 'Department not found',
        message: 'The requested department does not exist'
      });
    }

    const adSyncEnabled = process.env.ENABLE_AD_DEPARTMENT_SYNC !== 'false';
    if (!adSyncEnabled) {
      return res.status(400).json({
        error: 'AD sync disabled',
        message: 'AD sync is disabled. Set ENABLE_AD_DEPARTMENT_SYNC=true to enable.'
      });
    }

    let parentDN = null;
    if (department.parent_id && department.ParentDepartment?.ad_dn) {
      parentDN = department.ParentDepartment.ad_dn;
    }

    let adSyncResult = null;

    try {
      if (department.ad_dn) {
        // Department already has AD DN - verify it exists and update if needed
        const adResult = await ldapService.updateOrganizationalUnit(
          department.ad_dn,
          null,
          department.description || null,
          null
        );

        if (adResult.success) {
          await department.update({
            last_ad_sync: new Date()
          });
          adSyncResult = { synced: true, message: 'Department verified and synced to AD', action: 'verified' };
        } else {
          adSyncResult = { synced: false, message: adResult.message };
        }
      } else {
        // Department doesn't have AD DN - check if OU exists, otherwise create it
        const existingOU = await ldapService.findOrganizationalUnitDN(department.name, parentDN);

        if (existingOU) {
          // OU exists - link it to the department
          await department.update({
            ad_dn: existingOU,
            last_ad_sync: new Date()
          });
          adSyncResult = { synced: true, message: 'Found existing OU in AD and linked to department', action: 'linked' };
        } else {
          // Create new OU
          const adResult = await ldapService.createOrganizationalUnit(
            department.name,
            department.description || department.name,
            parentDN
          );

          if (adResult.success) {
            await department.update({
              ad_dn: adResult.dn,
              last_ad_sync: new Date()
            });
            adSyncResult = { synced: true, message: 'Department created in AD', action: 'created' };
          } else if (adResult.errorType === 'exists') {
            // OU was created between check and create - find and link it
            const foundOU = await ldapService.findOrganizationalUnitDN(department.name, parentDN);
            if (foundOU) {
              await department.update({
                ad_dn: foundOU,
                last_ad_sync: new Date()
              });
              adSyncResult = { synced: true, message: 'Found existing OU in AD and linked to department', action: 'linked' };
            } else {
              adSyncResult = { synced: false, message: adResult.message };
            }
          } else {
            adSyncResult = { synced: false, message: adResult.message };
          }
        }
      }
    } catch (adError) {
      console.error(`❌ AD sync failed for department "${department.name}":`, adError.message);

      const isPermissionError = adError.message.includes('Permission denied') ||
        adError.message.includes('INSUFF_ACCESS_RIGHTS');

      adSyncResult = {
        synced: false,
        message: adError.message,
        isPermissionError: isPermissionError
      };
    }

    // Reload department to get updated data
    await department.reload();

    res.json({
      message: adSyncResult.synced ? 'Department synced successfully' : 'Department sync failed',
      department: {
        id: department.id,
        name: department.name,
        adDn: department.ad_dn,
        lastAdSync: department.last_ad_sync
      },
      adSync: adSyncResult
    });
  } catch (error) {
    console.error('Error syncing department:', error);
    res.status(500).json({
      error: 'Failed to sync department',
      message: error.message
    });
  }
});

// Export departments to Excel (super admin only)
router.get('/export/excel', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const filters = {
      active: req.query.active || 'all'
    };

    const excelBuffer = await exportService.exportDepartments(filters);

    // Set response headers for Excel file download
    const filename = `departments_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting departments:', error);
    res.status(500).json({
      error: 'Failed to export departments',
      message: error.message
    });
  }
});

// Get department hierarchy (tree structure)
router.get('/hierarchy/tree', authenticateToken, async (req, res) => {
  try {
    const departments = await Department.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    // Build tree structure
    const departmentMap = new Map();
    const rootDepartments = [];

    // First pass: create map of all departments
    departments.forEach(dept => {
      departmentMap.set(dept.id, {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        parentId: dept.parent_id,
        children: []
      });
    });

    // Second pass: build tree
    departments.forEach(dept => {
      const deptNode = departmentMap.get(dept.id);

      if (dept.parent_id && departmentMap.has(dept.parent_id)) {
        const parent = departmentMap.get(dept.parent_id);
        parent.children.push(deptNode);
      } else {
        rootDepartments.push(deptNode);
      }
    });

    res.json({
      departments: rootDepartments
    });
  } catch (error) {
    console.error('Error fetching department hierarchy:', error);
    res.status(500).json({
      error: 'Failed to fetch department hierarchy',
      message: error.message
    });
  }
});

export default router;
