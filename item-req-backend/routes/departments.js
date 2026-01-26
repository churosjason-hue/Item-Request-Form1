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
    let parentDepartment = null;
    if (parentId) {
      parentDepartment = await Department.findByPk(parentId);
      if (!parentDepartment) {
        return res.status(400).json({
          error: 'Invalid parent',
          message: 'Parent department not found'
        });
      }
    }

    // Determine parent DN for AD if parent department exists
    let parentDN = null;
    if (parentDepartment) {
      // If parent has AD DN, use it; otherwise use base DN
      parentDN = parentDepartment.ad_dn || null;
    }

    // Create department in database
    const department = await Department.create({
      name: name.trim(),
      description: description?.trim() || name.trim(),
      parent_id: parentId || null,
      is_active: true
    });

    // Sync to Active Directory (if enabled)
    let adSyncResult = null;
    const adSyncEnabled = process.env.ENABLE_AD_DEPARTMENT_SYNC !== 'false';

    if (adSyncEnabled) {
      try {
        const adResult = await ldapService.createOrganizationalUnit(
          department.name,
          department.description,
          parentDN
        );

        if (adResult.success) {
          // Update department with AD DN
          await department.update({
            ad_dn: adResult.dn,
            last_ad_sync: new Date()
          });
          adSyncResult = { synced: true, message: adResult.message };
        } else {
          // OU already exists or creation failed
          adSyncResult = { synced: false, message: adResult.message, errorType: adResult.errorType };
          console.warn(`⚠️ AD sync warning for department "${department.name}": ${adResult.message}`);
        }
      } catch (adError) {
        // Log error but don't fail the request - department is created in DB
        console.error(`❌ AD sync failed for department "${department.name}":`, adError.message);

        // Check if it's a permission error
        const isPermissionError = adError.message.includes('Permission denied') ||
          adError.message.includes('INSUFF_ACCESS_RIGHTS');

        adSyncResult = {
          synced: false,
          message: adError.message,
          isPermissionError: isPermissionError
        };
      }
    } else {
      adSyncResult = { synced: false, message: 'AD sync is disabled', disabled: true };
    }

    // Audit Log: Department Created
    await logAudit({
      req,
      action: 'CREATE',
      entityType: 'Department',
      entityId: department.id,
      details: {
        name: department.name,
        description: department.description,
        parentId: department.parent_id,
        adSync: adSyncResult
      }
    });

    res.status(201).json({
      message: 'Department created successfully',
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
        parentId: department.parent_id,
        isActive: department.is_active,
        adDn: department.ad_dn,
        adSync: adSyncResult
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

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Department name cannot be empty'
        });
      }

      // Check if another department has this name
      const existingDept = await Department.findOne({
        where: {
          name: name.trim(),
          id: { [Op.ne]: id }
        }
      });

      if (existingDept) {
        return res.status(409).json({
          error: 'Department exists',
          message: 'Another department with this name already exists'
        });
      }
    }

    // Validate parent department if provided
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

    // Prepare update data
    const updateData = {};
    const oldName = department.name;
    const oldDescription = department.description;
    const oldParentId = department.parent_id;
    const oldIsActive = department.is_active;

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || name?.trim() || department.name;
    if (parentId !== undefined) updateData.parent_id = parentId;
    if (isActive !== undefined) updateData.is_active = isActive;

    // Sync to Active Directory if department has AD DN or if we're creating one
    let adSyncResult = null;
    const adSyncEnabled = process.env.ENABLE_AD_DEPARTMENT_SYNC !== 'false';
    const needsAdSync = adSyncEnabled && (department.ad_dn || (name !== undefined || description !== undefined || parentId !== undefined));

    if (needsAdSync) {
      try {
        if (department.ad_dn) {
          // Update existing OU in AD
          let newParentDN = null;
          if (parentId !== undefined && parentId !== oldParentId) {
            if (parentId) {
              const newParent = await Department.findByPk(parentId);
              newParentDN = newParent?.ad_dn || null;
            } else {
              newParentDN = null; // Moving to root
            }
          } else if (department.ad_dn) {
            // Extract parent DN from current DN
            const currentParentDN = department.ad_dn.substring(department.ad_dn.indexOf(',') + 1);
            newParentDN = currentParentDN;
          }

          const adResult = await ldapService.updateOrganizationalUnit(
            department.ad_dn,
            name !== undefined ? name.trim() : null,
            description !== undefined ? description.trim() : null,
            newParentDN
          );

          if (adResult.success) {
            updateData.ad_dn = adResult.dn;
            updateData.last_ad_sync = new Date();
            adSyncResult = { synced: true, message: adResult.message, changes: adResult.changes };
          } else {
            adSyncResult = { synced: false, message: adResult.message };
          }
        } else {
          // Department doesn't have ad_dn - check if OU exists in AD, otherwise create it
          let parentDN = null;
          if (parentId !== undefined && parentId) {
            const parentDept = await Department.findByPk(parentId);
            parentDN = parentDept?.ad_dn || null;
          } else if (oldParentId) {
            // If removing parent, check old parent location
            const oldParentDept = await Department.findByPk(oldParentId);
            parentDN = oldParentDept?.ad_dn || null;
          }

          const newName = name !== undefined ? name.trim() : department.name;
          const newDesc = description !== undefined ? description.trim() : department.description;
          const currentName = department.name;

          // Search for existing OU - try both current name and new name (if different)
          // Also search in both old and new parent locations
          let existingOU = null;
          let foundWithName = null;

          // First, try to find OU with current name in new parent location
          if (newName === currentName) {
            existingOU = await ldapService.findOrganizationalUnitDN(currentName, parentDN);
            foundWithName = currentName;
          } else {
            // Name is changing - search for both names
            existingOU = await ldapService.findOrganizationalUnitDN(currentName, parentDN);
            if (existingOU) {
              foundWithName = currentName;
            } else {
              // Try new name in case OU was already renamed
              existingOU = await ldapService.findOrganizationalUnitDN(newName, parentDN);
              if (existingOU) {
                foundWithName = newName;
              }
            }
          }

          // If not found in new parent, try old parent location
          if (!existingOU && oldParentId && parentId !== oldParentId) {
            const oldParentDept = await Department.findByPk(oldParentId);
            const oldParentDN = oldParentDept?.ad_dn || null;
            existingOU = await ldapService.findOrganizationalUnitDN(currentName, oldParentDN);
            if (existingOU) {
              foundWithName = currentName;
              // Update parent DN to old location for now (will be moved if parent changed)
              parentDN = oldParentDN;
            }
          }

          if (existingOU) {
            // OU exists - update it (may rename if name changed, may move if parent changed)
            const needsRename = name !== undefined && name.trim() !== foundWithName;
            const needsMove = parentId !== undefined && parentId !== oldParentId;
            let newParentDNForUpdate = null;

            if (needsMove) {
              if (parentId) {
                const newParent = await Department.findByPk(parentId);
                newParentDNForUpdate = newParent?.ad_dn || null;
              } else {
                newParentDNForUpdate = null; // Moving to root
              }
            }

            const adResult = await ldapService.updateOrganizationalUnit(
              existingOU,
              needsRename ? name.trim() : null,
              newDesc !== department.description ? newDesc : null,
              needsMove ? newParentDNForUpdate : null
            );

            if (adResult.success) {
              updateData.ad_dn = adResult.dn || existingOU;
              updateData.last_ad_sync = new Date();
              adSyncResult = { synced: true, message: `Found existing OU in AD and updated it: ${adResult.message}`, changes: adResult.changes };
            } else {
              // If update fails, at least store the DN we found
              updateData.ad_dn = existingOU;
              updateData.last_ad_sync = new Date();
              adSyncResult = { synced: false, message: `Found existing OU but update failed: ${adResult.message}` };
            }
          } else {
            // OU doesn't exist - create it with the new name
            const adResult = await ldapService.createOrganizationalUnit(
              newName,
              newDesc,
              parentDN
            );

            if (adResult.success) {
              updateData.ad_dn = adResult.dn;
              updateData.last_ad_sync = new Date();
              adSyncResult = { synced: true, message: adResult.message };
            } else if (adResult.errorType === 'exists') {
              // OU was created between our check and create attempt - try to find and update it
              const foundOU = await ldapService.findOrganizationalUnitDN(newName, parentDN);
              if (foundOU) {
                updateData.ad_dn = foundOU;
                updateData.last_ad_sync = new Date();
                adSyncResult = { synced: true, message: `OU already exists in AD, linked to department` };
              } else {
                adSyncResult = { synced: false, message: adResult.message, errorType: adResult.errorType };
              }
            } else {
              adSyncResult = { synced: false, message: adResult.message, errorType: adResult.errorType };
            }
          }
        }
      } catch (adError) {
        console.error(`❌ AD sync failed for department "${department.name}":`, adError.message);

        // Check if it's a permission error
        const isPermissionError = adError.message.includes('Permission denied') ||
          adError.message.includes('INSUFF_ACCESS_RIGHTS');

        adSyncResult = {
          synced: false,
          message: adError.message,
          isPermissionError: isPermissionError
        };
        // Continue with DB update even if AD sync fails
      }
    } else if (!adSyncEnabled) {
      adSyncResult = { synced: false, message: 'AD sync is disabled', disabled: true };
    }

    // Calculate changes for audit log before updating
    const changes = calculateChanges({
      name: oldName,
      description: oldDescription,
      parent_id: oldParentId,
      is_active: oldIsActive
    }, {
      name: updateData.name,
      description: updateData.description,
      parent_id: updateData.parent_id,
      is_active: updateData.is_active
    });

    // Update department in database
    await department.update(updateData);

    // Audit Log: Department Updated
    if (Object.keys(changes).length > 0) {
      await logAudit({
        req,
        action: 'UPDATE',
        entityType: 'Department',
        entityId: department.id,
        details: { changes, adSync: adSyncResult }
      });
    }

    res.json({
      message: 'Department updated successfully',
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
        parentId: department.parent_id,
        isActive: department.is_active,
        adDn: department.ad_dn,
        adSync: adSyncResult
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
      include: [{
        model: User,
        as: 'Users'
      }, {
        model: Department,
        as: 'SubDepartments'
      }]
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

    // Delete from Active Directory (always attempt if AD sync is enabled)
    let adDeleteResult = null;
    const adSyncEnabled = process.env.ENABLE_AD_DEPARTMENT_SYNC !== 'false';

    if (adSyncEnabled) {
      try {
        let ouDN = department.ad_dn;

        // If department doesn't have ad_dn stored, try to find the OU in AD
        if (!ouDN) {
          console.log(`⚠️ Department "${department.name}" has no stored AD DN, searching for OU in AD...`);

          // Try to find the OU by name
          let parentDN = null;
          if (department.parent_id) {
            const parentDept = await Department.findByPk(department.parent_id);
            parentDN = parentDept?.ad_dn || null;
          }

          ouDN = await ldapService.findOrganizationalUnitDN(department.name, parentDN);

          if (!ouDN) {
            console.log(`⚠️ OU "${department.name}" not found in AD, proceeding with database deletion only`);
            adDeleteResult = { deleted: false, message: 'OU not found in AD, deleted from database only' };
          } else {
            console.log(`✅ Found OU in AD: ${ouDN}, proceeding with deletion`);
          }
        }

        // Delete from AD if we have a DN (either from database or found by search)
        if (ouDN) {
          const adResult = await ldapService.deleteOrganizationalUnit(ouDN);

          if (adResult.success) {
            adDeleteResult = { deleted: true, message: adResult.message };
            console.log(`✅ Successfully deleted OU from AD: ${ouDN}`);
          } else if (adResult.notFound) {
            // OU doesn't exist in AD - proceed with DB deletion
            adDeleteResult = { deleted: false, message: 'OU not found in AD, deleted from database only' };
          } else {
            // Other errors - still proceed with DB deletion but log the error
            adDeleteResult = { deleted: false, message: adResult.message };
            console.warn(`⚠️ AD deletion returned error: ${adResult.message}`);
          }
        }
      } catch (adError) {
        console.error(`❌ AD deletion failed for department "${department.name}":`, adError.message);
        console.error('Error details:', adError);

        // Check if it's a permission error or has children
        const isPermissionError = adError.message.includes('Permission denied') ||
          adError.message.includes('INSUFF_ACCESS_RIGHTS') ||
          adError.message.includes('Delete organizationalUnit objects');
        const hasChildren = adError.message.includes('child objects') ||
          adError.message.includes('not empty') ||
          adError.message.includes('0000209A'); // LDAP error code for "not empty"

        if (hasChildren) {
          // The recursive deletion should handle this, but if it still fails, return error
          return res.status(400).json({
            error: 'Cannot delete department',
            message: `Cannot delete OU from AD: ${adError.message}. The OU may contain objects that cannot be deleted.`
          });
        }

        // For permission errors, prevent database deletion and return error
        if (isPermissionError) {
          return res.status(403).json({
            error: 'Permission denied',
            message: `Cannot delete department: ${adError.message}. Please ensure the LDAP service account has the required permissions, or delete the OU manually from Active Directory first.`,
            details: {
              serviceAccount: process.env.LDAP_BIND_DN || 'Not configured',
              requiredPermission: 'Delete organizationalUnit objects',
              action: 'Please contact your Active Directory administrator to grant delete permissions, or manually delete the OU from AD and then delete the department from the system.'
            }
          });
        }

        // For other errors, warn but allow deletion from DB
        // (Admin can manually delete from AD later)
        adDeleteResult = {
          deleted: false,
          message: adError.message,
          warning: 'Department deleted from database, but AD deletion failed. Please delete the OU manually from Active Directory.',
          isPermissionError: false
        };
      }
    } else {
      adDeleteResult = { deleted: false, message: 'AD sync is disabled', disabled: true };
    }

    // Store department details for audit log before deletion
    const departmentDetails = {
      id: department.id,
      name: department.name,
      description: department.description,
      adDn: department.ad_dn,
      parentId: department.parent_id
    };

    // Delete from database
    await department.destroy();

    // Audit Log: Department Deleted
    await logAudit({
      req,
      action: 'DELETE',
      entityType: 'Department',
      entityId: departmentDetails.id,
      details: {
        name: departmentDetails.name,
        description: departmentDetails.description,
        adDn: departmentDetails.adDn,
        parentId: departmentDetails.parentId,
        adDelete: adDeleteResult
      }
    });

    res.json({
      message: 'Department deleted successfully',
      adDelete: adDeleteResult
    });
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
