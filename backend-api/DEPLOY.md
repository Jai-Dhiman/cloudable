# Deploy Cloudable Backend API

This backend keeps your OpenAI API key secure while allowing all CLI users to access AI features.

## Quick Deploy to Vercel (Easiest - FREE)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd backend-api
vercel
```

Follow prompts:
- Login to Vercel
- Link to new project
- Answer questions (default is fine)

### Step 3: Set Environment Variable

```bash
# After deployment, add your OpenAI API key
vercel env add OPENAI_API_KEY

# Paste your OpenAI key when prompted

# Redeploy to apply
vercel --prod
```

### Step 4: Get Your API URL

After deployment, Vercel gives you a URL like:
```
https://cloudable-api-xxxx.vercel.app
```

### Step 5: Update CLI

Update the API URL in the CLI:

```typescript
// In src/utils/ai-helper.ts, change this line:
const API_URL = 'https://cloudable-api-xxxx.vercel.app' // Your Vercel URL
```

Then publish new CLI version:
```bash
cd ../
npm version patch
npm publish
```

## Alternative: Deploy to Railway (Also FREE)

1. Go to https://railway.app
2. Sign up / Login
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your cloudable repo
5. Set root directory to `backend-api`
6. Add environment variable: `OPENAI_API_KEY`
7. Deploy!

Railway gives you a URL like: `https://cloudable-api.railway.app`

## Alternative: Deploy to Render (FREE)

1. Go to https://render.com
2. Sign up / Login  
3. Click "New" → "Web Service"
4. Connect GitHub repo
5. Set root directory: `backend-api`
6. Build command: `npm install`
7. Start command: `npm start`
8. Add environment variable: `OPENAI_API_KEY`
9. Deploy!

## Testing Your API

```bash
# Test health check
curl https://your-api-url.vercel.app/health

# Test analyze endpoint
curl -X POST https://your-api-url.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "analysis": {
      "framework": {"name": "Next.js", "runtime": "node"},
      "services": {}
    }
  }'
```

## Security

✅ API key is stored as environment variable (not in code)
✅ Only your backend has the key
✅ CLI users never see your key
✅ Free tier for Vercel/Railway/Render is plenty for this

## Cost

- **Vercel**: FREE (up to 100GB bandwidth)
- **Railway**: FREE ($5 credit/month)  
- **Render**: FREE (after 750 hours/month limit, only $7/month)
- **OpenAI**: ~$0.0001 per request (super cheap with gpt-4o-mini)

Even with 1000 users, cost is minimal!

