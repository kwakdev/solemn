# Solemn Memory

React + Vite storefront with a Supabase-powered product admin.

## Supabase setup

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste all of [`supabase/setup.sql`](supabase/setup.sql), and run it once. The script creates the product catalog, stock data, admin allowlist, image bucket, and Row Level Security policies.
3. If needed, change the emails inserted into `public.admin_users` near the top of the SQL file. Only those accounts can edit the catalog.
4. In **Project Settings > API**, copy the Project URL and the publishable key. The legacy `anon` key also works.
5. Create `.env.local` for local development:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

6. Add the same two variables in **Vercel > Project > Settings > Environment Variables** for Production and Preview, then redeploy.
7. In **Authentication > Users**, create the admin user with an email from `public.admin_users`.
8. In **Authentication > Providers > Email**, turn off **Allow new users to sign up**.
9. Visit `/admin` and sign in with the existing admin account.

The publishable key is designed to be used in the browser. Never add a Supabase `service_role` or secret key to a `VITE_` variable.

## Development

```sh
npm install
npm run dev
```

## Checks

```sh
npm run lint
npm run build
```
