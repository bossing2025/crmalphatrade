# MegaTronCrm Setup Checklist

Print this checklist and mark off each step as you complete the installation.

---

## Pre-Installation Checks

### Software Requirements
- [ ] Node.js v18 or higher installed
  - Command: `node --version`
  - Expected: `v18.x.x` or higher

- [ ] npm installed
  - Command: `npm --version`
  - Expected: `8.x.x` or higher

- [ ] Docker installed and running
  - Command: `docker --version`
  - Expected: `Docker version 20.x.x` or higher

- [ ] Docker daemon is running
  - Command: `docker ps`
  - Expected: No permission errors

- [ ] Supabase CLI installed
  - Command: `supabase --version`
  - Expected: Version number displayed

### System Checks
- [ ] At least 4GB RAM available
- [ ] At least 2GB disk space free
- [ ] Ports 3000, 5432, 8000, 8443 are available
  - Check: `lsof -i :3000` (should be empty)
  - Check: `lsof -i :5432` (should be empty)
  - Check: `lsof -i :8000` (should be empty)

### Linux/Server Specific
- [ ] User is in docker group
  - Check: `groups | grep docker`
  - If not: `sudo usermod -aG docker $USER && newgrp docker`

---

## Installation Steps

### 1. Project Setup
- [ ] Project files downloaded/extracted
- [ ] Navigated to project directory
  - Command: `cd /path/to/MegaTronCrm`

### 2. Dependencies
- [ ] Node modules installed
  - Command: `npm install`
  - Expected: No errors, "added XXX packages"

- [ ] Verify node_modules folder exists
  - Check: `ls -d node_modules`

### 3. Supabase Setup
- [ ] Start Supabase
  - Command: `supabase start`
  - Expected: "Started supabase local development setup"

- [ ] Copy anon key from output
  - Anon key: `________________________`
  - (Write it down!)

- [ ] Verify containers are running
  - Command: `docker ps --filter "name=supabase"`
  - Expected: ~12 containers with "Up" status

- [ ] Check containers are healthy
  - Look for "(healthy)" status in docker ps output
  - Note: "realtime" may show "unhealthy" - this is usually OK

### 4. Environment Configuration
- [ ] Create .env file
  - Command: `touch .env`

- [ ] Add Supabase URL to .env
  ```
  VITE_SUPABASE_URL=http://127.0.0.1:8000
  ```

- [ ] Add anon key to .env
  ```
  VITE_SUPABASE_PUBLISHABLE_KEY=<paste_anon_key_here>
  ```

- [ ] Verify .env file contents
  - Command: `cat .env`
  - Should show both variables with values

### 5. Database Verification
- [ ] Check database is accessible
  - Command: `docker exec supabase-db psql -U postgres -c "\dt"`
  - Expected: List of 15+ tables

- [ ] Verify key tables exist:
  - [ ] leads
  - [ ] advertisers
  - [ ] affiliates
  - [ ] user_roles
  - [ ] profiles

- [ ] If tables missing, reset database
  - Command: `supabase db reset`

### 6. Application Start
- [ ] Start development server
  - Command: `npm run dev`
  - Expected: "Local: http://localhost:5173/"

- [ ] Open browser to http://localhost:5173
  - [ ] Page loads (not white screen)
  - [ ] No errors in browser console (F12)
  - [ ] Application interface visible

---

## Verification Tests

### Supabase Services
- [ ] Studio accessible at http://localhost:3000
  - Should show Supabase Studio interface

- [ ] API responds
  - Command: `curl http://127.0.0.1:8000/rest/v1/`
  - Expected: JSON response

- [ ] Database accessible
  - Connect via Studio and view tables

### Application Tests
- [ ] Home page loads
- [ ] Can navigate between pages
- [ ] No console errors (check F12)
- [ ] No network errors (check F12 Network tab)

---

## Production Build (If Deploying)

### Build Process
- [ ] Create production build
  - Command: `npm run build`
  - Expected: "✓ built in X.XXs"

- [ ] Verify dist folder created
  - Check: `ls -la dist/`
  - Should contain: index.html, assets/, favicon.ico

- [ ] Check build files
  - [ ] dist/index.html exists
  - [ ] dist/assets/ contains JS and CSS files

### Deployment (Apache/cPanel)
- [ ] Create/verify .htaccess in web root
  - Should include React SPA routing rules

- [ ] Copy built files to web root
  - Command: `cp -r dist/* /path/to/public_html/`

- [ ] Verify files copied
  - Check web root has: index.html, assets/, favicon.ico

- [ ] **Security**: Ensure .env is NOT in web root
  - Check: `.env` should NOT be in public_html

- [ ] Test in browser
  - Visit your domain
  - Application loads correctly

---

## Troubleshooting Reference

If you encounter issues, check:

### Container Issues
- [ ] All containers running: `docker ps`
- [ ] Check logs: `docker logs supabase-db`
- [ ] Restart: `supabase stop && supabase start`

### Build Issues
- [ ] Clean install: `rm -rf node_modules && npm install`
- [ ] Clear cache: `rm -rf dist .vite`
- [ ] Check Node version: `node --version`

### Permission Issues
- [ ] Docker group: `groups | grep docker`
- [ ] File permissions: `ls -la .env`
- [ ] Owner: `whoami`

### Database Issues
- [ ] Reset: `supabase db reset`
- [ ] Check connection: `docker exec supabase-db psql -U postgres -c "SELECT 1"`
- [ ] View logs: `docker logs supabase-db`

---

## Post-Installation Notes

### Important Files
- `.env` - Contains Supabase credentials (DO NOT commit to Git!)
- `.htaccess` - Apache routing config (production only)
- `supabase/config.toml` - Supabase project config
- `supabase/migrations/` - Database schema

### Useful Commands

**Supabase:**
```bash
supabase start       # Start all services
supabase stop        # Stop all services
supabase status      # Show service URLs and keys
supabase db reset    # Reset database
```

**Development:**
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

**Docker:**
```bash
docker ps            # List running containers
docker logs <name>   # View container logs
docker restart <name> # Restart container
```

### Next Steps
- [ ] Review the application features
- [ ] Set up user accounts
- [ ] Configure email settings (if applicable)
- [ ] Review security settings
- [ ] Set up backups (production)

---

## Sign Off

Installation completed by: `_________________`

Date: `_________________`

Server/Environment: `_________________`

Notes:
```
_________________________________________________
_________________________________________________
_________________________________________________
```

---

**Need help?** See [INSTALLATION.md](INSTALLATION.md) for detailed troubleshooting.
