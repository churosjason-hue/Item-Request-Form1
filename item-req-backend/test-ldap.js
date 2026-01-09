#!/usr/bin/env node

/**
 * LDAP Connection Test Script
 * 
 * This script tests the LDAP/Active Directory connection configuration.
 * Run this script to verify your AD settings before starting the main server.
 * 
 * Usage:
 *   node test-ldap.js
 * 
 * Make sure to configure your .env file with the correct LDAP settings first.
 */

import dotenv from 'dotenv';
import ldapService from './config/ldap.js';

// Load environment variables
dotenv.config();

async function testLDAPConnection() {
  console.log('🔍 Testing LDAP/Active Directory Connection...\n');
  
  // Check if required environment variables are set
  const requiredEnvVars = [
    'LDAP_URL',
    'LDAP_BIND_DN',
    'LDAP_BIND_PASSWORD',
    'LDAP_BASE_DN',
    'LDAP_USER_SEARCH_BASE'
  ];

  console.log('📋 Checking environment variables:');
  let missingVars = [];
  
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: ${varName.includes('PASSWORD') ? '***' : process.env[varName]}`);
    } else {
      console.log(`❌ ${varName}: Not set`);
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.log(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.log('Please configure these in your .env file and try again.');
    process.exit(1);
  }

  console.log('\n🔗 Testing LDAP connection...');
  
  try {
    // Test basic connection
    const connectionResult = await ldapService.testConnection();
    
    if (connectionResult.success) {
      console.log('✅ LDAP connection successful!');
      console.log(`📊 Base DN: ${connectionResult.baseDN}`);
      console.log(`📊 Entries found: ${connectionResult.entriesFound}`);
      
      // Test getting departments
      console.log('\n🏢 Testing department retrieval...');
      try {
        const departments = await ldapService.getDepartments();
        console.log(`✅ Found ${departments.length} departments`);
        
        if (departments.length > 0) {
          console.log('📋 Sample departments:');
          departments.slice(0, 5).forEach(dept => {
            console.log(`   - ${dept.name}: ${dept.description}`);
          });
          if (departments.length > 5) {
            console.log(`   ... and ${departments.length - 5} more`);
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not retrieve departments: ${error.message}`);
      }

      // Test getting users (limited to first 5)
      console.log('\n👥 Testing user retrieval...');
      try {
        const users = await ldapService.getAllUsers();
        console.log(`✅ Found ${users.length} users`);
        
        if (users.length > 0) {
          console.log('📋 Sample users:');
          users.slice(0, 5).forEach(user => {
            console.log(`   - ${user.username} (${user.firstName} ${user.lastName}) - ${user.department || 'No Department'}`);
          });
          if (users.length > 5) {
            console.log(`   ... and ${users.length - 5} more`);
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not retrieve users: ${error.message}`);
      }

      console.log('\n🎉 LDAP connection test completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Start the server: npm run dev');
      console.log('2. Test authentication with a valid AD user');
      console.log('3. Run user sync to populate the database');
      
    } else {
      console.log('❌ LDAP connection failed!');
      console.log(`Error: ${connectionResult.message}`);
      console.log('\n🔧 Troubleshooting tips:');
      console.log('1. Verify LDAP_URL is correct and accessible');
      console.log('2. Check LDAP_BIND_DN and LDAP_BIND_PASSWORD credentials');
      console.log('3. Ensure LDAP_BASE_DN matches your AD structure');
      console.log('4. Check network connectivity to the domain controller');
      console.log('5. Verify firewall settings allow LDAP connections');
    }
    
  } catch (error) {
    console.log('❌ LDAP connection test failed with error:');
    console.log(`Error: ${error.message}`);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n🔧 DNS resolution failed. Check:');
      console.log('- LDAP_URL hostname is correct');
      console.log('- DNS server can resolve the domain controller');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 Connection refused. Check:');
      console.log('- LDAP service is running on the domain controller');
      console.log('- Port 389 (LDAP) or 636 (LDAPS) is open');
      console.log('- Firewall settings');
    } else if (error.message.includes('Invalid credentials')) {
      console.log('\n🔧 Authentication failed. Check:');
      console.log('- LDAP_BIND_DN format (should be full DN)');
      console.log('- LDAP_BIND_PASSWORD is correct');
      console.log('- Service account has proper permissions');
    }
  } finally {
    // Cleanup
    await ldapService.disconnect();
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted by user');
  await ldapService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Test terminated');
  await ldapService.disconnect();
  process.exit(0);
});

// Run the test
testLDAPConnection()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
