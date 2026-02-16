# MegaTronCRM - Application Walkthrough

## What Is This App?

This is **MegaTronCRM** - a Lead Management System. It manages leads (potential customers), distributes them to advertisers, tracks affiliates, and monitors conversions. Think of it as a middleman system between affiliates (who bring leads) and advertisers (who buy leads).

---

## 1. Where Does It All Start? (The Boot Chain)

The app starts like a chain of dominoes:

```
index.html  →  main.tsx  →  App.tsx  →  Your Pages
```

### Step 1: `index.html`

This is just a bare HTML file with a single `<div id="root">`. The browser loads this first. At the bottom, it loads your JavaScript bundle.

### Step 2: `src/main.tsx`

This is the **true entry point** of your React app. It does one thing:

```tsx
createRoot(document.getElementById("root")!).render(<App />);
```

It grabs that `<div id="root">` from index.html and tells React: "render the `<App />` component inside it."

### Step 3: `src/App.tsx`

This is the **brain** of the app. It sets up everything your app needs by wrapping your pages in "providers" (think of them as layers that give powers to all components inside them):

```
ThemeProvider          ← dark/light mode
  QueryClientProvider  ← data fetching/caching (React Query)
    TooltipProvider    ← tooltip UI
      BrowserRouter    ← URL routing
        AuthProvider   ← login/user state
          SidebarStateProvider  ← sidebar open/closed
            Routes     ← which page to show based on URL
```

**Why providers?** React uses a pattern called "Context." A provider wraps your app and makes data available to any component inside it without passing it through every level (no "prop drilling"). For example, `AuthProvider` means ANY component can check if the user is logged in.

---

## 2. How Does Routing Work?

When you visit `/dashboard`, React Router (the `BrowserRouter` in App.tsx) matches the URL to a component:

| URL | Page Component |
|-----|---------------|
| `/` | Redirects to `/dashboard` |
| `/login` | Login page |
| `/dashboard` | Main dashboard |
| `/leads` | Lead management |
| `/advertisers` | Advertiser management |
| `/affiliates` | Affiliate management |
| `/injections` | Injection dashboard |
| `/distributions` | Lead distribution tracking |
| `/distribution-settings` | Configure distribution rules |
| `/reports` | Reports & analytics |
| `/conversions` | Conversion tracking |
| `/country-performance` | Geographic performance |
| `/monitoring` | System monitoring |
| `/users` | User management (admin) |
| `/lead-pools` | Lead pool management |
| `/lead-pools/:id` | Individual pool details |
| `/injections/jobs` | Injection jobs list |
| `/injections/leads` | Leads from injections |
| `/injections/failed` | Failed injection leads |
| `/injections/send-history` | Send history logs |
| `/injections/:id` | Individual injection details |
| `/audit-logs` | Activity/audit logs |
| `/settings` | Application settings |
| `/api-docs` | API documentation |
| `/rejected-leads` | View rejected leads |
| `/affiliate-rejected` | Affiliate-specific rejections |
| `/test-logs` | Test lead submission logs |
| `/advertiser-performance` | Advertiser metrics & reports |
| `/affiliate-performance` | Affiliate metrics & reports |
| `*` | 404 Not Found page |

Every page except Login/Register is wrapped in `DashboardLayout` (`src/components/layout/DashboardLayout.tsx`), which:

- Checks if you're logged in (redirects to `/login` if not)
- Shows the sidebar navigation
- Renders the page content

---

## 3. How Does Supabase Work? (Your Backend)

This is the big one. **You don't have a traditional backend** (no Express, no Django, no separate server). Instead, you use **Supabase**, which is a cloud service that gives you:

- **A PostgreSQL database** (cloud-hosted, not local)
- **Authentication** (login/signup)
- **Edge Functions** (serverless backend code)
- **Realtime subscriptions** (live updates)

### Where Is Your Database?

**It's in the cloud**, hosted at `https://api.alphatradecrm.com` (a custom domain pointing to your Supabase project). It is NOT a local database.

The connection is set up in `src/integrations/supabase/client.ts`:

