# MegaTronCrm Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

Make sure you have these installed:
- **Node.js** (v18+): https://nodejs.org/
- **Docker**: https://www.docker.com/get-started
- **Supabase CLI**: `npm install -g supabase`

---

## Installation (5 Steps)

### 1. Navigate to Project
```bash
cd /path/to/MegaTronCrm
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Supabase (Local Database)
```bash
supabase start
```

**Save the anon key** from the output!

### 4. Create .env File
```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_PUBLISHABLE_KEY=paste_your_anon_key_here
EOF
```

Replace `paste_your_anon_key_here` with the actual anon key from step 3.

### 5. Start Development Server
```bash
npm run dev
```

Open: **http://localhost:5173**

---

## Docker Permission Fix (Linux only)

If you get "permission denied" errors:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Then repeat step 3.

---

## Production Build

```bash
# Build
npm run build

# Deploy
cp -r dist/* /your/web/root/
```

Make sure `.htaccess` is configured for React routing (see INSTALLATION.md).

---

## Verification

✅ **Check Supabase is running:**
```bash
docker ps --filter "name=supabase"
```
Should show ~12 containers

✅ **Check database:**
```bash
docker exec supabase-db psql -U postgres -c "\dt"
```
Should show 15+ tables

✅ **Check app:**
Open http://localhost:5173 - should load without errors

---

## Common Issues

**"Cannot find module"**
```bash
rm -rf node_modules && npm install
```

**"Port in use"**
```bash
supabase stop
supabase start
```

**"Database tables missing"**
```bash
supabase db reset
```

**"Permission denied" (Docker)**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## Useful Commands

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Check status
supabase status

# Dev server
npm run dev

# Production build
npm run build

# Database GUI
# Open: http://localhost:3000
```

---

## Need More Help?

See the full **[INSTALLATION.md](INSTALLATION.md)** guide for:
- Detailed troubleshooting
- Production deployment
- Cloud Supabase setup
- Security best practices

---

*Ready to build? Start at step 1! 🚀*
