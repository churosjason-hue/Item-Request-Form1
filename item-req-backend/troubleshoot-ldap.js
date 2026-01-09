#!/usr/bin/env node

/**
 * LDAP Troubleshooting Script
 * 
 * This script helps diagnose LDAP connection issues by testing different configurations.
 */

import dotenv from 'dotenv';
import { Client } from 'ldapts';

dotenv.config();

const configs = [
  {
    name: "Current Config (DC01)",
    url: "ldap://dc01.stc.com:389",
    bindDN: "CN=moodlebind,OU=Service Accounts,DC=stc,DC=com",
    password: process.env.LDAP_BIND_PASSWORD
  },
  {
    name: "Domain Name",
    url: "ldap://stc.com:389",
    bindDN: "CN=moodlebind,OU=Service Accounts,DC=stc,DC=com",
    password: process.env.LDAP_BIND_PASSWORD
  },
  {
    name: "UPN Format",
    url: "ldap://stc.com:389",
    bindDN: "moodlebind@stc.com",
    password: process.env.LDAP_BIND_PASSWORD
  },
  {
    name: "Users OU",
    url: "ldap://stc.com:389",
    bindDN: "CN=moodlebind,CN=Users,DC=stc,DC=com",
    password: process.env.LDAP_BIND_PASSWORD
  }
];

async function testLDAPConfig(config) {
  console.log(`\n🔍 Testing: ${config.name}`);
  console.log(`   URL: ${config.url}`);
  console.log(`   Bind DN: ${config.bindDN}`);
  console.log(`   Password: ${'*'.repeat(config.password?.length || 0)}`);
  
  let client = null;
  try {
    client = new Client({
      url: config.url,
      timeout: 5000,
      connectTimeout: 5000
    });
    
    await client.bind(config.bindDN, config.password);
    console.log(`   ✅ SUCCESS: Connection and authentication successful!`);
    
    // Try a simple search to verify it's working
    try {
      const { searchEntries } = await client.search('DC=stc,DC=com', {
        scope: 'base',
        filter: '(objectClass=*)',
        attributes: ['dn']
      });
      console.log(`   ✅ Search test successful (found ${searchEntries.length} entries)`);
      return true;
    } catch (searchError) {
      console.log(`   ⚠️  Authentication successful but search failed: ${searchError.message}`);
      return true; // Authentication worked, search might need different base DN
    }
    
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    
    // Provide specific error guidance
    if (error.message.includes('52e')) {
      console.log(`   💡 Error 52e = Invalid credentials. Check username/password.`);
    } else if (error.message.includes('ENOTFOUND')) {
      console.log(`   💡 DNS error. Check if server name is correct and reachable.`);
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log(`   💡 Connection refused. Check if LDAP service is running on port 389.`);
    } else if (error.message.includes('timeout')) {
      console.log(`   💡 Timeout. Check network connectivity and firewall settings.`);
    }
    
    return false;
  } finally {
    if (client) {
      try {
        await client.unbind();
      } catch (e) {
        // Ignore unbind errors
      }
    }
  }
}

async function discoverDomainController() {
  console.log(`\n🔍 Attempting to discover domain controller...`);
  
  const possibleDCs = [
    'dc01.stc.com',
    'dc1.stc.com',
    'dc.stc.com',
    'ad.stc.com',
    'ldap.stc.com',
    'server.stc.com'
  ];
  
  for (const dc of possibleDCs) {
    console.log(`   Testing: ${dc}`);
    try {
      const client = new Client({
        url: `ldap://${dc}:389`,
        timeout: 3000,
        connectTimeout: 3000
      });
      
      // Just try to connect, don't authenticate
      await client.bind('', ''); // Anonymous bind
      console.log(`   ✅ ${dc} is reachable!`);
      await client.unbind();
    } catch (error) {
      if (error.message.includes('ENOTFOUND')) {
        console.log(`   ❌ ${dc} - DNS resolution failed`);
      } else if (error.message.includes('ECONNREFUSED')) {
        console.log(`   ❌ ${dc} - Connection refused (server exists but LDAP not running)`);
      } else {
        console.log(`   ✅ ${dc} - Server responds (${error.message.substring(0, 50)}...)`);
      }
    }
  }
}

async function main() {
  console.log('🔧 LDAP Connection Troubleshooting Tool');
  console.log('=====================================');
  
  if (!process.env.LDAP_BIND_PASSWORD) {
    console.log('❌ LDAP_BIND_PASSWORD not set in .env file');
    return;
  }
  
  // First, try to discover reachable domain controllers
  await discoverDomainController();
  
  console.log('\n🔧 Testing different LDAP configurations...');
  
  let successCount = 0;
  for (const config of configs) {
    const success = await testLDAPConfig(config);
    if (success) successCount++;
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Successful configurations: ${successCount}/${configs.length}`);
  
  if (successCount === 0) {
    console.log('\n💡 Troubleshooting suggestions:');
    console.log('1. Verify the service account exists and password is correct');
    console.log('2. Check if the account is in the correct OU');
    console.log('3. Ensure the account has "Log on as a service" rights');
    console.log('4. Try connecting from the server where this app runs');
    console.log('5. Check Windows Event Logs on the domain controller');
    console.log('6. Verify network connectivity and firewall rules');
    console.log('\n🔍 You can also try these PowerShell commands on a domain-joined machine:');
    console.log('   Get-ADUser -Identity moodlebind');
    console.log('   Test-NetConnection dc01.stc.com -Port 389');
  } else {
    console.log('\n✅ Update your .env file with the working configuration!');
  }
}

main().catch(console.error);