```typescript
const SUPABASE_URL = "https://api.alphatradecrm.com";
const SUPABASE_KEY = "eyJhbGci..."; // public anon key (safe to expose)

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

This `supabase` object is what your entire app uses to talk to the database.

### What Language Is the Backend?

- **Database**: PostgreSQL (SQL)
- **Edge Functions**: TypeScript running on **Deno** (similar to Node.js)
- **Frontend**: TypeScript/React

So everything is TypeScript/JavaScript except the database itself which is SQL.

### Is the Backend Logic Here?

**Yes, partially.** You have 17 Edge Functions in the `supabase/functions/` folder. These are serverless functions that run on Supabase's servers. Key ones:

| Function | What It Does |
|----------|-------------|
| `submit-lead` | Validates and submits new leads |
| `distribute-lead` | Routes leads to the right advertiser |
| `advertiser-callback` | Receives status updates from advertisers |
| `send-injection` | Sends injected/simulated leads |
| `create-user` | Admin user creation |
| `db-proxy` | Generic DB query proxy with auth checks |
| `submit-lead-v2` | V2 lead submission |
| `lead-status` | Updates lead status |
| `poll-lead-status` | Polls advertiser for lead status |
| `get-leads` | Fetch leads (for affiliates) |
| `validate-injection` | Validates injection configuration |
| `filter-pool-leads` | Filters leads from pools |
| `process-lead-queue` | Processes queued leads |
| `parse-document` | Parses document/API specs |
| `impersonate-user` | Allows super_admin to impersonate users |

However, a lot of the "backend logic" is also directly in your **React hooks** - they query Supabase directly from the browser. This is fine because Supabase has Row Level Security (RLS) that protects your data at the database level.

---

## 4. How Does Data Flow? (The Most Important Part)

Here's the pattern used throughout your app. Let's trace what happens when you view the Leads page:

```
1. You visit /leads
2. <Leads /> page component mounts
3. It calls useLeads() hook
4. useLeads() uses React Query's useQuery() which calls:
     supabase.from('leads').select('*').order('created_at')
5. Supabase sends the SQL query to your cloud PostgreSQL database
6. Data comes back → React Query caches it
7. Component renders the leads table

When you edit a lead:
8. Component calls useUpdateLead() mutation
9. Mutation sends UPDATE to Supabase
10. On success → React Query invalidates the cache
11. Cache invalidation triggers a re-fetch
12. Table re-renders with updated data
```

**Where to find this pattern**: Look at the `src/hooks/` folder. Each hook file follows this exact pattern. For example:

- `src/hooks/useLeads.ts` - lead CRUD operations
- `src/hooks/useAdvertisers.ts` - advertiser operations
- `src/hooks/useAffiliates.ts` - affiliate operations

### React Query Explained

React Query (TanStack Query) is the library that manages ALL data fetching. Key concepts:

- **`useQuery()`** - Fetches data and caches it. Automatically handles loading states, errors, and background refetching.
- **`useMutation()`** - For create/update/delete operations. On success, it "invalidates" the cache which triggers a re-fetch.
- **`queryClient.invalidateQueries()`** - Tells React Query: "this data is stale, fetch it again."

### Realtime Updates

The app also uses Supabase Realtime subscriptions. For example, in `useLeads.ts`:

```typescript
supabase
  .channel('leads-realtime')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'leads' },
    () => queryClient.invalidateQueries({ queryKey: ['leads'] })
  )
  .subscribe()
