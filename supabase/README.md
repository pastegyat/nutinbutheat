# Supabase parallel migration

1. Create a Supabase project in the desired region.
2. Apply `migrations/202608240001_initial_schema.sql` through the SQL editor or Supabase CLI.
3. Store the Supabase URL and service-role key as Worker secrets; never expose that key to the browser.
4. Set the required Appwrite and Supabase variables, then run `tsx scripts/migrate_appwrite_to_supabase.ts`.
5. Compare row counts and sampled records before enabling the Worker-side Supabase adapter.

The initial migration deliberately has no browser RLS policies. Public reads and all writes stay behind the existing Cloudflare Worker.
