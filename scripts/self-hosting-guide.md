# MegaTronCRM Self-Hosting Guide

Complete guide to run this CRM on your dedicated server.

## Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: Minimum 4GB (8GB recommended)
- **CPU**: 2+ cores
- **Disk**: 20GB+ free space
- **Docker**: Docker & Docker Compose installed

---

## Step 1: Install Docker (if not installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group
sudo usermod -aG docker $USER

# Logout and login again, or run:
newgrp docker
```

---

## Step 2: Set Up Supabase

```bash
# Create directory
mkdir -p ~/supabase && cd ~/supabase

# Clone Supabase Docker setup
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy environment file
cp .env.example .env
```

### Edit the .env file with your secrets:

```bash
nano .env
```

**Change these values** (generate random secrets):

```env
# Generate these with: openssl rand -base64 32
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
JWT_SECRET=YOUR_JWT_SECRET_32_CHARS_MIN
ANON_KEY=YOUR_ANON_KEY
SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Your server's domain or IP
SITE_URL=https://crm.yourdomain.com
API_EXTERNAL_URL=https://api.yourdomain.com

# Dashboard credentials
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=YOUR_DASHBOARD_PASSWORD
```

### Generate JWT Keys (required):

```bash
# Install jwt-cli or use online generator
# Go to: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

# Or use this node script:
node -e "
const crypto = require('crypto');
const jwt_secret = crypto.randomBytes(32).toString('base64');
console.log('JWT_SECRET=' + jwt_secret);
console.log('');
console.log('Generate ANON_KEY and SERVICE_ROLE_KEY at:');
console.log('https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys');
"
```

### Start Supabase:

```bash
docker compose up -d
```

**Supabase will be available at:**
- Studio Dashboard: `http://YOUR_SERVER_IP:8000`
- API: `http://YOUR_SERVER_IP:8000`

---

## Step 3: Run Database Migrations

From your project folder (after cloning from GitHub):

```bash
# Install Supabase CLI
npm install -g supabase

# Push migrations to your self-hosted Supabase
supabase db push --db-url postgresql://postgres:YOUR_POSTGRES_PASSWORD@YOUR_SERVER_IP:5432/postgres
```

---

## Step 4: Import Your Data

```bash
# Connect to your database and run the export script
psql postgresql://postgres:YOUR_POSTGRES_PASSWORD@YOUR_SERVER_IP:5432/postgres -f scripts/database-export.sql
```

---

## Step 5: Create Auth User

In Supabase Studio (`http://YOUR_SERVER_IP:8000`):

1. Go to **Authentication → Users**
2. Click **Add User**
3. Email: `0360804@gmail.com`
4. Password: (set your new password)
5. Click **Create User**

Or run this SQL:

```sql
-- Run in SQL Editor
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role
) VALUES (
  '40fbdec4-99fa-45cb-bace-8274a47fb934',
  '00000000-0000-0000-0000-000000000000',
  '0360804@gmail.com',
  crypt('YOUR_NEW_PASSWORD', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
);
```

---

## Step 6: Deploy the Frontend App

### Option A: Using Docker

Create `Dockerfile` in project root:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Build and run:

```bash
# Clone your repo from GitHub
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Create .env.production with your self-hosted URLs
cat > .env.production << EOF
VITE_SUPABASE_URL=http://YOUR_SERVER_IP:8000
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
EOF

# Build and run
docker build -t megatroncrm .
docker run -d -p 3000:80 --name crm-app megatroncrm
```

### Option B: Using PM2 (Node.js)

```bash
# Install dependencies
npm install

# Build
npm run build

# Install serve
npm install -g serve

# Run with PM2
npm install -g pm2
pm2 start "serve -s dist -l 3000" --name crm-app
pm2 save
pm2 startup
```

---

## Step 7: Set Up SSL with Nginx (Production)

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/megatroncrm
```

```nginx
server {
    listen 80;
    server_name crm.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/megatroncrm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificates
sudo certbot --nginx -d crm.yourdomain.com -d api.yourdomain.com
```

---

## Quick Summary

| Component | Port | URL |
|-----------|------|-----|
| Supabase Studio | 8000 | http://YOUR_IP:8000 |
| Supabase API | 8000 | http://YOUR_IP:8000 |
| PostgreSQL | 5432 | postgresql://postgres:PASS@YOUR_IP:5432/postgres |
| Your CRM App | 3000 | http://YOUR_IP:3000 |

---

## Troubleshooting

### Check if Supabase is running:
```bash
cd ~/supabase/supabase/docker
docker compose ps
docker compose logs -f
```

### Restart Supabase:
```bash
docker compose down
docker compose up -d
```

### Check app logs:
```bash
docker logs crm-app
# or
pm2 logs crm-app
```
