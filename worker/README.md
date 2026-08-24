# Deploy the protected API

1. Install Wrangler and log in: `npm install -g wrangler`, then `wrangler login`.
2. From this folder run: `wrangler secret put ADMIN_EMAIL` and enter the Appwrite email address allowed to publish.
3. Run `wrangler secret put APPWRITE_API_KEY` and enter an Appwrite server API key with database document access.
4. Run `wrangler secret put IP_HASH_SECRET` and enter a long random value.
5. Deploy: `wrangler deploy`.
6. Copy the Worker URL into `VITE_APPWRITE_API_URL` in `.env.local`, then restart `npm run dev`.

The Worker uses the `store` R2 binding directly. It therefore does not need R2 access keys. Before using the portal, add Appwrite login and allow that email to sign in.
