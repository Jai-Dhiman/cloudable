# 🎉 Cloudable: Deployment-as-a-Service Setup

Your CLI is now configured as a **SaaS deployment service**! Users anywhere can deploy WITHOUT needing AWS credentials.

## How It Works

```
User in India                 Your Vercel Backend              Your AWS Account
     │                               │                               │
     ├─> cloudable initialize        │                               │
     │                               │                               │
     └──> Sends project ────────────>│                               │
                                     │                               │
                                     ├─> Uses YOUR AWS creds         │
                                     │                               │
                                     └──> Deploys ──────────────────>│
                                                                     │
                                     ┌─────────── Returns URL ───────┘
                                     │
         ┌─────── Shows URL ─────────┘
         │
    User sees: http://x.x.x.x:3000
```

## 🚀 Step-by-Step Setup

### Step 1: Deploy Backend to Vercel

```bash
cd backend-api

# Install dependencies
npm install

# Login to Vercel (if not already)
npm i -g vercel
vercel login

# Deploy
vercel --prod
```

**You'll get a URL like:** `https://cloudable-api-abc123.vercel.app`

### Step 2: Add Environment Variables to Vercel

1. Go to: https://vercel.com/dashboard
2. Click your `cloudable-api` project
3. Go to **Settings** → **Environment Variables**
4. Add these:

```
OPENAI_API_KEY=sk-your-openai-key-here
AWS_ACCESS_KEY_ID=AKIA5UJBVONDV6MXQ5FO
AWS_SECRET_ACCESS_KEY=your-secret-key-here
AWS_REGION=us-east-1
```

5. **Redeploy** to apply env vars:
```bash
vercel --prod
```

### Step 3: Update CLI with Your Backend URL

Edit `src/config/api.ts`:

```typescript
export const API_CONFIG = {
  // Replace with YOUR Vercel URL:
  BASE_URL: 'https://cloudable-api-abc123.vercel.app',
  
  // Rest stays same
  ENDPOINTS: {
    DEPLOY: '/api/deploy',
    DEPLOY_STATUS: '/api/deploy/status',
    ANALYZE: '/api/analyze',
    RECOMMEND: '/api/recommend'
  },
  TIMEOUT: 30 * 60 * 1000
};
```

### Step 4: Rebuild CLI

```bash
npm run build
```

### Step 5: Test It!

```bash
# Go to a test Next.js project
cd ~/some-nextjs-project

# Run cloudable
cloudable initialize
```

**Users will see:**
- ✅ No AWS credential prompts!
- ✅ "Using Cloudable deployment service..."
- ✅ Deploys to YOUR AWS account
- ✅ Gets deployment URL

---

## 📝 What Changed

### ✅ Backend API (`backend-api/server.js`)
- **Added:** `POST /api/deploy` endpoint
- **Added:** `GET /api/deploy/status/:buildId` endpoint
- **Uses:** Your AWS credentials from Vercel env vars
- **Does:** Builds Docker, pushes to ECR, deploys to EC2

### ✅ CLI Changes
- **Removed:** AWS credential prompts (lines 211-238)
- **Removed:** Local AWS setup command
- **Added:** `BackendDeployService` (calls your API)
- **Added:** `src/config/api.ts` (backend URL config)
- **Updated:** `initialize.ts` uses backend API

### ✅ Questions Removed
- ❌ ~~Expected DAU~~ → Default: 1000
- ❌ ~~Monthly budget~~ → Default: $100
- ❌ ~~AWS Region~~ → Default: us-east-1
- ❌ ~~AWS Access Key~~
- ❌ ~~AWS Secret Key~~

### ✅ Questions Remaining  
- Database preference (if detected)
- Custom domain (optional)
- Deploy confirmation

---

## 🔐 Security Benefits

✅ **AWS credentials NEVER leave your backend**  
✅ **Users can't extract or misuse credentials**  
✅ **You control ALL deployments**  
✅ **Can add rate limiting later**  
✅ **Can add authentication later**  
✅ **Can add billing/usage tracking later**  

---

## 🧪 Testing Checklist

After setup, test:

```bash
# 1. Backend health check
curl https://your-backend.vercel.app/health

# 2. Deploy test (from a Next.js project)
cd ~/test-nextjs-app
cloudable initialize

# Should see:
# ✅ No AWS prompts
# ✅ "Using Cloudable deployment service..."
# ✅ Build starts
# ✅ Deployment completes
```

---

## 🎯 Next Steps (Optional)

### Add Authentication
```typescript
// In backend-api/server.js
app.use('/api/deploy', requireApiKey);
```

### Add Rate Limiting
```bash
npm install express-rate-limit
```

### Add Usage Tracking
```typescript
// Track deployments per user
await db.logDeployment(userId, projectName);
```

### Add Billing
- Track deployment count
- Charge per deployment or monthly
- Use Stripe for payments

---

## 📊 Cost Management

**Your AWS costs will include:**
- EC2 instances (all user apps)
- ECR storage (Docker images)
- S3 storage (build artifacts)
- CodeBuild minutes (builds)

**Monitor:**
```bash
# Check AWS billing dashboard regularly
# Set up AWS billing alerts
# Consider adding usage limits per user
```

---

## 🐛 Troubleshooting

### "Server configuration error: AWS credentials not set"
→ Add AWS env vars to Vercel and redeploy

### "Failed to check build status"
→ Check backend URL in `src/config/api.ts`

### "Build failed"
→ Check Vercel logs: `vercel logs`

### CLI can't reach backend
→ Ensure backend URL is correct and backend is deployed

---

## ✅ You're Done!

Your CLI is now a **deployment-as-a-service**!

Users download your CLI → Run `cloudable initialize` → Deploy to YOUR AWS → Done!

No AWS credentials needed. Just works. 🎉

