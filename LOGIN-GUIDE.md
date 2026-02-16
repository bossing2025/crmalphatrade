# MegaTronCrm - Login Guide

Complete guide for accessing your MegaTronCRM application.

---

## Quick Start - Existing User

**An existing super_admin account was found in your database:**

- **Email**: `0360804@gmail.com`
- **Role**: super_admin
- **Password**: *Unknown* (need to reset or ask who created it)

**Login URL**: http://localhost:5173/login (or your server's URL)

---

## Option 1: Reset Password for Existing Account

If you don't know the password for `0360804@gmail.com`, reset it:

```bash
./reset-admin-password.sh
```

**Manual reset method:**
```bash
# Get the service role key
sg docker -c "docker exec supabase-kong env | grep SERVICE_ROLE"

# Or use the default local key
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Reset password
curl -X POST 'http://127.0.0.1:8000/auth/v1/admin/users/40fbdec4-99fa-45cb-bace-8274a47fb934' \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"password": "your_new_password"}'
```

---

## Option 2: Create New Super Admin Account

Create a brand new super_admin user:

```bash
./create-super-admin.sh
```

**Manual creation method:**

1. **Create user via Supabase Studio:**
   - Open: http://localhost:3000
   - Go to: Authentication → Users
   - Click: "Add user"
   - Fill in email and password
   - Click: "Create new user"
   - Copy the user ID

2. **Add super_admin role:**
   ```bash
   sg docker -c "docker exec supabase-db psql -U postgres -c \"INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID_HERE', 'super_admin');\""
   ```

---

## Option 3: Use Registration Page

**Note**: The registration page creates a regular user (not super_admin by default).

1. Visit: http://localhost:5173/register
2. Fill in:
   - Full Name
   - Email
   - Password (min 6 characters)
3. Click "Create Account"
4. You'll be logged in automatically

**To make this user a super_admin:**
```bash
# Get the user ID first
sg docker -c "docker exec supabase-db psql -U postgres -c \"SELECT id, email FROM auth.users WHERE email = 'your@email.com';\""

# Add super_admin role
sg docker -c "docker exec supabase-db psql -U postgres -c \"INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID_HERE', 'super_admin');\""
```

---

## User Roles Available

The system supports 4 roles:

1. **super_admin** - Full system access, can create users
2. **manager** - Can manage leads, advertisers, affiliates
3. **agent** - Can view and work with leads
4. **affiliate** - Limited access to their own data

---

## Checking Existing Users

**List all users:**
```bash
sg docker -c "docker exec supabase-db psql -U postgres -c 'SELECT id, email, created_at FROM auth.users;'"
```

**Check user roles:**
```bash
sg docker -c "docker exec supabase-db psql -U postgres -c 'SELECT u.email, ur.role FROM auth.users u LEFT JOIN public.user_roles ur ON u.id = ur.user_id;'"
```

**Check profiles:**
```bash
sg docker -c "docker exec supabase-db psql -U postgres -c 'SELECT p.id, p.username, p.full_name, u.email FROM public.profiles p JOIN auth.users u ON p.id = u.id;'"
```

---

## Troubleshooting Login Issues

### Issue: "Invalid login credentials"

**Possible causes:**
1. Wrong email or password
2. User doesn't exist
3. Email not confirmed (shouldn't happen with local Supabase)

**Solutions:**
- Reset password using the script above
- Check if user exists in database
- Create new user

### Issue: "Cannot connect to server"

**Check:**
1. Is Supabase running?
   ```bash
   sg docker -c "docker ps --filter 'name=supabase'"
   ```

2. Is the dev server running?
   ```bash
   npm run dev
   ```

3. Check .env file:
   ```bash
   cat .env
   ```
   Should show: `VITE_SUPABASE_URL=http://127.0.0.1:8000`

### Issue: "User logged in but has no access"

**Add role to user:**
```bash
# Replace USER_ID with actual user ID
sg docker -c "docker exec supabase-db psql -U postgres -c \"INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID', 'super_admin');\""
```

### Issue: "Page shows blank after login"

**Check browser console:**
1. Press F12
2. Look for errors in Console tab
3. Common issues:
   - Missing role in database
   - Network errors to Supabase API

---

## Default Login Flow

1. User visits app → redirected to `/login`
2. Enters email & password
3. System checks credentials with Supabase Auth
4. If valid → redirected to `/dashboard`
5. Dashboard loads user profile and role from database

---

## Quick Commands Reference

```bash
# Reset password for 0360804@gmail.com
./reset-admin-password.sh

# Create new super admin
./create-super-admin.sh

# List all users
sg docker -c "docker exec supabase-db psql -U postgres -c 'SELECT id, email FROM auth.users;'"

# Check user roles
sg docker -c "docker exec supabase-db psql -U postgres -c 'SELECT u.email, ur.role FROM auth.users u LEFT JOIN public.user_roles ur ON u.id = ur.user_id;'"

# Add super_admin role to existing user
sg docker -c "docker exec supabase-db psql -U postgres -c \"INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID', 'super_admin');\""

# Delete a user (if needed)
sg docker -c "docker exec supabase-db psql -U postgres -c \"DELETE FROM auth.users WHERE email = 'user@example.com';\""
```

---

## Security Notes

**For Production:**

1. **Never use default passwords**
   - Always set strong, unique passwords

2. **Disable public registration** (if not needed)
   - Modify RegisterForm component
   - Or add role-based registration approval

3. **Enable Row Level Security (RLS)**
   - Already configured in migrations
   - Ensures users can only access their data

4. **Use HTTPS in production**
   - Update VITE_SUPABASE_URL to https://
   - Configure SSL certificate

5. **Rotate JWT secrets**
   - Change from default Supabase local keys
   - Update in Supabase dashboard (if using cloud)

---

## Next Steps After Login

Once logged in as super_admin, you can:

1. **Create Users**: /users page
2. **Manage Leads**: /leads page
3. **Add Advertisers**: /advertisers page
4. **Add Affiliates**: /affiliates page
5. **View Dashboard**: /dashboard page
6. **Configure Settings**: /settings page

---

## Need Help?

- **Application not loading?** See [INSTALLATION.md](INSTALLATION.md)
- **Supabase issues?** Check [TROUBLESHOOTING.md](INSTALLATION.md#troubleshooting)
- **Database problems?** Run: `supabase db reset`

---

*Last updated: 2024-02-13*
