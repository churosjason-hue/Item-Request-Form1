import XLSX from 'xlsx';
import { User, Department } from '../models/index.js';
import { Op } from 'sequelize';

class ExportService {
  /**
   * Export users to Excel format
   */
  async exportUsers(filters = {}) {
    try {
      const whereClause = {};
      
      if (filters.search) {
        whereClause[Op.or] = [
          { first_name: { [Op.iLike]: `%${filters.search}%` } },
          { last_name: { [Op.iLike]: `%${filters.search}%` } },
          { username: { [Op.iLike]: `%${filters.search}%` } },
          { email: { [Op.iLike]: `%${filters.search}%` } }
        ];
      }
      
      if (filters.department) {
        whereClause.department_id = filters.department;
      }
      
      if (filters.role) {
        whereClause.role = filters.role;
      }
      
      if (filters.active !== undefined && filters.active !== 'all') {
        whereClause.is_active = filters.active === 'true';
      }

      const users = await User.findAll({
        where: whereClause,
        include: [{
          model: Department,
          as: 'Department',
          required: false
        }],
        attributes: { exclude: ['ad_groups', 'ad_dn'] },
        order: [['last_name', 'ASC'], ['first_name', 'ASC']]
      });

      // Prepare data for Excel
      const excelData = users.map(user => ({
        'ID': user.id,
        'Username': user.username || '',
        'Email': user.email || '',
        'First Name': user.first_name || '',
        'Last Name': user.last_name || '',
        'Full Name': `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        'Department': user.Department?.name || 'No Department',
        'Position/Title': user.title || '',
        'Phone': user.phone || '',
        'Role': this.formatRole(user.role),
        'Status': user.is_active ? 'Active' : 'Inactive',
        'Last Login': user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never',
        'Last AD Sync': user.last_ad_sync ? new Date(user.last_ad_sync).toLocaleDateString() : 'Never'
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 8 },   // ID
        { wch: 15 },  // Username
        { wch: 30 },  // Email
        { wch: 15 },  // First Name
        { wch: 15 },  // Last Name
        { wch: 25 },  // Full Name
        { wch: 25 },  // Department
        { wch: 30 },  // Position/Title
        { wch: 15 },  // Phone
        { wch: 20 },  // Role
        { wch: 12 },  // Status
        { wch: 15 },  // Last Login
        { wch: 15 }   // Last AD Sync
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return excelBuffer;
    } catch (error) {
      console.error('Error exporting users:', error);
      throw error;
    }
  }

  /**
   * Export departments to Excel format
   */
  async exportDepartments(filters = {}) {
    try {
      const whereClause = {};
      
      if (filters.active !== undefined && filters.active !== 'all') {
        whereClause.is_active = filters.active === 'true';
      }

      const departments = await Department.findAll({
        where: whereClause,
        include: [{
          model: Department,
          as: 'ParentDepartment',
          required: false
        }, {
          model: User,
          as: 'Users',
          required: false,
          attributes: ['id', 'username', 'first_name', 'last_name', 'email', 'title', 'role', 'is_active']
        }],
        order: [['name', 'ASC']]
      });

      // Prepare department data for Excel
      const departmentData = departments.map(dept => ({
        'ID': dept.id,
        'Department Name': dept.name || '',
        'Description': dept.description || '',
        'Parent Department': dept.ParentDepartment?.name || 'None',
        'Status': dept.is_active ? 'Active' : 'Inactive',
        'Number of Users': dept.Users?.length || 0,
        'AD Sync Status': dept.ad_dn ? 'Synced' : 'Not Synced',
        'Last AD Sync': dept.last_ad_sync ? new Date(dept.last_ad_sync).toLocaleDateString() : 'Never'
      }));

      // Prepare user data grouped by department
      const userDataByDept = [];
      departments.forEach(dept => {
        if (dept.Users && dept.Users.length > 0) {
          dept.Users.forEach(user => {
            userDataByDept.push({
              'Department': dept.name || '',
              'User ID': user.id,
              'Username': user.username || '',
              'Email': user.email || '',
              'First Name': user.first_name || '',
              'Last Name': user.last_name || '',
              'Full Name': `${user.first_name || ''} ${user.last_name || ''}`.trim(),
              'Position/Title': user.title || '',
              'Role': this.formatRole(user.role),
              'Status': user.is_active ? 'Active' : 'Inactive'
            });
          });
        }
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add Departments sheet
      const deptWorksheet = XLSX.utils.json_to_sheet(departmentData);
      deptWorksheet['!cols'] = [
        { wch: 8 },   // ID
        { wch: 30 },  // Department Name
        { wch: 40 },  // Description
        { wch: 25 },  // Parent Department
        { wch: 12 },  // Status
        { wch: 15 },  // Number of Users
        { wch: 15 },  // AD Sync Status
        { wch: 15 }   // Last AD Sync
      ];
      XLSX.utils.book_append_sheet(workbook, deptWorksheet, 'Departments');

      // Add Users by Department sheet if there are users
      if (userDataByDept.length > 0) {
        const usersWorksheet = XLSX.utils.json_to_sheet(userDataByDept);
        usersWorksheet['!cols'] = [
          { wch: 25 },  // Department
          { wch: 8 },   // User ID
          { wch: 15 },  // Username
          { wch: 30 },  // Email
          { wch: 15 },  // First Name
          { wch: 15 },  // Last Name
          { wch: 25 },  // Full Name
          { wch: 30 },  // Position/Title
          { wch: 20 },  // Role
          { wch: 12 }   // Status
        ];
        XLSX.utils.book_append_sheet(workbook, usersWorksheet, 'Users by Department');
      }

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return excelBuffer;
    } catch (error) {
      console.error('Error exporting departments:', error);
      throw error;
    }
  }

  /**
   * Format role for display
   */
  formatRole(role) {
    const roleMap = {
      'requestor': 'Requestor',
      'department_approver': 'Department Approver',
      'it_manager': 'IT Manager',
      'service_desk': 'Service Desk',
      'super_administrator': 'Super Administrator'
    };
    return roleMap[role] || role;
  }
}

export default new ExportService();

