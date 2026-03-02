# How to Access from Other Devices

## Step 1: Find Your Server's IP Address

### On Windows Server 2016:

**Method 1: Using Command Prompt**
```cmd
ipconfig
```
Look for **IPv4 Address** under your active network adapter (usually Ethernet or Wi-Fi).

Example output:
```
Ethernet adapter Ethernet:
   IPv4 Address. . . . . . . . . . . : 172.16.33.27
```

**Method 2: Using PowerShell**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}
```

**Method 3: Check Server Startup Logs**
When you start your backend server, it will display network IPs:
```
📍 Access URLs:
   Local:    http://localhost:3001
   Network:  http://172.16.33.27:3001
```

## Step 2: Ensure Server is Running

Make sure your backend is running:
```bash
cd item-req-backend
npm start
```

You should see:
```
✅ Server running on 0.0.0.0:3001
✅ Option 1 Enabled: Frontend served from backend on port 3001
```

## Step 3: Configure Windows Firewall

### Open Port 3001:

1. **Open Windows Firewall**
   - Press `Win + R`
   - Type: `wf.msc`
   - Press Enter

2. **Create Inbound Rule**
   - Click "Inbound Rules" → "New Rule"
   - Select "Port" → Next
   - Select "TCP"
   - Enter port: **3001**
   - Select "Allow the connection"
   - Check all profiles (Domain, Private, Public)
   - Name it: "Item Request App - Port 3001"
   - Click Finish

### Quick PowerShell Method:
```powershell
New-NetFirewallRule -DisplayName "Item Request App" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

## Step 4: Access from Other Devices

### From Another Computer/Device:

1. **Make sure both devices are on the same network**
   - Same Wi-Fi network, OR
   - Same local network (LAN)

2. **Open a web browser** on the other device

3. **Enter the server IP address**:
   ```
   http://172.16.33.27:3001
   ```
   *(Replace 172.16.33.27 with YOUR server's IP)*

4. **The application should load!**

### Example URLs:
- **From server itself**: `http://localhost:3001`
- **From other device**: `http://172.16.33.27:3001`
- **If you have a domain**: `http://yourdomain.com:3001`

## Step 5: Verify Connection

### Check Backend Health:
From any device, visit:
```
http://YOUR_SERVER_IP:3001/health
```

You should see:
```json
{
  "status": "OK",
  "timestamp": "2024-...",
  "service": "IT Equipment Request API"
}
```

### Check Frontend:
Visit:
```
http://YOUR_SERVER_IP:3001
```

The login page should appear.

## Troubleshooting

### ❌ Can't Access from Other Device?

**1. Check Firewall**
```powershell
# Check if port 3001 is open
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*3001*"}
```

**2. Verify Server is Listening**
On the server, check:
```cmd
netstat -an | findstr 3001
```
Should show: `0.0.0.0:3001` or `[::]:3001`

**3. Check Network Connectivity**
From the other device, ping the server:
```cmd
ping 172.16.33.27
```
*(Replace with your server IP)*

**4. Verify Server Started Correctly**
Check server logs for:
- ✅ `Server running on 0.0.0.0:3001`
- ✅ `Option 1 Enabled: Frontend served from backend`
- ✅ Network IP addresses displayed

**5. Check Browser Console**
On the other device, open browser console (F12):
- Should see: `🌐 Network access detected: Using backend at http://172.16.33.27:3001/api`
- If you see errors, check the Network tab

### ❌ Frontend Can't Connect to Backend?

**Check Browser Console (F12):**
- Look for CORS errors
- Verify API URL is correct
- Check Network tab for failed requests

**Common Issues:**
1. **Wrong IP**: Frontend might be using wrong IP
   - Solution: Clear browser cache, hard refresh (Ctrl+F5)

2. **CORS Error**: Backend not allowing origin
   - Solution: Verify CORS is configured (already done ✅)

3. **Firewall Blocking**: Port 3001 blocked
   - Solution: Check Windows Firewall rules

### ❌ "Connection Refused" Error?

1. **Server not running**: Start the backend server
2. **Wrong IP**: Verify server IP address
3. **Port blocked**: Check firewall settings
4. **Different network**: Ensure devices are on same network

## Network Requirements

### Same Network:
- ✅ Same Wi-Fi network
- ✅ Same LAN/VLAN
- ✅ Same subnet

### Different Networks:
- ❌ Won't work without VPN or port forwarding
- ✅ Use VPN to connect devices
- ✅ Configure router port forwarding (not recommended for security)

## Security Considerations

⚠️ **Important for Production:**

1. **Use HTTPS**: Set up SSL certificate
2. **Restrict Access**: Use firewall rules to limit access
3. **Authentication**: Your app already has login ✅
4. **Network Security**: Consider VPN for remote access

## Quick Test Checklist

- [ ] Server IP address found: `_____________`
- [ ] Backend server running
- [ ] Windows Firewall port 3001 open
- [ ] Can access `http://SERVER_IP:3001/health` from server
- [ ] Can access `http://SERVER_IP:3001/health` from other device
- [ ] Can access `http://SERVER_IP:3001` from other device
- [ ] Frontend loads correctly
- [ ] Login works from other device

## Example: Complete Setup

**On Server:**
```bash
# 1. Find IP
ipconfig
# IPv4 Address: 172.16.33.27

# 2. Open firewall
New-NetFirewallRule -DisplayName "Item Request App" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow

# 3. Start server
cd item-req-backend
npm start
```

**On Other Device:**
1. Open browser
2. Go to: `http://172.16.33.27:3001`
3. Login and use the app!

## That's It! 🎉

Once the firewall is open and server is running, anyone on your network can access:
```
http://YOUR_SERVER_IP:3001
```

The frontend will automatically connect to the backend at the same address!
