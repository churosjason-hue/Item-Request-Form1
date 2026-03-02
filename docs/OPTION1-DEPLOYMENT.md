# Option 1: Single Port Deployment ✅

## Overview

**Option 1** means your backend serves **both** the API and frontend from **port 3001**. This is the simplest deployment option.

### How It Works:
- ✅ Backend runs on port 3001
- ✅ API endpoints: `http://YOUR_SERVER:3001/api/*`
- ✅ Frontend: `http://YOUR_SERVER:3001/*`
- ✅ One port to manage
- ✅ One firewall rule needed
- ✅ Frontend auto-detects backend URL

## Quick Setup (3 Steps)

### Step 1: Build Frontend
```bash
cd item-req-frontend
npm install
npm run build
```
This creates the `dist` folder with production files.

### Step 2: Configure Backend
Edit `item-req-backend/.env`:
```env
NODE_ENV=production  # Optional, but recommended
PORT=3001
HOST=0.0.0.0
# ... your database, LDAP, email configs
```

### Step 3: Start Server
```bash
cd item-req-backend
npm install  # If not done already
npm start
```

## Access Your Application

- **From server**: `http://localhost:3001`
- **From network**: `http://YOUR_SERVER_IP:3001`

The frontend will automatically connect to the backend at the same address!

## What Happens When Server Starts

You'll see:
```
✅ Server running on 0.0.0.0:3001

📍 Access URLs:
   Local:    http://localhost:3001
   Network:  http://172.16.33.27:3001

📦 Deployment Mode: Option 1 (Single Port)
   - API: http://localhost:3001/api/*
   - Frontend: http://localhost:3001/*

✅ Option 1 Enabled: Frontend served from backend on port 3001
```

## Windows Server 2016 Setup

### 1. Open Firewall Port
- Open "Windows Firewall with Advanced Security"
- Create Inbound Rule:
  - Port: **3001**
  - Protocol: **TCP**
  - Action: **Allow**
  - Apply to: **All profiles**

### 2. Run as Windows Service (Optional)
Use `pm2` or `node-windows` to run as a service that starts automatically.

### 3. Test Access
- From server: `http://localhost:3001`
- From another computer: `http://YOUR_SERVER_IP:3001`

## How Frontend Connects to Backend

The frontend automatically detects the backend URL:

```javascript
// If accessed via http://172.16.33.27:3001
// Frontend detects: hostname = "172.16.33.27"
// Backend API URL becomes: http://172.16.33.27:3001/api ✅

// If accessed via http://localhost:3001
// Frontend detects: hostname = "localhost"
// Backend API URL becomes: http://localhost:3001/api ✅
```

**No configuration needed!** It just works! 🎉

## Troubleshooting

### Frontend Not Loading?
1. Check if `dist` folder exists: `item-req-frontend/dist/`
2. Rebuild frontend: `cd item-req-frontend && npm run build`
3. Check server logs for: `✅ Option 1 Enabled: Frontend served from backend`

### Can't Access from Network?
1. Check Windows Firewall allows port 3001
2. Verify server listens on `0.0.0.0:3001` (check startup logs)
3. Test backend health: `http://YOUR_SERVER_IP:3001/health`

### API Calls Failing?
1. Open browser console (F12)
2. Look for: `🌐 Network access detected: Using backend at http://...`
3. Verify the URL matches your server IP

## Advantages of Option 1

✅ **Simple**: One port, one process  
✅ **Easy**: No reverse proxy needed  
✅ **Fast**: Direct connection  
✅ **Secure**: One firewall rule  
✅ **Auto-detection**: Frontend finds backend automatically  

## Production Checklist

- [ ] Build frontend: `cd item-req-frontend && npm run build`
- [ ] Verify `dist` folder exists
- [ ] Set `NODE_ENV=production` in backend `.env`
- [ ] Configure all `.env` variables (database, LDAP, etc.)
- [ ] Open Windows Firewall port 3001
- [ ] Start backend: `cd item-req-backend && npm start`
- [ ] Test: `http://localhost:3001`
- [ ] Test from network: `http://YOUR_SERVER_IP:3001`
- [ ] Verify frontend connects to backend (check browser console)

## That's It! 🎉

Option 1 is now configured and ready to deploy. Just build the frontend and start the backend!
