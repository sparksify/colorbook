# 🎨 ColorBook — AI-Personalized Coloring Books

Upload a photo of your child, pick a theme, and get a personalized printable coloring book in under 60 seconds.

## How it works

1. **Photo analysis** — GPT-4o Vision extracts a character descriptor (hair, skin, glasses, etc.)
2. **Page generation** — `gpt-image-1` generates each coloring book page using the locked descriptor + reference photo
3. **PDF assembly** — `pdf-lib` assembles all pages into a print-ready PDF with cover page

---

## Deploy to Vercel in 5 minutes

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create colorbook --public --push
# or push to an existing repo
```

### Step 2 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy** — it will fail the first time (missing env var), that's fine

### Step 3 — Add environment variables

In Vercel → your project → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-...` your key from platform.openai.com |

Redeploy after adding the variable.

### Step 4 — Done ✅

Your app is live. Test with a photo and a 4-page dinosaur book first.

---

## Local development

```bash
# Install dependencies
npm install

# Create env file
cp .env.example .env.local
# Add your OPENAI_API_KEY to .env.local

# Start dev server
npm run dev
# Visit http://localhost:3000
```

---

## Cost per book

| Component | Cost |
|-----------|------|
| GPT-4o Vision (photo analysis) | ~$0.01 |
| gpt-image-1 × 6 pages | ~$0.24–0.48 |
| PDF assembly | Free |
| **Total per 6-page book** | **~$0.30–0.50** |

## Important notes

- **gpt-image-1 access**: Make sure your OpenAI account has access to `gpt-image-1`. If you get a model not found error, use `dall-e-3` as a fallback in `pages/api/generate-page.js` (change the model name — character consistency will be lower but still good).
- **Vercel free tier**: Functions are capped at 60s. Each page generation takes 10–20s. For 4-6 pages this is fine. For 12 pages, upgrade to Vercel Pro or generate pages client-side in sequence.
- **Image size**: The API sends the reference photo with every page request. Keep photos under 4MB.

## Adding Stripe later

When you're ready to add payments:
1. `npm install stripe @stripe/stripe-js`
2. Add `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to Vercel env vars
3. Create `/pages/api/checkout.js` to create a Checkout Session
4. Gate the generate button behind payment confirmation

---

Built with Next.js, OpenAI, pdf-lib, and deployed on Vercel.
