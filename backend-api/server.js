// Simple Express API to proxy OpenAI calls
// Deploy this to Vercel/Railway/Render (free tier)

import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Deep AI-powered analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { projectFiles, projectName } = req.body;

    const prompt = `Analyze this codebase. Only report what you see in the actual files.

PROJECT: ${projectName}

${projectFiles}

Provide ONLY these sections based on what's in the files:

**PROJECT TYPE:** [Frontend / Backend / Fullstack]

**COMPLEXITY:** [Simple / Medium / Complex] - Why?

**STACK:**
- Framework/library (from package.json/requirements.txt)
- Language
- Main dependencies

**SERVICES NEEDED:**
- Database? (only if you see it in dependencies/docker-compose)
- Cache? (only if you see Redis/Memcached)
- Storage? (only if you see S3/file storage)

**BUILD COMMANDS:**
- Install: (from package.json scripts)
- Build: (from package.json scripts)
- Start: (from package.json scripts)
- Port: (from code or docker)

**DEPLOYMENT NOTES:**
Only mention if you see it in the files:
- Docker config
- Environment variables needed
- Special requirements

Be direct. No fluff. Only report what's actually in the files.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a DevOps engineer. Be direct and concise. Only report facts from the code.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    res.json({
      success: true,
      analysis: response.choices[0]?.message?.content || 'No analysis available'
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed'
    });
  }
});

// AI-powered deployment recommendation endpoint
app.post('/api/recommend', async (req, res) => {
  try {
    const { aiAnalysis, projectFiles, projectName } = req.body;

    const prompt = `Based on this project analysis, recommend AWS services for deployment. Be direct and concise.

PROJECT: ${projectName}

${aiAnalysis}

Provide ONLY:

**AWS SERVICES:**
- List specific services (Amplify/EC2/ECS/RDS/S3/CloudFront)
- Why each service?

**DEPLOYMENT STEPS:**
1. Step one
2. Step two
3. Step three
(Max 5 steps, be specific)

**COST:**
Estimated monthly cost for low traffic

**FASTER/CHEAPER OPTIONS:**
If they exist

No unnecessary text. Just the facts.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'AWS Solutions Architect. Be concise. No fluff.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 600,
      temperature: 0.2,
    });

    res.json({
      success: true,
      recommendation: response.choices[0]?.message?.content || 'No recommendation available'
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({
      success: false,
      error: 'Recommendation failed'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cloudable API running on port ${PORT}`);
});

