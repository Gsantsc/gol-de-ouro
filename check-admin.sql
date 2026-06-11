-- Replace the value below with TEST_ADMIN_EMAIL from your local .env.
SELECT id, email, role, approval_status, status, blocked FROM public.users WHERE email = '<admin-email>';
