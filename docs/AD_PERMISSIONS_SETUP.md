# Active Directory Permissions Setup Guide

## Issue: Insufficient Access Rights Error

If you're seeing errors like:
```
❌ Error creating OU "Department Name": 00000005: SecErr: DSID-03152DB2, problem 4003 (INSUFF_ACCESS_RIGHTS), data 0
```

This means the LDAP service account doesn't have sufficient permissions to create/modify Organizational Units in Active Directory.

## Solution: Grant Required Permissions

### Option 1: Grant Permissions via Active Directory Users and Computers (Recommended)

1. Open **Active Directory Users and Computers** (dsa.msc)
2. Navigate to the container where you want to create OUs (usually your base DN, e.g., `DC=company,DC=com`)
3. Right-click on the container → **Properties**
4. Go to the **Security** tab
5. Click **Add** and add your LDAP service account (the account specified in `LDAP_BIND_DN`)
6. Select the service account and grant the following permissions:
   - ✅ **Create organizationalUnit objects**
   - ✅ **Delete organizationalUnit objects**
   - ✅ **Write** (includes modify permissions)
   - ✅ **Read** (if not already granted)
7. Click **Apply** and **OK**

### Option 2: Grant Permissions via PowerShell

Run PowerShell as Administrator and execute:

```powershell
# Replace these variables with your actual values
$ServiceAccountDN = "CN=YourServiceAccount,OU=ServiceAccounts,DC=company,DC=com"
$TargetOU = "DC=company,DC=com"  # The OU where you want to create departments

# Import Active Directory module
Import-Module ActiveDirectory

# Get the ACL for the target OU
$acl = Get-Acl "AD:\$TargetOU"

# Create access rule for creating OUs
$createRule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
    (New-Object System.Security.Principal.NTAccount($ServiceAccountDN)),
    [System.DirectoryServices.ActiveDirectoryRights]::CreateChild,
    [System.Security.AccessControl.AccessControlType]::Allow,
    [System.Guid]"bf967aa8-0de6-11d0-a285-00aa003049e2"  # organizationalUnit GUID
)

# Create access rule for deleting OUs
$deleteRule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
    (New-Object System.Security.Principal.NTAccount($ServiceAccountDN)),
    [System.DirectoryServices.ActiveDirectoryRights]::DeleteChild,
    [System.Security.AccessControl.AccessControlType]::Allow,
    [System.Guid]"bf967aa8-0de6-11d0-a285-00aa003049e2"  # organizationalUnit GUID
)

# Create access rule for writing/modifying
$writeRule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
    (New-Object System.Security.Principal.NTAccount($ServiceAccountDN)),
    [System.DirectoryServices.ActiveDirectoryRights]::WriteProperty,
    [System.Security.AccessControl.AccessControlType]::Allow
)

# Add the rules
$acl.AddAccessRule($createRule)
$acl.AddAccessRule($deleteRule)
$acl.AddAccessRule($writeRule)

# Apply the ACL
Set-Acl "AD:\$TargetOU" $acl
```

### Option 3: Use Delegation Wizard (Easiest)

1. Open **Active Directory Users and Computers**
2. Right-click on the container → **Delegate Control**
3. Click **Next** → **Add** your service account → **Next**
4. Select **Create a custom task to delegate** → **Next**
5. Select **Only the following objects in the folder** → Check **Organizational Unit objects** → **Next**
6. Under **Permissions**, check:
   - ✅ **Create selected objects in this folder**
   - ✅ **Delete selected objects in this folder**
   - ✅ **Read all properties**
   - ✅ **Write all properties**
7. Click **Next** → **Finish**

## Required Permissions Summary

The LDAP service account needs these permissions on the target container:

| Permission | Required For |
|-----------|--------------|
| Create organizationalUnit objects | Creating new departments |
| Delete organizationalUnit objects | Deleting departments |
| Write | Modifying OU properties (name, description) |
| Read | Reading OU information |

## Alternative: Disable AD Sync

If you cannot grant the necessary permissions, you can disable AD sync by setting this environment variable:

```env
ENABLE_AD_DEPARTMENT_SYNC=false
```

When disabled, departments will only be created/updated in the database, not in Active Directory.

## Testing Permissions

After granting permissions, test by:

1. Creating a test department through the web interface
2. Checking if the OU appears in Active Directory Users and Computers
3. Verifying no permission errors appear in the application logs

## Troubleshooting

- **Still getting errors?** Ensure the service account has permissions on the **parent container**, not just the OU itself
- **Can't find the service account?** Check `LDAP_BIND_DN` in your `.env` file
- **Permissions not taking effect?** Wait a few minutes for AD replication, or restart the application

## Security Note

Only grant these permissions to a dedicated service account, not a user account. The service account should have minimal permissions and be used only for LDAP operations.

