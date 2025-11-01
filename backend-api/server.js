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

    const prompt = `You are an expert DevOps engineer. Analyze this codebase thoroughly by reading all the files provided.

PROJECT: ${projectName}

${projectFiles}

Based on ALL the files above, provide a comprehensive analysis with these EXACT sections:

**PROJECT TYPE:** [Frontend / Backend / Fullstack / Mobile / Other]

**COMPLEXITY:** [Simple / Medium / Complex / Enterprise] - Explain why

**FRAMEWORK & STACK:**
- Main framework/library
- Programming language
- Key dependencies

**ARCHITECTURE:**
- What does this project do?
- How is it structured?

**DEPLOYMENT REQUIREMENTS:**
- Does it need a database? What type?
- Does it need caching?
- Does it need file storage?
- Any special services (Redis, S3, etc.)?

**BUILD & RUN:**
- How to install dependencies?
- How to build it?
- How to run it?
- What port does it use?

**DEPLOYMENT INSIGHTS:**
- Potential challenges
- Special considerations
- Security concerns

Be specific and detailed. Base everything on the ACTUAL files you read above.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert DevOps engineer with deep knowledge of all frameworks, languages, and cloud deployment strategies.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
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

    const prompt = `You are an AWS Solutions Architect. Based on the project analysis below, recommend the OPTIMAL AWS deployment strategy.

PROJECT: ${projectName}

ANALYSIS:
${aiAnalysis}

PROJECT FILES:
${projectFiles || 'See analysis above'}

Provide a detailed deployment recommendation with these EXACT sections:

**RECOMMENDED AWS SERVICES:**
List the specific AWS services (e.g., ECS Fargate, Amplify, EC2, RDS, S3, CloudFront, etc.)

**DEPLOYMENT ARCHITECTURE:**
- How these services work together
- Architecture diagram description

**COST ESTIMATE:**
Rough monthly cost estimate (e.g., "$25-50/month for small traffic")

**STEP-BY-STEP DEPLOYMENT:**
1. First step...
2. Second step...
(Provide clear, actionable steps)

**PROS:**
- Why this is the best choice
- Benefits

**CONS:**
- Potential drawbacks
- What to watch out for

**ALTERNATIVES:**
If they want cheaper/easier/more scalable options

Be specific about AWS service names and explain WHY each service is chosen based on the project's actual needs.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert AWS Solutions Architect with deep knowledge of cost optimization, scalability, and deployment best practices.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
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

