# MegaTronCrm Installation Guide

Complete guide to install and run MegaTronCrm on your local computer or server.

## Table of Contents
- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Installation Steps](#installation-steps)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Verification Checklist](#verification-checklist)

---

## Prerequisites

Before installing, ensure you have the following installed:

### Required Software
1. **Node.js** (v18 or higher)
   - Check: `node --version`
   - Download: https://nodejs.org/

2. **npm** (usually comes with Node.js)
   - Check: `npm --version`

3. **Docker & Docker Compose**
   - Check: `docker --version` and `docker-compose --version`
   - Download: https://www.docker.com/get-started

4. **Supabase CLI**
   - Check: `supabase --version`
   - Install:
     ```bash
     # macOS/Linux
     brew install supabase/tap/supabase

     # Windows (using Scoop)
     scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
     scoop install supabase

     # npm (all platforms)
     npm install -g supabase
     ```

5. **Git** (optional, for cloning)
   - Check: `git --version`
   - Download: https://git-scm.com/

---

## System Requirements

### Minimum Requirements
- **RAM**: 4GB (8GB recommended)
- **Storage**: 2GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **Ports Available**: 3000, 5432, 8000, 8443

### Check Available Ports
```bash
# Linux/macOS
lsof -i :3000
lsof -i :5432
lsof -i :8000

# Windows (PowerShell)
netstat -ano | findstr :3000
netstat -ano | findstr :5432
netstat -ano | findstr :8000
```

If ports are in use, you'll need to stop those services or configure Supabase to use different ports.

---

## Installation Steps

### Step 1: Download/Clone the Application

**Option A: If you have the files**
```bash
cd /path/to/your/project
```

**Option B: If cloning from Git**
```bash
git clone <repository-url>
cd MegaTronCrm
```

### Step 2: Verify Project Structure

Your project should have these files/folders:
```
├── src/                    # React source code
├── supabase/              # Supabase configuration
│   ├── config.toml        # Supabase config
│   ├── migrations/        # Database migrations
│   └── functions/         # Edge functions
├── public/                # Public assets
├── package.json           # Node dependencies
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
└── .htaccess             # Apache config (for production)
```

### Step 3: Install Node Dependencies

```bash
npm install
```

**Check for errors**: If you see errors, try:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Step 4: Docker Permissions (Linux/macOS only)

**Check if your user is in the docker group:**
```bash
groups
```

**If 'docker' is not listed, add your user:**
```bash
# Linux
sudo usermod -aG docker $USER
newgrp docker

# macOS
# Usually not needed, Docker Desktop handles this
```

**Verify Docker access:**
```bash
docker ps
```
Should show container list (may be empty) without permission errors.

### Step 5: Start Supabase (Local PostgreSQL)

```bash
supabase start
```

**This will:**
- Download necessary Docker images (first time ~5-10 minutes)
- Start PostgreSQL database
- Start Supabase services (Auth, Storage, etc.)
- Run database migrations automatically

**Expected output:**
```
Started supabase local development setup.

         API URL: http://localhost:8000
          DB URL: postgresql://postgres:postgres@localhost:5432/postgres
      Studio URL: http://localhost:3000
    Inbucket URL: http://localhost:8025
        anon key: eyJhbGc...
service_role key: eyJhbGc...
```

**Save this output!** You'll need the anon key.

### Step 6: Create Environment File

Create a file named `.env` in the project root:

```bash
# Copy this template
cat > .env << 'EOF'
# Local Supabase Configuration
VITE_SUPABASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here

# Replace 'your_anon_key_here' with the anon key from Step 5
EOF
```

**Edit the file** and replace `your_anon_key_here` with the actual anon key from Step 5.

**Check your .env file:**
```bash
cat .env
```

Should show:
```
VITE_SUPABASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 7: Verify Database Setup

**Check running containers:**
```bash
docker ps --filter "name=supabase"
```

Should show ~12 containers, all with status "Up" or "healthy".

**Check database tables:**
```bash
docker exec supabase-db psql -U postgres -c "\dt"
```

Should show these tables:
- leads
- advertisers
- affiliates
- lead_distributions
- lead_queue
- user_roles
- user_permissions
- profiles
- And 7 more...

**If tables are missing**, run migrations:
```bash
supabase db reset
```

### Step 8: Start Development Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.4.21  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Open your browser** to: http://localhost:5173/

---

## Configuration

### For Production Deployment

#### Option 1: Apache Server (cPanel/Traditional Hosting)

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Copy built files to web root:**
   ```bash
   cp -r dist/* /path/to/public_html/
   ```

3. **Create/update .htaccess** in public_html:
   ```apache
   # React SPA routing configuration
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /

     # Don't rewrite files or directories
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d

     # Rewrite all other URLs to index.html
     RewriteRule ^ index.html [L]
   </IfModule>

   # Enable GZIP compression
   <IfModule mod_deflate.c>
     AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
   </IfModule>

   # Set proper MIME types
   <IfModule mod_mime.c>
     AddType application/javascript .js
     AddType text/css .css
   </IfModule>
   ```

4. **Ensure .env is NOT in public_html** (security risk!)

#### Option 2: Cloud Supabase (Instead of Local)

1. **Create Supabase account**: https://supabase.com/

2. **Create new project** and get credentials:
   - Go to Project Settings > API
   - Copy "Project URL" and "anon public" key

3. **Update .env:**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
   ```

4. **Run migrations** to cloud:
   ```bash
   # Link to your project
   supabase link --project-ref your-project-id

   # Push migrations
   supabase db push
   ```

---

## Troubleshooting

### Problem: "Cannot find module" errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problem: "Docker permission denied"

**Linux Solution:**
```bash
sudo usermod -aG docker $USER
newgrp docker
# OR logout and login again
```

**Windows/Mac:** Ensure Docker Desktop is running

### Problem: "Port already in use"

**Find what's using the port:**
```bash
# Linux/macOS
lsof -i :8000
lsof -i :5432

# Windows
netstat -ano | findstr :8000
```

**Stop Supabase and restart:**
```bash
supabase stop
supabase start
```

### Problem: "Supabase containers not healthy"

**Check logs:**
```bash
docker logs supabase-db
docker logs supabase-kong
docker logs supabase-auth
```

**Reset Supabase:**
```bash
supabase stop
supabase start
```

### Problem: Database tables missing

**Reset database and rerun migrations:**
```bash
supabase db reset
```

### Problem: "Failed to fetch" in browser console

**Check:**
1. Is Supabase running? `docker ps --filter "name=supabase"`
2. Is the URL correct in .env? Should be `http://127.0.0.1:8000`
3. Is the anon key correct in .env?

**Test API manually:**
```bash
curl http://127.0.0.1:8000/rest/v1/
```
Should return API version info.

### Problem: White screen in browser

**Check browser console** (F12) for errors

**Common causes:**
1. .env file missing or incorrect
2. Wrong Supabase URL
3. JavaScript bundle failed to load

**Solutions:**
```bash
# Rebuild
npm run build

# Check .env exists
cat .env

# Restart dev server
npm run dev
```

### Problem: Build warnings about chunk size

**This is normal** for development. To optimize:
```bash
# Use production build
npm run build
```

### Problem: ESM/Module resolution errors

**Update vite:**
```bash
npm install vite@latest
```

---

## Verification Checklist

Use this checklist to verify your installation:

### ✅ Prerequisites Installed
- [ ] Node.js installed (`node --version` shows v18+)
- [ ] npm installed (`npm --version`)
- [ ] Docker installed and running (`docker ps` works)
- [ ] Supabase CLI installed (`supabase --version`)

### ✅ Project Setup
- [ ] Project files downloaded/cloned
- [ ] Dependencies installed (`node_modules` folder exists)
- [ ] `.env` file created with correct values
- [ ] `.env` contains valid anon key

### ✅ Supabase Running
- [ ] `supabase start` completed successfully
- [ ] `docker ps --filter "name=supabase"` shows ~12 containers
- [ ] All containers show "Up" or "healthy" status
- [ ] Database has tables (`docker exec supabase-db psql -U postgres -c "\dt"`)

### ✅ Application Running
- [ ] Dev server starts (`npm run dev`)
- [ ] Browser opens to http://localhost:5173
- [ ] No errors in browser console (F12)
- [ ] Application loads (not white screen)

### ✅ Supabase Services Accessible
- [ ] Studio: http://localhost:3000 (Database GUI)
- [ ] API: http://localhost:8000 (responds to curl)
- [ ] Analytics: http://localhost:4000

### ✅ Production Build (If deploying)
- [ ] `npm run build` completes successfully
- [ ] `dist` folder created with files
- [ ] .htaccess configured (for Apache)
- [ ] Built files deployed to web server

---

## Quick Reference Commands

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Check Supabase status
supabase status

# Start development server
npm run dev

# Build for production
npm run build

# Reset database
supabase db reset

# Check running containers
docker ps

# View Supabase logs
docker logs supabase-db
docker logs supabase-kong

# Install dependencies
npm install

# Clean install
rm -rf node_modules package-lock.json && npm install
```

---

## Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev/
- **React Docs**: https://react.dev/
- **Docker Docs**: https://docs.docker.com/

---

## Support

If you encounter issues not covered in this guide:

1. Check browser console (F12) for errors
2. Check Docker logs: `docker logs supabase-db`
3. Check Supabase status: `supabase status`
4. Verify .env file is correct
5. Try clean install: `rm -rf node_modules && npm install`
6. Try Supabase reset: `supabase stop && supabase start`

---

## Security Notes

⚠️ **Important for Production:**

1. **Never commit `.env` to Git**
   - Add `.env` to `.gitignore`

2. **Never expose source files in production**
   - Only deploy `dist/` folder contents
   - Keep `src/`, `node_modules/`, etc. outside web root

3. **Use HTTPS in production**
   - Update VITE_SUPABASE_URL to use https://

4. **For cloud Supabase:**
   - Enable Row Level Security (RLS) on all tables
   - Configure proper authentication

5. **Secure your server:**
   - Keep Docker and Node.js updated
   - Use firewall rules
   - Limit database access

---

*Last updated: 2024-02-13*
