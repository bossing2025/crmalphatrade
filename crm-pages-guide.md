# MegaTronCRM - Page-by-Page User Guide

This guide explains every page in the CRM system: what it's for, what you can do on it, and who can access it.

---

## Table of Contents

1. [Login & Registration](#1-login--registration)
2. [Dashboard](#2-dashboard)
3. [Leads](#3-leads)
4. [Advertisers](#4-advertisers)
5. [Affiliates](#5-affiliates)
6. [Distributions](#6-distributions)
7. [Distribution Settings](#7-distribution-settings)
8. [Rejected Leads](#8-rejected-leads)
9. [Conversions](#9-conversions)
10. [Reports](#10-reports)
11. [Country Performance](#11-country-performance)
12. [Advertiser Performance](#12-advertiser-performance)
13. [Affiliate Performance](#13-affiliate-performance)
14. [Lead Pools](#14-lead-pools)
15. [Lead Pool Detail](#15-lead-pool-detail)
16. [Injection Dashboard](#16-injection-dashboard)
17. [Injection Jobs](#17-injection-jobs)
18. [Injection Detail](#18-injection-detail)
19. [Injection Leads](#19-injection-leads)
20. [Injection Failed Leads](#20-injection-failed-leads)
21. [Send History](#21-send-history)
22. [Test Lead Logs](#22-test-lead-logs)
23. [Monitoring](#23-monitoring)
24. [Audit Logs](#24-audit-logs)
25. [Users](#25-users)
26. [Settings](#26-settings)
27. [API Docs](#27-api-docs)

---

## Role Reference

Before reading, know the 4 user roles:

| Role | Who | Access Level |
|------|-----|-------------|
| **Super Admin** | System owner | Everything, including user management and impersonation |
| **Manager** | Team leads | Most pages except user management |
| **Agent** | Sales agents | Dashboard and basic lead viewing only |
| **Affiliate** | External partners | Limited to their own performance data |

---

## 1. Login & Registration

### Login Page (`/login`)

**What it's for:** This is where users sign in to access the CRM.

**How to use it:**
- Enter your **email** or **username** and **password**
- Click **Sign In**
- If successful, you'll be redirected to the Dashboard

**Good to know:**
- Login attempts are tracked for security (stored in `login_attempts` table)
- If you enter wrong credentials, you get a generic "Invalid login credentials" message (for security, it won't tell you if the email exists or not)

### Register Page (`/register`)

**What it's for:** Creating a new account.

**How to use it:**
- Enter email, password, and full name
- Click **Register**
- You may need email confirmation depending on system settings

---

## 2. Dashboard (`/dashboard`)

**What it's for:** Your home screen. Gives you a quick overview of how the system is performing right now.

**Access:** Manager+

**What you see:**
- **Stats Cards** at the top showing key numbers:
  - Total leads
  - Leads sent today
  - Conversion count
  - Success rate
- **Date Preset Filters** - quickly switch between Today, Last 7 Days, Last 30 Days, This Month
- **Leads Trend Chart** - a line chart showing leads over time
- **Top 5 Tables** - top performing countries, advertisers, and affiliates
- **Recent Distributions** - latest lead distributions with status
- **System Alerts** - warnings about cap limits being reached or distribution failures

**How to use it:**
- Click the date presets (Today, Last 7 Days, etc.) to change the time range for all stats
- Use this page as your morning check - see if anything needs attention
- If you see red alerts, investigate those first

---

## 3. Leads (`/leads`)

**What it's for:** The main lead management page. This is where you view, search, edit, and manage all leads in the system.

**Access:** All authenticated users (some actions restricted by permissions)

**What you see:**
- A large **table** with columns: Lead ID, Name, Email, Phone, Country, Status, Sale Status, FTD, Created Date
- **Filter Bar** at the top with:
  - Status filter (New, Contacted, Qualified, Converted, Lost)
  - Sale Status filter
  - Date range picker
  - Advertiser filter
  - Country filter
  - Affiliate filter
  - Lead ID search

**What you can do:**
- **Search** - filter leads by any combination of filters
- **Copy Email** - click the copy icon next to any email to copy it
- **Edit a Lead** - click the edit button to open an edit dialog (requires `edit_leads` permission)
- **Delete Leads** - select leads with checkboxes and bulk delete (requires `delete_leads` permission)
- **Export to CSV** - select leads and export them (requires `export_leads` permission)
- **Resend to Advertiser** - select leads and resend them to an advertiser
- **Customize Columns** - show/hide columns using the column visibility button
- **Change Page Size** - adjust how many leads show per page

**Good to know:**
- This page has **real-time updates** - if someone adds a lead while you're watching, it appears automatically
- Email and phone visibility depends on your permissions (`view_email`, `view_phone`)
- Column visibility preferences are saved in your browser (localStorage)

---

## 4. Advertisers (`/advertisers`)

**What it's for:** Manage the companies/platforms that receive your leads. Each advertiser is a CRM system that your leads get sent to.

**Access:** Manager+

**What you see:**
- A table of all advertisers with: Name, CRM Type, Status (Active/Inactive), Daily Cap, Monthly Cap, Total Cap

**Supported CRM Types:**
- TrackBox, DrMailer, Enigma, Timelocal, EliteCRM, GSI, ELNOPY, GetLinked, Custom, Mock

**What you can do:**
- **Add Advertiser** - create a new advertiser connection with:
  - Name, API URL, CRM type
  - API credentials (username/password or API key, depending on CRM type)
  - Daily/monthly/total caps (limits on how many leads they receive)
  - Country restrictions
- **Edit Advertiser** - modify any settings (the form changes based on CRM type)
- **Toggle Status** - turn an advertiser on/off
- **Test Lead** - send a test lead to verify the integration works before going live
- **Bulk Actions** - update caps or status for multiple advertisers at once

**Why it matters:** This is where the actual integrations are configured. If a lead isn't being sent correctly, check the advertiser settings here.

---

## 5. Affiliates (`/affiliates`)

**What it's for:** Manage affiliate partners who submit leads into your system. Affiliates are the sources of your leads.

**Access:** Manager+

**What you see:**
- A table of all affiliates with: Name, API Key, Status, Callback URL, Allowed Countries

**What you can do:**
- **Add Affiliate** - create a new affiliate with:
  - Name and contact info
  - Auto-generated API key (affiliates use this to submit leads via API)
  - Callback URL (where the system notifies them about lead status changes)
  - Allowed countries (which countries this affiliate can send leads from)
- **Edit Affiliate** - modify settings
- **Toggle Status** - activate/deactivate an affiliate
- **Delete Affiliate** - remove an affiliate permanently
- **Test Mode** - enable test mode so their leads don't go to real advertisers

**How it connects:** Affiliates use the API key to call the `submit-lead` Edge Function. The system then distributes those leads to advertisers based on distribution rules.

---

## 6. Distributions (`/distributions`)

**What it's for:** Track every lead distribution - every time a lead was sent to an advertiser, it shows up here with the result.

**Access:** All authenticated users

**What you see:**
- A table with: Lead Info (name, email), Advertiser, Country, Status (Sent/Failed), Response, Sent Date

**What you can do:**
- **Filter by date range** - see distributions for specific time periods
- **Filter by status** - show only sent or only failed
- **Filter by advertiser** - see distributions for a specific advertiser
- **Search** - find by email or name
- **View Details** - click a row to see the full API response from the advertiser (formatted JSON)
- **Copy Autologin URL** - if the advertiser returned an autologin URL, copy it
- **Bulk Delete** - select and delete distribution records

**Why it matters:** When a lead fails to distribute, this page shows you exactly why (the full error response from the advertiser's API).

---

## 7. Distribution Settings (`/distribution-settings`)

**What it's for:** Configure the rules that determine which leads go to which advertisers. This is the routing logic.

**Access:** Manager+

**What you can do:**
- **Create Distribution Rules** - define rules like:
  - "Leads from Germany submitted by Affiliate X go to Advertiser Y"
  - Set priority/weight (higher = more leads)
  - Set hourly and daily caps per rule
  - Set active hours (e.g., only distribute during business hours)
  - Set weekly schedule (e.g., Monday-Friday only)
- **Edit Rules** - modify existing rules
- **Delete Rules** - remove rules

**How it works:** When a lead comes in, the system checks all active rules that match the lead's country and affiliate, then distributes to the advertiser with the highest priority that hasn't hit its cap.

---

## 8. Rejected Leads (`/rejected-leads`)

**What it's for:** View leads that were rejected by advertisers. When an advertiser's API returns an error (duplicate email, invalid phone, cap reached, etc.), the lead ends up here.

**Access:** All authenticated users (delete requires permission)

**What you see:**
- A table with: Lead Info, Advertiser, Country, Rejection Reason, Date

**What you can do:**
- **Filter by date range**
- **View Rejection Reason** - click to see the full error response (formatted JSON) explaining why the advertiser rejected the lead
- **Bulk Delete** - clean up old rejected leads
- **Copy Email** - copy lead email addresses

**Why it matters:** High rejection rates usually mean something is wrong - bad data quality, duplicate leads, or advertiser integration issues. Check this page regularly.

---

## 9. Conversions (`/conversions`)

**What it's for:** Track FTD (First Time Deposit) conversions. In lead generation, a "conversion" means the lead actually became a paying customer for the advertiser.

**Access:** Manager+

**What you see:**
- **Stats Cards**: Total FTDs, Released FTDs, Pending Release
- A table with: Lead Info, Advertiser, Affiliate, Country, FTD Status, Date

**What you can do:**
- **Filter** by date range, advertiser, affiliate, country, FTD status
- **Search** by email
- **Release FTD** - mark a conversion as "released" (confirmed/paid)
- **Bulk Release/Unrelease** - manage multiple conversions at once
- **Export to CSV** - download conversion data

**Why it matters:** Conversions = money. This is how you track which affiliates and advertisers are actually generating revenue.

---

## 10. Reports (`/reports`)

**What it's for:** Analytics and performance visualization with charts.

**Access:** All authenticated users

**What you see:**
- **Date Presets**: Today, Yesterday, This Week, Last 7 Days, Last 30 Days, This Month, Custom Range
- **Stats Cards**: Total Distributions, Successful, Failed, Success Rate
- **Charts**:
  - Leads Over Time (bar chart)
  - Leads by Status (pie chart with percentages)
  - Top 5 Affiliates (horizontal bar chart)

**How to use it:**
- Select a date range at the top
- All charts and stats update automatically
- Use this for weekly/monthly reporting to management

---

## 11. Country Performance (`/country-performance`)

**What it's for:** See how leads perform broken down by country (geography).

**Access:** Manager+

**What you see:**
- A table of countries with: Country Name, Leads Sent, Conversions, Conversion Rate, Pending

**What you can do:**
- **Click a country** to open a detail modal with two tabs:
  - **By Advertiser** - breakdown of how that country performs per advertiser
  - **By Affiliate** - breakdown of how that country performs per affiliate
- **Filter** by country and date range

**Why it matters:** Some countries convert better than others. Use this to optimize which countries you target.

---

## 12. Advertiser Performance (`/advertiser-performance`)

**What it's for:** See how each advertiser is performing.

**Access:** Manager+

**What you see:**
- **Stats Cards**: Leads Sent, Conversions, Conversion Rate, Pending
- Performance table with per-advertiser metrics

**What you can do:**
- Filter by date range and specific advertiser
- Compare advertiser performance side by side

---

## 13. Affiliate Performance (`/affiliate-performance`)

**What it's for:** See how each affiliate is performing.

**Access:** Manager+

**What you see:**
- **Stats Cards**: Leads Sent, Conversions, Conversion Rate, Pending
- Performance table with per-affiliate metrics

**What you can do:**
- Filter by date range and specific affiliate
- Compare affiliate performance side by side

**Why it matters:** Identifies which affiliates bring the best quality leads (highest conversion rates).

---

## 14. Lead Pools (`/lead-pools`)

**What it's for:** Organize leads into named groups (pools) for batch operations. Think of a pool as a folder of leads that you can use for injection campaigns.

**Access:** Manager+

**What you see:**
- A list of pools with: Name, Description, Lead Count, GEO Breakdown (country badges), Created Date

**What you can do:**
- **Create Pool** - name it and add a description
- **View Pool** - click to see pool details (leads inside it)
- **Delete Pool** - remove a pool

**How it connects:** Pools are used by the Injection system. You create a pool of leads, then create an injection campaign that sends those leads to an advertiser.

---

## 15. Lead Pool Detail (`/lead-pools/:id`)

**What it's for:** View and manage the contents of a specific lead pool.

**Access:** Manager+

**What you see:**
- **Stats**: Total leads, Sent, Failed, Available
- **GEO Breakdown**: how many leads per country
- **Two Tabs**:
  - **Pool Leads** - table of all leads in this pool
  - **Add Leads** - form to add more leads from the system

**What you can do:**
- **View all leads** in the pool
- **Add leads** by filtering from existing leads (by country, date range, affiliate, with a lead limit)
- **Export** pool data

---

## 16. Injection Dashboard (`/injections`)

**What it's for:** Overview of all injection campaigns. "Injection" means sending a batch of leads to an advertiser in a controlled, timed manner (not all at once).

**Access:** Manager+

**What you see:**
- **Stats Cards**: Active Injections, Total Sent, Total Failed, Success Rate
- **Active Injection Cards** showing:
  - Status badge (Running, Paused, Completed, etc.)
  - Progress bar (how far along)
  - Sent/Failed/Skipped counts
  - Associated pool

**How to use it:** This is your campaign control center. At a glance, see which injections are running and how they're performing.

---

## 17. Injection Jobs (`/injections/jobs`)

**What it's for:** List all injection campaigns (past and present).

**Access:** Manager+

**What you see:**
- Cards for each injection job with status, progress, and stats

**What you can do:**
- Click a job to go to its detail page
- Create a new injection

---

## 18. Injection Detail (`/injections/:id`)

**What it's for:** Full control over a single injection campaign.

**Access:** Manager+

**What you see:**
- **Progress Overview**: Targeting count, Remaining, Sent, Failed
- **Three Tabs**:
  - **Overview/Leads** - table of all leads in this injection with status
  - **Add Leads** - add more leads from pools
  - **Settings** - campaign configuration

**What you can do:**
- **Start/Pause/Resume** the injection
- **View each lead's status** - pending, scheduled, sending, sent, failed, skipped
- **Copy autologin URLs** from sent leads
- **Configure settings**:
  - Smart distribution mode
  - GEO caps (e.g., max 50 leads from Germany)
  - Noise level (randomization)
  - Working hours (only send during business hours)
  - Min/max delay between sends
- **Validate** configuration before starting
- **Reset** the injection to start over

**Why it matters:** Injections simulate natural lead flow to advertisers. Instead of dumping 1000 leads at once (which looks suspicious), injections send them gradually with randomized delays.

---

## 19. Injection Leads (`/injections/leads`)

**What it's for:** View all successfully sent injection leads across all campaigns.

**Access:** Manager+

**What you see:**
- Table with: Injection Name, Advertiser, Lead Info, Country, Sale Status, FTD, Sent Time, Autologin URL

**What you can do:**
- Filter by date range
- Search by email/name
- Copy emails and autologin URLs
- Bulk export to CSV
- Bulk delete

---

## 20. Injection Failed Leads (`/injections/failed`)

**What it's for:** View leads that failed during injection (advertiser rejected them).

**Access:** Manager+

**What you see:**
- Table with: Injection Name, Advertiser, Lead Info, Country, Failure Response, Source

**What you can do:**
- **View failure reason** - click to see the full error response in a modal
- Filter by injection, country, date range
- Search by email/name

**Why it matters:** If lots of injection leads are failing, the advertiser integration might be broken or the leads might be duplicates.

---

## 21. Send History (`/send-history`)

**What it's for:** Track the global history of every lead sent, with cooldown protection status.

**Access:** Manager+

**What you see:**
- Table with: Email, Advertiser, Sent Time, Country, Cooldown Status

**Cooldown Statuses:**
- **Available** (green) - this lead can be sent again
- **24-hour Protection** (yellow) - recently sent, cannot resend yet
- **5-day Cooldown** (red) - on cooldown period

**What you can do:**
- Search by email
- Filter by advertiser, country, date range

**Why it matters:** Prevents the same lead from being sent to the same advertiser too frequently. If an advertiser keeps rejecting leads as "duplicate," check here to see if cooldowns are being respected.

---

## 22. Test Lead Logs (`/test-logs`)

**What it's for:** Track test lead submissions. Before going live with an advertiser, you send test leads to verify the integration works.

**Access:** Manager+

**What you see:**
- Table with: Status (Success/Failed badge), Advertiser, Test Data (name, email), Country, Timestamp

**What you can do:**
- View the **request** that was sent (the data your system sent to the advertiser)
- View the **response** that came back (what the advertiser's API returned)
- Filter by date range and advertiser

**Why it matters:** When setting up a new advertiser, use test leads first. This page shows you if the integration is working correctly before you send real leads.

---

## 23. Monitoring (`/monitoring`)

**What it's for:** Real-time system health monitoring. This is your operations dashboard.

**Access:** Manager+

**What you see:**
- **Real-time Metrics**: Leads/minute, Last hour count, 24-hour count, Success rate
- **Throughput Chart**: leads processed per minute over the last 60 minutes
- **24-hour Overview Chart**: lead volume over the day
- **Error Logs**:
  - Distribution failures table
  - Queue errors table
- **System Health Cards**:
  - Active advertisers count
  - Active affiliates count
  - Queue pending count
  - Recent failures count
- **VPS Server Health**:
  - Service status (Apache, PHP, Proxy, Log Files) with green/red indicators
- **System Resources**:
  - Disk usage (percentage bar)
  - Memory usage (percentage bar)
  - CPU usage (percentage bar)
  - System uptime
- **Callback Logs**: incoming webhook callbacks from advertisers

**How to use it:**
- Check this page if things seem slow or broken
- Green = good, Red = investigate
- If CPU/Memory is high, the server might need more resources
- If queue pending is high, leads are backing up

---

## 24. Audit Logs (`/audit-logs`)

**What it's for:** Complete activity trail of who did what and when. Every action in the system is logged here.

**Access:** Manager+

**What you see:**
- Table with: Timestamp, User Email, Action, Table Name, Details
- **Stats Cards**: Total logs, Action types, Tables tracked, Current page

**Action Types** (color-coded):
- **Create** (green) - someone created a record
- **Update** (blue) - someone modified a record
- **Delete** (red) - someone deleted a record
- **Login** (purple) - someone logged in
- **Auth** - authentication events

**What you can do:**
- Search by user email
- Filter by action type
- Filter by table name
- Click a row to see full details including:
  - Old data vs New data (what changed)
  - User agent (which browser was used)
  - IP address
- Paginate through results (50 per page)

**Why it matters:** For accountability and debugging. If something goes wrong, audit logs tell you exactly who changed what.

---

## 25. Users (`/users`)

**What it's for:** Manage user accounts, roles, and permissions.

**Access:** Super Admin only

**What you see:**
- **Stats Cards**: Total Users, Super Admins, Managers, Agents
- Table with: Name, Email, Role, Status, Actions

**What you can do:**
- **Create User** - add a new user with:
  - Email, password, full name
  - Role assignment (Super Admin, Manager, Agent, Affiliate)
- **Edit User** - change name, email, role
- **Set Permissions** - configure granular permissions:
  - `view_phone` - can see lead phone numbers
  - `view_email` - can see lead email addresses
  - `export_leads` - can export data to CSV
  - `delete_leads` - can delete leads
  - `edit_leads` - can edit lead records
  - `view_all_leads` - can see leads from all affiliates (not just their own)
- **Activate/Deactivate** users
- **Impersonate** - (Super Admin only) log in as another user to see what they see
- **Delete User** - permanently remove a user

---

## 26. Settings (`/settings`)

**What it's for:** Configure your personal CRM preferences.

**Access:** Manager+

**What you can configure:**
- **Records Per Page** - how many rows to show in tables (1-1000)
- **Date Format** - how dates are displayed
- **Timezone** - your timezone (35+ options, affects all date calculations)
- **Show Lead ID Column** - toggle visibility
- **Compact Mode** - reduce spacing in tables for more data on screen
- **Auto-refresh Interval** - how often data refreshes automatically (disabled, 30s, 1min, 5min)
- **Theme** - Light, Dark, or System (match your OS setting)

**Good to know:** Settings are saved in your browser (localStorage), so they're specific to each device/browser you use.

---

## 27. API Docs (`/api-docs`)

**What it's for:** Documentation for the CRM's API endpoints. Affiliates use this to understand how to submit leads programmatically.

**Access:** All authenticated users

**What it covers:**
- How to submit leads via API
- Authentication (API key usage)
- Request/response formats
- Error codes and handling

---

## Quick Reference: Which Pages to Check For Common Tasks

| I want to... | Go to |
|--------------|-------|
| See today's performance | Dashboard |
| Find a specific lead | Leads (use filters/search) |
| See why a lead failed | Rejected Leads or Distributions |
| Add a new advertiser | Advertisers |
| Add a new affiliate | Affiliates |
| Set up routing rules | Distribution Settings |
| Track conversions/revenue | Conversions |
| Run a batch campaign | Injection Dashboard |
| Check system health | Monitoring |
| See who did what | Audit Logs |
| Add/remove users | Users (Super Admin only) |
| Change my display preferences | Settings |
| Generate reports | Reports |
| See country-level data | Country Performance |
