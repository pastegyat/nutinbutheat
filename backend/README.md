# Backend setup

Use Appwrite for data and a protected server endpoint for all writes. Never expose an Appwrite API key or Cloudflare R2 credentials in React.

## Collections

Create database `nutinbutheat` and the following collections.

### posts

`title` string(255), `slug` string(255, unique), `description` string(5000), `image_url` string(2048), `category` string(100), `is_premium` enum(`yes`,`no`), `status` enum(`public`,`private`), `views` integer default 0, `link_clicks` integer default 0, `created_at` datetime.

### reactions

`post_id` string(36), `visitor_hash` string(64), `type` enum(`like`,`dislike`), `created_at` datetime. Create a unique composite index on `post_id` + `visitor_hash`. Hash the IP server-side; never store raw IPs.

### post_events

`post_id` string(36), `visitor_hash` string(64), `event_type` enum(`view`,`link_click`), `created_at` datetime. The Worker uses a deterministic document ID to make each event unique, then increments `posts.views` or `posts.link_clicks`.

## Secure server endpoints

`POST /admin/posts`: admin-only; validate, upload image to Cloudflare R2, create `posts` document with R2 public URL.

`POST /events`: make an idempotent unique view/link-click event, then increment the matching post counter.

`POST /reactions`: upsert one reaction per visitor/post and return updated totals.

Server-only secrets: `APPWRITE_API_KEY`, R2 account/access/secret/bucket/public-base URL, and `IP_HASH_SECRET`. Copy `.env.example` to `.env.local` and fill only `VITE_` values for the frontend.
