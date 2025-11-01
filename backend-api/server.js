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

// Analyze codebase endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { analysis } = req.body;

    const prompt = `Analyze this codebase and provide deployment insights:

Framework: ${analysis.framework?.name || 'Unknown'}
Runtime: ${analysis.framework?.runtime || 'Unknown'}
Database: ${analysis.services?.database?.type || 'None'}
Cache: ${analysis.services?.cache?.type || 'None'}

Provide a brief analysis (2-3 sentences) about:
1. Any potential deployment issues
2. Performance considerations
3. Security recommendations`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert DevOps engineer analyzing codebases for deployment.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    res.json({
      success: true,
      insight: response.choices[0]?.message?.content || 'No analysis available'
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed'
    });
  }
});

// Infrastructure recommendation endpoint
app.post('/api/recommend', async (req, res) => {
  try {
    const { analysis } = req.body;

    const prompt = `Given this project:

Framework: ${analysis.framework?.name || 'Unknown'} ${analysis.framework?.version || ''}
Type: ${analysis.framework?.type || 'Unknown'}
Runtime: ${analysis.framework?.runtime || 'Unknown'}
Database: ${analysis.services?.database?.type || 'None'}
Cache: ${analysis.services?.cache?.type || 'None'}
Storage: ${analysis.services?.storage?.type || 'None'}

Recommend the BEST AWS deployment option and explain why in 2-3 sentences.
Consider cost, scalability, and ease of management.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AWS solutions architect expert.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
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

