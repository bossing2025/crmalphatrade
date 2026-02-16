# MegaTronCrm - Lead Management System

A comprehensive CRM application for managing leads, advertisers, and affiliates.

## 🚀 Quick Start

**New to this project?** Choose your guide:

- **[QUICKSTART.md](QUICKSTART.md)** - Get running in 5 minutes
- **[INSTALLATION.md](INSTALLATION.md)** - Complete installation guide with troubleshooting

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- **Frontend**: React, TypeScript, Vite
- **UI Framework**: shadcn-ui, Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **State Management**: TanStack Query
- **Forms**: React Hook Form + Zod
- **Routing**: React Router DOM

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Local Development with Supabase

This application uses Supabase (PostgreSQL) for the database and backend services.

### Prerequisites
- Node.js v18+
- Docker & Docker Compose
- Supabase CLI

### Quick Setup
```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase (PostgreSQL)
supabase start

# 3. Create .env file
cat > .env << 'EOF'
VITE_SUPABASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key_from_supabase_start>
EOF

# 4. Start dev server
npm run dev
```

**See [QUICKSTART.md](QUICKSTART.md) for detailed steps.**

## Database Features

The CRM includes:
- **Leads Management**: Track and manage leads through the pipeline
- **Advertiser Management**: Manage advertiser relationships and distributions
- **Affiliate System**: Track affiliate performance and rules
- **User Roles**: Super admin, manager, agent, and affiliate roles
- **Lead Distribution**: Automated lead distribution with round-robin
- **Email Tracking**: Monitor email rejections and conversions
- **Queue System**: Process leads through a managed queue

## Available Scripts

```bash
# Development
npm run dev          # Start dev server (http://localhost:5173)

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # Lint code
```

## Supabase Services

When running locally, you have access to:

- **API**: http://localhost:8000
- **Studio** (Database GUI): http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Analytics**: http://localhost:4000

## Deployment

### Option 1: Apache/cPanel Server
See [INSTALLATION.md](INSTALLATION.md) for complete Apache deployment guide.

### Option 2: Cloud Supabase
1. Create project at https://supabase.com
2. Update .env with cloud credentials
3. Push migrations: `supabase db push`
4. Deploy frontend to your hosting

## Troubleshooting

Common issues and solutions:

- **"Cannot find module"**: `rm -rf node_modules && npm install`
- **"Docker permission denied"**: `sudo usermod -aG docker $USER && newgrp docker`
- **"Port in use"**: `supabase stop && supabase start`
- **Missing tables**: `supabase db reset`

**See [INSTALLATION.md](INSTALLATION.md) for comprehensive troubleshooting.**

## Documentation

- [QUICKSTART.md](QUICKSTART.md) - Get started in 5 minutes
- [INSTALLATION.md](INSTALLATION.md) - Complete installation guide
- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev/)
- [React Docs](https://react.dev/)
