import { Client } from 'ldapts';
import dotenv from 'dotenv';

dotenv.config();

class LDAPService {
  constructor() {
    this.config = {
      url: process.env.LDAP_URL,
      bindDN: process.env.LDAP_BIND_DN,
      bindPassword: process.env.LDAP_BIND_PASSWORD,
      baseDN: process.env.LDAP_BASE_DN,
      userSearchBase: process.env.LDAP_USER_SEARCH_BASE,
      groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE,
      attributes: {
        username: process.env.LDAP_USERNAME_ATTRIBUTE || 'sAMAccountName',
        email: process.env.LDAP_EMAIL_ATTRIBUTE || 'mail',
        firstName: process.env.LDAP_FIRSTNAME_ATTRIBUTE || 'givenName',
        lastName: process.env.LDAP_LASTNAME_ATTRIBUTE || 'sn',
        department: process.env.LDAP_DEPARTMENT_ATTRIBUTE || 'department',
        title: process.env.LDAP_TITLE_ATTRIBUTE || 'title',
        phone: process.env.LDAP_PHONE_ATTRIBUTE || 'telephoneNumber'
      }
    };
    
    this.client = null;
  }

  async connect() {
    try {
      this.client = new Client({
        url: this.config.url,
        timeout: 10000,
        connectTimeout: 10000
      });
      
      await this.client.bind(this.config.bindDN, this.config.bindPassword);
      console.log('✅ LDAP connection established successfully');
      return true;
    } catch (error) {
      console.error('❌ LDAP connection failed:', error.message);
      throw new Error(`LDAP connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.unbind();
        this.client = null;
        console.log('✅ LDAP connection closed');
      } catch (error) {
        console.error('❌ Error closing LDAP connection:', error.message);
      }
    }
  }

  async authenticateUser(usernameOrEmail, password) {
    let tempClient = null;
    try {
      let userDN;
      let userDetails;
      
      // Try to find user by username first, then by email
      try {
        userDN = await this.findUserDN(usernameOrEmail);
        if (userDN) {
          userDetails = await this.getUserDetails(usernameOrEmail);
        }
      } catch (error) {
        // Username search failed, try email
        console.log(`Username search failed, trying email for: ${usernameOrEmail}`);
      }
      
      // If username search failed, try email
      if (!userDN) {
        try {
          userDN = await this.findUserDNByEmail(usernameOrEmail);
          if (userDN) {
            userDetails = await this.getUserDetailsByEmail(usernameOrEmail);
          }
        } catch (error) {
          console.log(`Email search also failed for: ${usernameOrEmail}`);
        }
      }
      
      if (!userDN) {
        throw new Error('User not found in Active Directory');
      }

      // Try to bind with user credentials
      tempClient = new Client({
        url: this.config.url,
        timeout: 5000,
        connectTimeout: 5000
      });

      await tempClient.bind(userDN, password);
      console.log(`✅ User ${usernameOrEmail} authenticated successfully`);
      
      await tempClient.unbind();
      return userDetails;
    } catch (error) {
      if (tempClient) {
        try {
          await tempClient.unbind();
        } catch (unbindError) {
          console.error('Error unbinding temp client:', unbindError.message);
        }
      }
      console.error(`❌ Authentication failed for ${usernameOrEmail}:`, error.message);
      throw new Error('Invalid username or password');
    }
  }

  async findUserDN(username) {
    try {
      if (!this.client) {
        await this.connect();
      }

      const searchOptions = {
        scope: 'sub',
        filter: `(${this.config.attributes.username}=${username})`,
        attributes: ['dn']
      };

      const { searchEntries } = await this.client.search(
        this.config.userSearchBase,
        searchOptions
      );

      if (searchEntries.length === 0) {
        return null;
      }

      return searchEntries[0].dn;
    } catch (error) {
      console.error('Error finding user DN:', error.message);
      throw error;
    }
  }

  async findUserDNByEmail(email) {
    try {
      if (!this.client) {
        await this.connect();
      }

      const searchOptions = {
        scope: 'sub',
        filter: `(${this.config.attributes.email}=${email})`,
        attributes: ['dn']
      };

      const { searchEntries } = await this.client.search(
        this.config.userSearchBase,
        searchOptions
      );

      if (searchEntries.length === 0) {
        return null;
      }

      return searchEntries[0].dn;
    } catch (error) {
      console.error('Error finding user DN by email:', error.message);
      throw error;
    }
  }

  async getUserDetails(username) {
    try {
      if (!this.client) {
        await this.connect();
      }

      const searchOptions = {
        scope: 'sub',
        filter: `(${this.config.attributes.username}=${username})`,
        attributes: [
          this.config.attributes.username,
          this.config.attributes.email,
          this.config.attributes.firstName,
          this.config.attributes.lastName,
          this.config.attributes.department,
          this.config.attributes.title,
          this.config.attributes.phone,
          'memberOf',
          'dn'
        ]
      };

      const { searchEntries } = await this.client.search(
        this.config.userSearchBase,
        searchOptions
      );

      if (searchEntries.length === 0) {
        throw new Error('User not found');
      }

      const user = searchEntries[0];
      
      // Helper function to safely extract string values from LDAP attributes
      const safeString = (value) => {
        if (!value) return '';
        if (Array.isArray(value)) return value[0] || '';
        return String(value);
      };

      return {
        username: safeString(user[this.config.attributes.username]),
        email: safeString(user[this.config.attributes.email]),
        firstName: safeString(user[this.config.attributes.firstName]),
        lastName: safeString(user[this.config.attributes.lastName]),
        department: safeString(user[this.config.attributes.department]),
        title: safeString(user[this.config.attributes.title]),
        phone: safeString(user[this.config.attributes.phone]),
        dn: user.dn,
        groups: Array.isArray(user.memberOf) ? user.memberOf : [user.memberOf].filter(Boolean)
      };
    } catch (error) {
      console.error('Error getting user details:', error.message);
      throw error;
    }
  }

  async getUserDetailsByEmail(email) {
    try {
      if (!this.client) {
        await this.connect();
      }

      const searchOptions = {
        scope: 'sub',
        filter: `(${this.config.attributes.email}=${email})`,
        attributes: [
          this.config.attributes.username,
          this.config.attributes.email,
          this.config.attributes.firstName,
          this.config.attributes.lastName,
          this.config.attributes.department,
          this.config.attributes.title,
          this.config.attributes.phone,
          'memberOf',
          'dn'
        ]
      };

      const { searchEntries } = await this.client.search(
        this.config.userSearchBase,
        searchOptions
      );

      if (searchEntries.length === 0) {
        throw new Error('User not found by email');
      }

      const user = searchEntries[0];
      
      // Helper function to safely extract string values from LDAP attributes
      const safeString = (value) => {
        if (!value) return '';
        if (Array.isArray(value)) return value[0] || '';
        return String(value);
      };

      return {
        username: safeString(user[this.config.attributes.username]),
        email: safeString(user[this.config.attributes.email]),
        firstName: safeString(user[this.config.attributes.firstName]),
        lastName: safeString(user[this.config.attributes.lastName]),
        department: safeString(user[this.config.attributes.department]),
        title: safeString(user[this.config.attributes.title]),
        phone: safeString(user[this.config.attributes.phone]),
        dn: user.dn,
        groups: Array.isArray(user.memberOf) ? user.memberOf : [user.memberOf].filter(Boolean)
      };
    } catch (error) {
      console.error('Error getting user details by email:', error.message);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      if (!this.client) {
        await this.connect();
      }

      const searchOptions = {
        scope: 'sub',
        filter: process.env.LDAP_USER_FILTER || `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=*)(mail=*))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`,
        attributes: [
          this.config.attributes.username,
          this.config.attributes.email,
          this.config.attributes.firstName,
          this.config.attributes.lastName,
          this.config.attributes.department,
          this.config.attributes.title,
          this.config.attributes.phone,
          'memberOf',
          'dn'
        ]
      };

      const { searchEntries } = await this.client.search(
        this.config.userSearchBase,
        searchOptions
      );

      // Helper function to safely extract string values from LDAP attributes
      const safeString = (value) => {
        if (!value) return '';
        if (Array.isArray(value)) return value[0] || '';
        return String(value);
      };

      return searchEntries.map(user => ({
        username: safeString(user[this.config.attributes.username]),
        email: safeString(user[this.config.attributes.email]),
        firstName: safeString(user[this.config.attributes.firstName]),
        lastName: safeString(user[this.config.attributes.lastName]),
        department: safeString(user[this.config.attributes.department]),
        title: safeString(user[this.config.attributes.title]),
        phone: safeString(user[this.config.attributes.phone]),
        dn: user.dn, // Include DN for OU extraction
        groups: Array.isArray(user.memberOf) ? user.memberOf : [user.memberOf].filter(Boolean)
      }));
    } catch (error) {
      console.error('Error getting all users:', error.message);
      throw error;
    }
  }

  async getDepartments() {
    try {
      if (!this.client) {
        await this.connect();
      }

      // Get departments from user Department attributes (not OUs)
      const departments = [];
      const departmentMap = new Map(); // To track by name and avoid duplicates
      
      try {
        // Get all users and extract unique department values from their Department attribute
        const users = await this.getAllUsers();
        
        users.forEach(user => {
          // Extract department from Department attribute only
          if (user.department && user.department.trim()) {
            const deptName = user.department.trim();
            
            // Use name as key to avoid duplicates
            if (!departmentMap.has(deptName)) {
              departmentMap.set(deptName, {
                name: deptName,
                description: deptName,
                dn: null // No OU DN when using attributes
              });
            }
          }
        });

        // Convert map to array
        departments.push(...Array.from(departmentMap.values()));

        console.log(`📊 Found ${departments.length} departments from user Department attributes:`, departments.map(d => d.name));
      } catch (error) {
        console.error('⚠️ Error extracting departments from user attributes:', error.message);
        throw error;
      }

      // Sort departments by name
      departments.sort((a, b) => a.name.localeCompare(b.name));

      return departments;
    } catch (error) {
      console.error('Error getting departments:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.connect();
      
      // Test basic search
      const { searchEntries } = await this.client.search(this.config.baseDN, {
        scope: 'base',
        filter: '(objectClass=*)',
        attributes: ['dn']
      });

      await this.disconnect();
      
      return {
        success: true,
        message: 'LDAP connection test successful',
        baseDN: this.config.baseDN,
        entriesFound: searchEntries.length
      };
    } catch (error) {
      return {
        success: false,
        message: `LDAP connection test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // Find Organizational Unit DN by name
  async findOrganizationalUnitDN(ouName, parentDN = null) {
    try {
      if (!this.client) {
        await this.connect();
      }

      const searchBase = parentDN || this.config.baseDN;
      const searchOptions = {
        scope: 'sub',
        filter: `(&(objectClass=organizationalUnit)(ou=${ouName}))`,
        attributes: ['dn', 'ou', 'description']
      };

      const { searchEntries } = await this.client.search(searchBase, searchOptions);

      if (searchEntries.length === 0) {
        return null;
      }

      return searchEntries[0].dn;
    } catch (error) {
      console.error('Error finding OU DN:', error.message);
      throw error;
    }
  }

  // Create Organizational Unit in Active Directory
  async createOrganizationalUnit(ouName, description = null, parentDN = null) {
    try {
      if (!this.client) {
        await this.connect();
      }

      // Check if OU already exists
      const existingDN = await this.findOrganizationalUnitDN(ouName, parentDN);
      if (existingDN) {
        return {
          success: false,
          message: `Organizational Unit "${ouName}" already exists`,
          dn: existingDN,
          errorType: 'exists'
        };
      }

      // Determine parent DN - use provided parent or base DN
      const parent = parentDN || this.config.baseDN;
      
      // Construct the new OU DN
      const ouDN = `OU=${ouName},${parent}`;

      // Prepare attributes for the new OU
      const attributes = {
        objectClass: ['top', 'organizationalUnit'],
        ou: ouName
      };

      if (description) {
        attributes.description = description;
      }

      // Add the OU
      await this.client.add(ouDN, attributes);

      console.log(`✅ Created OU in AD: ${ouDN}`);
      
      return {
        success: true,
        message: `Organizational Unit "${ouName}" created successfully`,
        dn: ouDN
      };
    } catch (error) {
      console.error(`❌ Error creating OU "${ouName}":`, error.message);
      
      // Check for permission errors
      const errorMessage = error.message || '';
      const isPermissionError = errorMessage.includes('INSUFF_ACCESS_RIGHTS') || 
                                errorMessage.includes('0x32') ||
                                errorMessage.includes('Insufficient') ||
                                errorMessage.includes('Access Rights') ||
                                errorMessage.includes('access rights');
      
      if (isPermissionError) {
        const parentLocation = parentDN || this.config.baseDN;
        throw new Error(
          `Permission denied: The LDAP service account does not have sufficient permissions to create Organizational Units in Active Directory. ` +
          `Please ensure the service account (${this.config.bindDN}) has the following permissions on "${parentLocation}": ` +
          `"Create organizationalUnit objects", "Delete organizationalUnit objects", and "Write" permissions. ` +
          `Contact your Active Directory administrator to grant these permissions.`
        );
      }
      
      throw new Error(`Failed to create OU in AD: ${error.message}`);
    }
  }

  // Update Organizational Unit in Active Directory
  async updateOrganizationalUnit(oldDN, newName = null, newDescription = null, newParentDN = null) {
    try {
      if (!this.client) {
        await this.connect();
      }

      // Check if OU exists
      const { searchEntries } = await this.client.search(oldDN, {
        scope: 'base',
        filter: '(objectClass=organizationalUnit)',
        attributes: ['dn', 'ou', 'description']
      });

      if (searchEntries.length === 0) {
        throw new Error(`Organizational Unit not found: ${oldDN}`);
      }

      const changes = [];

      // Update name (rename OU)
      if (newName && newName !== searchEntries[0].ou) {
        // Check if new name already exists in parent
        const parentDN = oldDN.substring(oldDN.indexOf(',') + 1);
        const existingDN = await this.findOrganizationalUnitDN(newName, parentDN);
        if (existingDN && existingDN !== oldDN) {
          throw new Error(`Organizational Unit "${newName}" already exists`);
        }

        // Rename the OU
        const newDN = `OU=${newName},${oldDN.substring(oldDN.indexOf(',') + 1)}`;
        await this.client.modifyDN(oldDN, newDN);
        
        // Update oldDN for subsequent operations
        oldDN = newDN;
        changes.push(`Renamed to "${newName}"`);
      }

      // Update description
      if (newDescription !== null) {
        await this.client.modify(oldDN, {
          changes: [
            {
              operation: 'replace',
              modification: {
                description: newDescription
              }
            }
          ]
        });
        changes.push('Updated description');
      }

      // Move OU to new parent (if specified)
      if (newParentDN && newParentDN !== oldDN.substring(oldDN.indexOf(',') + 1)) {
        const ouName = oldDN.split(',')[0].replace('OU=', '');
        const newDN = `OU=${ouName},${newParentDN}`;
        
        // Check if OU with same name exists in new parent
        const existingDN = await this.findOrganizationalUnitDN(ouName, newParentDN);
        if (existingDN && existingDN !== oldDN) {
          throw new Error(`Organizational Unit "${ouName}" already exists in target location`);
        }

        await this.client.modifyDN(oldDN, newDN);
        oldDN = newDN;
        changes.push('Moved to new parent');
      }

      console.log(`✅ Updated OU in AD: ${oldDN} - Changes: ${changes.join(', ')}`);

      return {
        success: true,
        message: `Organizational Unit updated successfully`,
        dn: oldDN,
        changes: changes
      };
    } catch (error) {
      console.error(`❌ Error updating OU:`, error.message);
      
      // Check for permission errors
      const errorMessage = error.message || '';
      const isPermissionError = errorMessage.includes('INSUFF_ACCESS_RIGHTS') || 
                                errorMessage.includes('0x32') ||
                                errorMessage.includes('Insufficient') ||
                                errorMessage.includes('Access Rights') ||
                                errorMessage.includes('access rights');
      
      if (isPermissionError) {
        throw new Error(
          `Permission denied: The LDAP service account does not have sufficient permissions to modify Organizational Units in Active Directory. ` +
          `Please ensure the service account (${this.config.bindDN}) has "Write" and "Modify" permissions on the Organizational Unit. ` +
          `Contact your Active Directory administrator to grant these permissions.`
        );
      }
      
      throw new Error(`Failed to update OU in AD: ${error.message}`);
    }
  }

  // Update user attribute in Active Directory
  async updateUserAttribute(userDN, attributeName, attributeValue) {
    try {
      if (!this.client) {
        await this.connect();
      }

      // Extract OU from DN for logging
      const ouMatch = userDN.match(/OU=([^,]+)/i);
      const ouName = ouMatch ? ouMatch[1] : 'Unknown OU';
      
      console.log(`🔄 Attempting to update ${attributeName} attribute for user in OU: ${ouName}`);
      console.log(`   User DN: ${userDN}`);
      console.log(`   New value: ${attributeValue}`);

      const { Change, Attribute } = await import('ldapts');
      const change = new Change({
        operation: 'replace',
        modification: new Attribute({
          type: attributeName,
          values: attributeValue ? [attributeValue] : []
        })
      });

      await this.client.modify(userDN, [change]);
      
      console.log(`✅ Successfully updated ${attributeName} attribute in AD for user in OU: ${ouName}`);
      
      return {
        success: true,
        message: `Successfully updated ${attributeName} attribute in AD`
      };
    } catch (error) {
      // Extract OU from DN for error reporting
      const ouMatch = userDN.match(/OU=([^,]+)/i);
      const ouName = ouMatch ? ouMatch[1] : 'Unknown OU';
      
      console.error(`❌ Error updating user attribute ${attributeName} for user in OU: ${ouName}`);
      console.error(`   User DN: ${userDN}`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Error code: ${error.code || 'N/A'}`);
      
      // Check for permission errors
      if (error.message.includes('INSUFF_ACCESS_RIGHTS') || 
          error.message.includes('0x32') || 
          error.message.includes('insufficient access') ||
          error.code === 50 || // LDAP_INSUFFICIENT_ACCESS
          error.code === '0x32') {
        throw new Error(`Permission denied: Insufficient access rights to update ${attributeName} attribute for users in OU "${ouName}". Your LDAP service account (${this.config.bindDN}) needs write permissions on user objects in this OU.`);
      }
      
      throw new Error(`Failed to update ${attributeName} attribute in AD for user in OU "${ouName}": ${error.message}`);
    }
  }

  // Delete Organizational Unit from Active Directory
  async deleteOrganizationalUnit(ouDN) {
    try {
      if (!this.client) {
        await this.connect();
      }

      // Check if OU exists
      const { searchEntries } = await this.client.search(ouDN, {
        scope: 'base',
        filter: '(objectClass=organizationalUnit)',
        attributes: ['dn', 'ou']
      });

      if (searchEntries.length === 0) {
        return {
          success: false,
          message: `Organizational Unit not found: ${ouDN}`,
          notFound: true
        };
      }

      // First, find and delete all child objects recursively
      try {
        const { searchEntries: children } = await this.client.search(ouDN, {
          scope: 'one',
          filter: '(objectClass=*)',
          attributes: ['dn', 'objectClass']
        });

        if (children.length > 0) {
          console.log(`⚠️ OU "${searchEntries[0].ou}" has ${children.length} child object(s), deleting them first...`);
          
          // Delete children first (in reverse order to handle nested structures)
          for (let i = children.length - 1; i >= 0; i--) {
            const childDN = children[i].dn;
            const objectClass = Array.isArray(children[i].objectClass) 
              ? children[i].objectClass[0] 
              : children[i].objectClass;
            
            try {
              // Recursively delete if it's an OU, otherwise just delete
              if (objectClass && objectClass.toLowerCase().includes('organizationalunit')) {
                console.log(`🗑️ Recursively deleting child OU: ${childDN}`);
                const childResult = await this.deleteOrganizationalUnit(childDN);
                if (!childResult.success && !childResult.notFound) {
                  console.warn(`⚠️ Could not delete child OU ${childDN}: ${childResult.message}`);
                }
              } else {
                // Delete other object types (users, groups, etc.)
                console.log(`🗑️ Deleting child object: ${childDN}`);
                await this.client.del(childDN);
              }
            } catch (childError) {
              console.warn(`⚠️ Warning: Could not delete child object ${childDN}:`, childError.message);
              // Continue with other children
            }
          }
        }
      } catch (searchError) {
        // If search fails, continue with deletion attempt anyway
        console.warn('Warning: Could not check for child objects:', searchError.message);
      }

      // Now delete the OU itself
      await this.client.del(ouDN);

      console.log(`✅ Deleted OU from AD: ${ouDN}`);
      
      return {
        success: true,
        message: `Organizational Unit "${searchEntries[0].ou}" deleted successfully from Active Directory`
      };
    } catch (error) {
      console.error(`❌ Error deleting OU:`, error.message);
      
      // Check for permission errors
      const errorMessage = error.message || '';
      const isPermissionError = errorMessage.includes('INSUFF_ACCESS_RIGHTS') || 
                                errorMessage.includes('0x32') ||
                                errorMessage.includes('Insufficient') ||
                                errorMessage.includes('Access Rights') ||
                                errorMessage.includes('access rights');
      
      if (isPermissionError) {
        throw new Error(
          `Permission denied: The LDAP service account does not have sufficient permissions to delete Organizational Units in Active Directory. ` +
          `Please ensure the service account (${this.config.bindDN}) has "Delete organizationalUnit objects" permission. ` +
          `Contact your Active Directory administrator to grant these permissions.`
        );
      }

      
      throw new Error(`Failed to delete OU from AD: ${error.message}`);
    }
  }

  // Utility method to determine user role based on AD groups
  getUserRole(groups) {
    const groupNames = groups.map(group => {
      // Extract CN from DN (e.g., "CN=IT Managers,OU=Groups,DC=company,DC=com" -> "IT Managers")
      const match = group.match(/^CN=([^,]+)/);
      return match ? match[1].toLowerCase() : '';
    });

    // Define role mapping based on AD groups
    if (groupNames.some(group => group.includes('super admin') || group.includes('domain admin') || group.includes('administrators'))) {
      return 'super_administrator';
    }
    if (groupNames.some(group => group.includes('it manager') || group.includes('it admin') || group.includes('it department') || group.includes('itd'))) {
      return 'it_manager';
    }
    if (groupNames.some(group => group.includes('department manager') || group.includes('dept manager') || group.includes('mancom'))) {
      return 'department_approver';
    }
    if (groupNames.some(group => group.includes('service desk') || group.includes('helpdesk'))) {
      return 'service_desk';
    }
    
    // Default role
    return 'requestor';
  }
}

// Export singleton instance
const ldapService = new LDAPService();
export default ldapService;