```

This listens for ANY change to the `leads` table in the database and automatically refreshes the UI. So if another user adds a lead, your screen updates automatically.

---

## 5. How Does Authentication Work?

The auth flow lives in `src/hooks/useAuth.tsx`:

1. User enters email/password (or username/password) on Login page
2. `signIn()` calls `supabase.auth.signInWithPassword()`
3. Supabase verifies credentials and returns a **session** (JWT token)
4. The token is stored in **localStorage** (browser)
5. `AuthProvider` fetches the user's **roles** from the `user_roles` table
6. Every subsequent Supabase request automatically includes this token
7. Supabase uses the token to enforce **Row Level Security** (only show data the user is allowed to see)

### Roles

There are 4 roles: `super_admin`, `manager`, `agent`, `affiliate` - these control what pages/features you can access.

### Permissions

There are 6 granular permissions: `view_phone`, `view_email`, `export_leads`, `delete_leads`, `edit_leads`, `view_all_leads`. These are managed in the `user_permissions` table and checked via the `useUserPermissions` hook.

---

## 6. Database Schema Overview

The app has 45+ database tables. Here are the key ones grouped by domain:

### Authentication & Users
- `profiles` - User profiles (username, full_name, avatar_url)
- `user_roles` - User role assignments
- `user_permissions` - Fine-grained permissions
- `login_attempts` - Login tracking & security

### Leads & Distributions
- `leads` - Main lead table with status tracking
- `lead_distributions` - Lead-to-advertiser mappings
- `lead_queue` - Lead processing queue
- `lead_status_history` - Audit trail of status changes
- `lead_pools` - Lead pools/batches
- `lead_pool_leads` - Leads within pools

### Injections
- `injections` - Injection jobs
- `injection_leads` - Leads being injected
- `injection_pools` - Injection pool configurations
- `injection_pool_leads` - Leads in injection pools

### Advertisers
- `advertisers` - Advertiser master data (name, URL, caps, API keys)
- `advertiser_conversions` - Conversion tracking
- `advertiser_distribution_settings` - Distribution rules per advertiser
- `advertiser_integration_configs` - API/CRM integration settings

### Affiliates
- `affiliates` - Affiliate master data (name, API key, callback_url)
- `affiliate_distribution_rules` - Affiliate-specific distribution rules
- `affiliate_submission_failures` - Failed submissions

### System & Monitoring
- `callback_logs` - Incoming callbacks from advertisers
- `audit_logs` - System activity logs
- `test_lead_logs` - Test lead submissions

### Key Enums
- `app_role`: super_admin, manager, agent, affiliate
- `lead_status`: new, contacted, qualified, converted, lost, rejected
- `distribution_status`: pending, sent, failed
- `injection_lead_status`: pending, scheduled, sending, sent, failed, skipped

---

## 7. File Organization Summary

```
src/
├── pages/              ← One file per page (what you see on screen) - 32 pages
├── components/         ← Reusable UI pieces organized by feature
│   ├── ui/             ← Base design components (buttons, inputs, etc.) - Shadcn/ui
│   ├── leads/          ← Lead-specific components
│   ├── advertisers/    ← Advertiser-specific components
│   ├── affiliates/     ← Affiliate-specific components
│   ├── injection/      ← Injection-specific components
│   ├── distribution/   ← Distribution-specific components
│   ├── pools/          ← Lead pool components
│   ├── monitoring/     ← Monitoring components
│   ├── dashboard/      ← Dashboard components
│   ├── filters/        ← Filter components
│   ├── users/          ← User management components
│   ├── layout/         ← Sidebar, dashboard wrapper
│   └── auth/           ← Login/register forms
├── hooks/              ← Data logic (database queries, auth, settings) - 24 hooks
├── integrations/
│   └── supabase/
│       ├── client.ts   ← Database connection
│       └── types.ts    ← Auto-generated TypeScript types from DB schema
├── lib/                ← Small utility functions
├── App.tsx             ← Router + providers
└── main.tsx            ← Entry point

supabase/
└── functions/          ← 17 Edge Functions (serverless backend code)
    ├── submit-lead/
    ├── distribute-lead/
    ├── advertiser-callback/
    └── ...
```

---

## 8. Key Technologies to Study

Since you know React basics, here's what to focus on learning:

### Priority 1: React Query (TanStack Query)
This is how ALL data fetching works. Learn `useQuery` and `useMutation`. Every hook in `src/hooks/` uses it.

### Priority 2: Supabase Client
Learn `supabase.from('table').select()`, `.insert()`, `.update()`, `.delete()`. That's 90% of what's used here.

### Priority 3: React Router v6
The `<Routes>`, `<Route>`, `useNavigate()`, `useParams()` patterns in App.tsx.

### Priority 4: React Context
Used for auth (`useAuth`) and sidebar state. You already know this from basics.

### Priority 5: TypeScript
The entire codebase is TypeScript. Focus on understanding interfaces and type annotations.

---

## 9. Key Dependencies

| Package | Purpose |
|---------|---------|
| `react@18.3` | UI framework |
| `react-router-dom@6.30` | Client-side routing |
| `@tanstack/react-query@5.83` | Server state management (data fetching) |
| `@supabase/supabase-js@2.93` | Supabase client (database, auth) |
| `tailwindcss@3.4` | Utility CSS framework |
| `@radix-ui/*` | Headless UI components (used by Shadcn/ui) |
| `lucide-react` | Icon library |
| `recharts` | Charting library (dashboard graphs) |
| `react-hook-form` | Form state management |
| `zod` | Schema validation |
| `date-fns` / `date-fns-tz` | Date utilities with timezone support |
| `vite` | Build tool (replaces webpack) |
| `typescript` | Type safety |

---

## 10. NPM Scripts

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start development server (port 8080) |
| `npm run build` | Production build |
| `npm run build:dev` | Development mode build |
| `npm run lint` | Run ESLint checks |
| `npm run preview` | Preview the built app |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

---

## 11. Summary: How Everything Connects

```
Browser loads index.html
    ↓
main.tsx renders <App />
    ↓
App.tsx sets up Providers (Theme, React Query, Auth, Router)
    ↓
React Router matches URL → renders Page component
    ↓
Page component uses custom hooks (useLeads, useAdvertisers, etc.)
    ↓
Hooks use React Query + Supabase client to fetch/mutate data
    ↓
Supabase client sends requests to cloud PostgreSQL database
    ↓
Data comes back → React Query caches → Component re-renders
    ↓
For complex operations, Edge Functions handle server-side logic
    ↓
Realtime subscriptions keep the UI in sync across users
```
