# Deployment Guide for Windows Server 2016

## ✅ Current Setup Status

**YES, your frontend and backend WILL be connected!** Here's how:

### How It Works:

1. **Development Mode (Current)**:
   - Frontend runs on Vite dev server (port 5173)
   - Backend runs on Express (port 3001)
   - Frontend auto-detects backend URL based on how it's accessed
   - ✅ **This works NOW** - users can access from network IPs

2. **Production Mode (For Deployment)**:
   - Frontend is built into static files (`npm run build`)
   - Backend serves both API and frontend from port 3001
   - Same auto-detection logic works in production build
   - ✅ **This will work** when deployed

## 🚀 Deployment Steps for Windows Server 2016

### Step 1: Build Frontend for Production

```bash
cd item-req-frontend
npm install
npm run build
```

This creates a `dist` folder with optimized production files.

### Step 2: Configure Environment Variables

**Backend `.env` file:**
```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
# ... your other config (database, LDAP, etc.)
```

**Frontend `.env` file (optional - auto-detection works):**
```env
# Leave empty for auto-detection, or set your server IP:
# VITE_API_URL=http://YOUR_SERVER_IP:3001/api
```

### Step 3: Start Backend Server

The backend will automatically:
- Serve API endpoints at `/api/*`
- Serve frontend static files at `/*` (if `dist` folder exists)
- Auto-detect network IPs and display them

```bash
cd item-req-backend
npm install
npm start
```

### Step 4: Configure Windows Firewall

1. Open Windows Firewall with Advanced Security
2. Create Inbound Rule:
   - Port: 3001
   - Protocol: TCP
   - Action: Allow
   - Apply to: All profiles

### Step 5: Access Your Application

- **From server**: `http://localhost:3001`
- **From network**: `http://YOUR_SERVER_IP:3001`

The frontend will automatically connect to the backend at the same IP address!

## 🔧 How Auto-Detection Works

### Frontend API Detection:
```javascript
// If accessed via http://172.16.33.27:3001
// Frontend detects: hostname = "172.16.33.27"
// Backend URL becomes: http://172.16.33.27:3001/api ✅

// If accessed via http://localhost:3001
// Frontend detects: hostname = "localhost"
// Backend URL becomes: http://localhost:3001/api ✅
```

### Backend CORS:
- Configured to allow ALL origins (`origin: true`)
- Works for any IP address accessing the frontend
- Properly handles preflight requests

## 📋 Production Checklist

- [ ] Build frontend: `cd item-req-frontend && npm run build`
- [ ] Set `NODE_ENV=production` in backend `.env`
- [ ] Verify `dist` folder exists in `item-req-frontend/`
- [ ] Start backend: `cd item-req-backend && npm start`
- [ ] Open firewall port 3001
- [ ] Test from server: `http://localhost:3001`
- [ ] Test from network: `http://YOUR_SERVER_IP:3001`
- [ ] Check browser console for API URL detection message

## 🎯 Two Deployment Options

### Option 1: Single Port (Recommended)
- Backend serves both API and frontend on port 3001
- ✅ Simpler setup
- ✅ One port to manage
- ✅ Already configured!

### Option 2: Separate Ports
- Frontend on port 5173 (or IIS on port 80)
- Backend on port 3001
- Requires reverse proxy (IIS) configuration
- More complex but allows HTTPS/SSL termination

## 🔍 Troubleshooting

**Frontend can't connect to backend:**
1. Check browser console - should show: `🌐 Network access detected: Using backend at http://...`
2. Verify backend is running: `http://YOUR_SERVER_IP:3001/health`
3. Check Windows Firewall allows port 3001
4. Verify CORS is enabled (already done)

**Backend not accessible from network:**
1. Verify server listens on `0.0.0.0:3001` (check startup logs)
2. Check Windows Firewall
3. Verify network connectivity

## ✅ Summary

**YES, it will work!** The setup is production-ready:

1. ✅ Frontend auto-detects backend URL
2. ✅ Backend serves frontend in production
3. ✅ CORS configured for all origins
4. ✅ Network IP detection working
5. ✅ Single port deployment ready

Just build the frontend and start the backend - it will work!
