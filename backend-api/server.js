// Simple Express API to proxy OpenAI calls
// Deploy this to Vercel/Railway/Render (free tier)

import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  CodeBuildClient, 
  StartBuildCommand, 
  BatchGetBuildsCommand,
  CreateProjectCommand 
} from '@aws-sdk/client-codebuild';
import { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand } from '@aws-sdk/client-ecr';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for project uploads

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
      model: 'gpt-5-2025-08-07',
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
      model: 'gpt-5-2025-08-07',
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

// Deployment endpoint - uses backend's AWS credentials
app.post('/api/deploy', async (req, res) => {
  try {
    const { projectName, projectZip, dockerfile, region = 'us-east-1' } = req.body;

    // Validate required fields
    if (!projectName || !projectZip || !dockerfile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectName, projectZip, dockerfile'
      });
    }

    // Use backend's AWS credentials from environment
    const awsConfig = {
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    };

    if (!awsConfig.credentials.accessKeyId || !awsConfig.credentials.secretAccessKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: AWS credentials not set'
      });
    }

    const stsClient = new STSClient(awsConfig);
    const s3Client = new S3Client(awsConfig);
    const ecrClient = new ECRClient(awsConfig);
    const codeBuildClient = new CodeBuildClient(awsConfig);

    // Get AWS account ID
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account;

    // Step 1: Ensure ECR repository exists
    try {
      await ecrClient.send(new DescribeRepositoriesCommand({ repositoryNames: [projectName] }));
    } catch (error) {
      if (error.name === 'RepositoryNotFoundException') {
        await ecrClient.send(new CreateRepositoryCommand({ repositoryName: projectName }));
      }
    }

    // Step 2: Ensure S3 bucket exists
    const bucketName = `cloudable-builds-${accountId}`;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error) {
      if (error.name === 'NotFound') {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      }
    }

    // Step 3: Upload project zip to S3
    const sourceKey = `${projectName}/${Date.now()}.zip`;
    const zipBuffer = Buffer.from(projectZip, 'base64');
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: sourceKey,
      Body: zipBuffer
    }));

    // Step 4: Create/update CodeBuild project
    const buildSpec = `version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${accountId}.dkr.ecr.${region}.amazonaws.com
      - REPOSITORY_URI=${accountId}.dkr.ecr.${region}.amazonaws.com/${projectName}
  build:
    commands:
      - echo Build started on \`date\`
      - echo Building the Docker image...
      - docker build -t $REPOSITORY_URI:latest .
  post_build:
    commands:
      - echo Build completed on \`date\`
      - echo Pushing the Docker image...
      - docker push $REPOSITORY_URI:latest`;

    const projectConfig = {
      name: `cloudable-${projectName}`,
      source: {
        type: 'S3',
        location: `${bucketName}/${sourceKey}`
      },
      artifacts: { type: 'NO_ARTIFACTS' },
      environment: {
        type: 'LINUX_CONTAINER',
        image: 'aws/codebuild/standard:7.0',
        computeType: 'BUILD_GENERAL1_SMALL',
        privilegedMode: true,
        environmentVariables: [
          { name: 'AWS_DEFAULT_REGION', value: region },
          { name: 'AWS_ACCOUNT_ID', value: accountId },
          { name: 'IMAGE_REPO_NAME', value: projectName }
        ]
      },
      serviceRole: `arn:aws:iam::${accountId}:role/CloudableCodeBuildRole`
    };

    try {
      await codeBuildClient.send(new CreateProjectCommand(projectConfig));
    } catch (error) {
      // Project might already exist, that's ok
    }

    // Step 5: Start build
    const startBuildResponse = await codeBuildClient.send(new StartBuildCommand({
      projectName: `cloudable-${projectName}`,
      sourceLocationOverride: `${bucketName}/${sourceKey}`,
      buildspecOverride: buildSpec
    }));

    const buildId = startBuildResponse.build?.id;

    res.json({
      success: true,
      message: 'Deployment started',
      data: {
        buildId,
        accountId,
        region,
        projectName,
        imageUri: `${accountId}.dkr.ecr.${region}.amazonaws.com/${projectName}:latest`
      }
    });

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Deployment failed'
    });
  }
});

// Fetch CloudWatch logs endpoint (MUST come BEFORE /:buildId to avoid route collision)
app.get('/api/deploy/status/logs', async (req, res) => {
  try {
    const { groupName, streamName, region = 'us-east-1' } = req.query;

    if (!groupName || !streamName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: groupName, streamName'
      });
    }

    const awsConfig = {
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    };

    const logsClient = new CloudWatchLogsClient(awsConfig);
    
    // Fetch the last 100 log events
    const response = await logsClient.send(new GetLogEventsCommand({
      logGroupName: groupName,
      logStreamName: streamName,
      startFromHead: false,
      limit: 100
    }));

    const logs = (response.events || []).map(event => event.message).filter(Boolean);

    res.json({
      success: true,
      data: { logs }
    });

  } catch (error) {
    console.error('Logs fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch logs'
    });
  }
});

// Check build status endpoint
app.get('/api/deploy/status/:buildId', async (req, res) => {
  try {
    const { buildId } = req.params;
    const region = req.query.region || 'us-east-1';

    const awsConfig = {
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    };

    const codeBuildClient = new CodeBuildClient(awsConfig);
    const response = await codeBuildClient.send(new BatchGetBuildsCommand({ ids: [buildId] }));
    const build = response.builds?.[0];

    if (!build) {
      return res.status(404).json({ success: false, error: 'Build not found' });
    }

    res.json({
      success: true,
      data: {
        status: build.buildStatus,
        phase: build.currentPhase,
        logs: {
          groupName: build.logs?.groupName,
          streamName: build.logs?.streamName
        }
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Status check failed'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cloudable API running on port ${PORT}`);
});

