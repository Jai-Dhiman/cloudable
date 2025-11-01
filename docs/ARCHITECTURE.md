# Architecture: Cloudable

## System Overview

Cloudable is a **multi-agent orchestration system** built on a modern TypeScript CLI framework. It combines intelligent code analysis, infrastructure planning, and cost monitoring into a seamless deployment experience.

**Core Design Principles**:

1. **Agent-based architecture**: Specialized agents handle distinct concerns
2. **Sponsor-first integration**: Built around hackathon sponsor tools
3. **AWS-native MVP**: Deep AWS integration, extensible to other clouds
4. **Human-in-the-loop**: Critical decisions require user confirmation
5. **Cost-aware by default**: Every decision considers cost implications

## Tech Stack

### CLI Framework

- **oclif** (v4.8.0): Enterprise CLI framework by Salesforce
  - Multi-command architecture
  - TypeScript-first with excellent DX
  - Auto-generated help and documentation
  - Plugin system for extensibility
- **Node.js** (v18+) with ES2022 modules
- **TypeScript** (v5.3.3) for type safety

### Multi-Agent Orchestration

- **Mastra**: Primary orchestration framework (hackathon sponsor)
  - Manages agent lifecycle and communication
  - Shared state management across agents
  - Event-driven coordination
  - Built-in fault tolerance and retries

### Sponsor Tool Integrations

#### 1. Composio (Cloud Integration)

- **Use**: AWS API access via MCP Gateway
- **Why**: 500+ pre-built integrations, including AWS services
- **What**:
  - EC2 instance creation and management
  - VPC/networking configuration
  - Security group rules
  - IAM role provisioning
  - CloudWatch cost data retrieval
- **Integration**: Mastra agents call Composio MCP tools for all AWS operations

#### 2. Moss (Codebase Analysis)

- **Use**: Semantic search and code understanding
- **Why**: Sub-10ms search performance, Rust/WASM powered
- **What**:
  - Framework detection (package.json, requirements.txt parsing)
  - Database pattern detection (ORM usage, connection strings)
  - WebSocket/real-time feature detection
  - File upload/storage pattern detection
  - Background job/queue detection
- **Integration**: Code Analyzer Agent uses Moss to understand codebase

#### 3. AgentMail (Cost Monitoring)

- **Use**: Email-based agent communication
- **Why**: Human-in-the-loop workflows via natural language
- **What**:
  - Weekly cost report emails (HTML formatted)
  - Bi-directional email conversations
  - Agent receives user commands via email replies
  - Confirmation workflows for destructive actions
- **Integration**: Cost Monitor Agent uses AgentMail for all user communications

#### 4. Hyperspell (Context) - Optional Enhancement

- **Use**: RAG pipeline for organizational memory
- **Why**: SOC 2 certified, maintains deployment patterns and decisions
- **What**: Learn from past deployments to improve recommendations
- **Integration**: Infrastructure Recommender Agent queries for similar past deployments

### Infrastructure as Code

- **Terraform**: AWS resource provisioning
- **CDKTF** (consideration): Programmatic Terraform generation in TypeScript
- **AWS SDK for JavaScript**: Supplementary operations (cost data, validation)

### Development Tools

- **bun**: Package manager (user preference over npm)
- **ts-node**: Development mode execution
- **TypeScript ESLint**: Code quality and consistency

## Agent Architecture

### Overview

Cloudable uses a **supervisor pattern** with 5 specialized agents orchestrated by Mastra:

```
        ┌─────────────────────┐
        │  Mastra Supervisor  │
        │  (Orchestration)    │
        └──────────┬──────────┘
                   │
        ┌──────────┴──────────┐
        │   Shared State      │
        │  (Analysis Results, │
        │   Terraform, Costs) │
        └──────────┬──────────┘
                   │
      ┌────────────┼────────────┬─────────────┬──────────────┐
      │            │            │             │              │
┌─────▼─────┐┌────▼─────┐┌────▼──────┐┌─────▼──────┐┌─────▼─────┐
│   Code    ││  Infra   ││ Terraform ││ Deployment ││   Cost    │
│ Analyzer  ││ Advisor  ││ Generator ││Coordinator ││  Monitor  │
│  Agent    ││  Agent   ││   Agent   ││   Agent    ││   Agent   │
└───────────┘└──────────┘└───────────┘└────────────┘└───────────┘
     │            │            │             │              │
  ┌──▼──┐     ┌──▼──┐     ┌──▼──┐      ┌───▼───┐     ┌────▼────┐
  │Moss │     │Rules│     │CDKTF│      │Composio│    │AgentMail│
  └─────┘     └─────┘     └─────┘      └───────┘     └─────────┘
```

### Agent Responsibilities

#### 1. Code Analyzer Agent

**Purpose**: Understand what the codebase needs from infrastructure

**Tools**: Moss (semantic search)

**Process**:

1. Detect framework and language (package.json, go.mod, requirements.txt)
2. Identify database usage (ORM imports, connection patterns)
3. Detect real-time features (WebSocket libraries, Socket.io)
4. Find file storage patterns (multer, file uploads, S3 SDK usage)
5. Identify compute needs (CPU-intensive operations, background jobs)

**Output**: Structured analysis of infrastructure requirements

```typescript
{
  framework: "next.js",
  language: "typescript",
  databases: ["postgresql"],
  features: ["websockets", "file-uploads"],
  estimatedLoad: "low" // based on architecture patterns
}
```

#### 2. Infrastructure Recommender Agent

**Purpose**: Translate code analysis into AWS service recommendations

**Inputs**:

- Code analysis results
- User-provided DAU and budget
- User preferences (domain, custom requirements)

**Process**:

1. Map requirements to AWS services:
   - Web app → EC2 instance (size based on DAU)
   - PostgreSQL → RDS PostgreSQL (or Aurora if high load)
   - File uploads → S3 bucket
   - WebSockets → ALB with sticky sessions or separate WebSocket server
2. Calculate instance sizing (t3.micro for <1k DAU, t3.small for <10k, etc.)
3. Estimate costs using AWS pricing APIs
4. Apply cost optimizations (VPC Endpoints vs NAT, gp3 vs gp2 storage)

**Output**: Infrastructure plan with cost estimates

```typescript
{
  compute: { service: "EC2", instanceType: "t3.small", count: 1 },
  database: { service: "RDS", engine: "postgres", instanceClass: "db.t3.micro" },
  storage: { service: "S3", estimatedGB: 100 },
  networking: { vpc: true, natGateway: false, vpcEndpoints: ["s3"] },
  estimatedMonthlyCost: 156.00
}
```

#### 3. Terraform Generator Agent

**Purpose**: Convert infrastructure plan into production-ready Terraform

**Process**:

1. Generate modular Terraform files:
   - `main.tf`: Provider and core resources
   - `vpc.tf`: Networking (VPC, subnets, route tables, security groups)
   - `compute.tf`: EC2 instances with user data scripts
   - `database.tf`: RDS instances (if needed)
   - `storage.tf`: S3 buckets with policies
   - `outputs.tf`: Deployed URLs and connection strings
   - `variables.tf`: Parameterized configuration
2. Apply security best practices:
   - Least privilege security groups (only necessary ports)
   - Encrypted EBS volumes and RDS
   - S3 bucket encryption and versioning
   - IAM roles with minimal permissions
3. Add cost optimization:
   - Reserved capacity recommendations in comments
   - Spot instance options where applicable
   - Lifecycle policies for S3

**Output**: Complete Terraform configuration ready to apply

#### 4. Deployment Coordinator Agent

**Purpose**: Execute deployment and validate results

**Tools**: Composio (AWS MCP integration)

**Process**:

1. Pre-flight checks:
   - Validate AWS credentials
   - Check quotas and limits
   - Verify no resource conflicts (existing resources with same names)
2. Terraform execution:
   - Initialize Terraform backend
   - Run `terraform plan` and show diff
   - Get user confirmation
   - Execute `terraform apply` with progress tracking
3. Post-deployment validation:
   - Health check on deployed URL
   - Verify database connectivity
   - Test S3 access
   - Validate security groups
4. Setup cost monitoring:
   - Enable CloudWatch Cost Explorer
   - Tag all resources with `cloudable:project` for cost tracking
   - Register deployment with Cost Monitor Agent

**Output**: Deployed URL and resource inventory

#### 5. Cost Monitor Agent

**Purpose**: Ongoing cost monitoring and human-in-the-loop control

**Tools**: AgentMail, Composio (AWS Cost Explorer API)

**Process**:

1. Weekly cost report generation (cron job or serverless function):
   - Fetch last 7 days actual costs from AWS Cost Explorer
   - Project next 7 days based on current run rate
   - Calculate monthly projection
   - Identify cost anomalies and red flags:
     - Resources with >80% idle time
     - Over-provisioned instances (low CPU/memory usage)
     - Expensive services (NAT Gateway, Load Balancers with low traffic)
2. Send email via AgentMail with actionable insights
3. Listen for email replies:
   - Parse natural language commands
   - Confirm destructive actions ("Are you sure you want to stop the NAT Gateway?")
   - Execute via Composio AWS APIs
   - Reply with confirmation and updated cost projections

**Output**: Weekly emails + on-demand cost control

## Data Flow

### Initial Deployment Flow

```
User runs: cloudable initialize
    ↓
CLI collects user inputs (cloud, DAU, domain, budget)
    ↓
Mastra launches Code Analyzer Agent
    ↓
Code Analyzer Agent → Moss → analyze codebase
    ↓
Results → Shared State → Infrastructure Recommender Agent
    ↓
Infrastructure Recommender generates AWS plan + cost estimate
    ↓
Plan → Terraform Generator Agent
    ↓
Terraform Generator creates .tf files
    ↓
CLI shows preview to user → User confirms
    ↓
Deployment Coordinator Agent → Composio → AWS APIs
    ↓
Terraform apply → EC2 instance running
    ↓
Deployment Coordinator validates deployment
    ↓
CLI returns URL to user
    ↓
Cost Monitor Agent registers deployment for weekly monitoring
```

### Cost Monitoring Flow

```
Weekly cron trigger
    ↓
Cost Monitor Agent → Composio → AWS Cost Explorer API
    ↓
Fetch cost data for all cloudable-tagged resources
    ↓
Analyze for anomalies and optimization opportunities
    ↓
Generate HTML email report
    ↓
AgentMail sends email to user
    ↓
User replies: "stop the NAT Gateway"
    ↓
AgentMail webhook → Cost Monitor Agent
    ↓
Parse command → "terminate NAT Gateway"
    ↓
Agent → AgentMail: "Confirm: Stop NAT Gateway? This will save $32/month but remove public egress."
    ↓
User confirms
    ↓
Agent → Composio → AWS API: delete NAT Gateway
    ↓
Agent → AgentMail: "✓ NAT Gateway stopped. New monthly projection: $176"
```

## AWS Integration

### Services Used (MVP)

- **EC2**: Primary compute for application hosting
- **VPC**: Isolated networking with public/private subnets
- **Security Groups**: Firewall rules (HTTP/HTTPS inbound, all outbound)
- **RDS**: PostgreSQL database (if detected in code)
- **S3**: Object storage (if file uploads detected)
- **CloudWatch**: Cost data via Cost Explorer API
- **IAM**: Roles and policies for EC2 instance profiles

### Composio Integration Pattern

```typescript
// Example: Deploy EC2 instance via Composio MCP
const ec2Action = await composio.actions.execute({
  action: "AWS_EC2_RUN_INSTANCES",
  params: {
    ImageId: "ami-0c55b159cbfafe1f0", // Amazon Linux 2023
    InstanceType: "t3.small",
    MinCount: 1,
    MaxCount: 1,
    SecurityGroupIds: [securityGroupId],
    SubnetId: publicSubnetId,
    TagSpecifications: [{
      ResourceType: "instance",
      Tags: [
        { Key: "Name", Value: "cloudable-app" },
        { Key: "cloudable:project", Value: projectId }
      ]
    }]
  }
});
```

### Cost Optimization Strategies

1. **VPC Endpoints over NAT Gateway**: Save $32/month for S3/DynamoDB access
2. **Right-sized instances**: Start small (t3.micro), scale based on metrics
3. **gp3 over gp2 EBS**: 20% cheaper storage with better performance
4. **RDS Single-AZ for dev**: Multi-AZ only for production
5. **S3 Intelligent Tiering**: Automatic cost optimization for infrequent access

## Security & Credentials

### Credential Management

- **AWS credentials**: Use AWS CLI profiles, never store in code
- **OS Keychain integration**: Store sensitive data in macOS Keychain / Windows Credential Manager / Linux Secret Service
- **Environment variables**: For CI/CD contexts
- **IAM best practices**:
  - Principle of least privilege
  - Instance profiles for EC2 (no hardcoded keys)
  - Temporary credentials via STS where possible

### Security Defaults

- All EBS volumes encrypted with AWS KMS
- RDS encryption at rest enabled
- S3 buckets private by default with encryption
- Security groups: minimal surface area (only HTTP/HTTPS, SSH from specific IPs)
- HTTPS enforced (redirect HTTP → HTTPS)

## Error Handling

User preference: **Explicit exception handling** (no silent fallbacks)

### Strategy

1. **Agent-level retries**: Network errors, transient AWS API failures (3 retries with exponential backoff)
2. **User-facing errors**: Clear, actionable messages
   - Bad: "Terraform apply failed"
   - Good: "EC2 instance creation failed: Insufficient capacity in us-east-1a. Try another AZ? (us-east-1b, us-east-1c)"
3. **Checkpointing**: Mastra state management allows resume from failure point
4. **Rollback**: Terraform destroy on critical failures (offer to user)
5. **Logging**: Structured logs for debugging (JSON format, CloudWatch integration for production)

### Example Error Flow

```typescript
try {
  await deploymentAgent.deployToAWS(terraformPlan);
} catch (error) {
  if (error.code === 'InsufficientInstanceCapacity') {
    // Explicit handling - ask user for alternative
    const altAZ = await cli.select({
      message: 'Insufficient capacity in us-east-1a. Choose alternative AZ:',
      choices: ['us-east-1b', 'us-east-1c', 'Different instance type']
    });
    // Retry with alternative
  } else {
    // Unexpected error - surface to user, don't hide
    throw new Error(`Deployment failed: ${error.message}. Check logs at ~/.cloudable/logs/`);
  }
}
```

## File Structure

```
cloudable/
├── src/
│   ├── commands/           # oclif CLI commands
│   │   ├── initialize.ts   # Main `cloudable initialize` command
│   │   ├── deploy.ts       # Manual deploy command
│   │   ├── cost-report.ts  # Generate cost report on-demand
│   │   └── destroy.ts      # Teardown infrastructure
│   ├── agents/             # Mastra agent definitions
│   │   ├── code-analyzer.ts
│   │   ├── infra-recommender.ts
│   │   ├── terraform-generator.ts
│   │   ├── deployment-coordinator.ts
│   │   └── cost-monitor.ts
│   ├── integrations/       # Sponsor tool integrations
│   │   ├── composio.ts     # AWS MCP wrapper
│   │   ├── moss.ts         # Code search wrapper
│   │   ├── agentmail.ts    # Email agent wrapper
│   │   └── hyperspell.ts   # RAG pipeline wrapper (optional)
│   ├── terraform/          # Terraform template generators
│   │   ├── aws/
│   │   │   ├── vpc.ts      # VPC module generator
│   │   │   ├── compute.ts  # EC2 module generator
│   │   │   ├── database.ts # RDS module generator
│   │   │   └── storage.ts  # S3 module generator
│   ├── utils/
│   │   ├── aws-pricing.ts  # Cost estimation utilities
│   │   ├── credentials.ts  # Credential management
│   │   └── logger.ts       # Structured logging
│   └── types/
│       └── index.ts        # TypeScript interfaces
├── templates/              # Static templates
│   └── email/
│       └── cost-report.html # AgentMail email template
├── bin/                    # oclif entry points
├── dist/                   # Compiled output
├── package.json
├── tsconfig.json
├── PRD.md
├── ARCHITECTURE.md         # This file
└── CLAUDE.md               # Agent context file
```

## Development Workflow

### Package Management

Use **bun** (user preference):

```bash
bun install
bun run dev
bun run build
```

### Local Development

```bash
# Run CLI in dev mode
bun run dev initialize

# Test specific agent
bun test src/agents/code-analyzer.test.ts

# Watch mode
bun run dev --watch
```

### Testing Strategy

- **Unit tests**: Each agent's logic in isolation
- **Integration tests**: Agent orchestration via Mastra
- **E2E tests**: Full deployment flow with mock AWS (LocalStack)
- **Cost estimation accuracy**: Compare generated estimates vs actual AWS pricing

## Future Extensibility

### Multi-Cloud (Post-MVP)

- Abstract cloud provider interface
- Separate modules: `src/terraform/gcp/`, `src/terraform/azure/`
- Cloud-agnostic agent prompts
- Provider selection in CLI

### Advanced Services (Post-MVP)

- Lambda/Cloud Functions: Serverless workload detection
- Kubernetes: Container orchestration for scale
- CDN: CloudFront/Cloudflare for static assets
- CI/CD: GitHub Actions / GitLab CI pipeline generation

## Monitoring & Observability

### For Hackathon Demo

- Console logs with rich formatting (colors, progress bars)
- Local log files: `~/.cloudable/logs/`

### Production-Ready

- CloudWatch Logs for all agent operations
- Metrics: deployment success rate, time to deploy, cost accuracy
- Alerts: deployment failures, cost anomalies
- APM: Instrument agents with OpenTelemetry

## Key Design Decisions

1. **TypeScript over Python**: Aligns with existing oclif scaffold, better npm ecosystem for CLI tools
2. **Mastra over LangGraph**: Hackathon sponsor, simpler API for multi-agent coordination
3. **Terraform over Pulumi/CDK**: Industry standard, wider adoption, easier to understand generated configs
4. **Email over Slack/Discord for cost control**: Lower barrier to entry, AgentMail provides agent-email bridge
5. **EC2 over Lambda for MVP**: Simpler deployment story, works for any app type
6. **AWS-only MVP**: Focus on depth over breadth, showcase multi-cloud architecture without implementing it

## Performance Targets

- **Time to first deployment**: < 15 minutes (including user input)
- **Codebase analysis**: < 30 seconds for typical app (10k-50k LOC)
- **Terraform generation**: < 10 seconds
- **AWS deployment**: 5-10 minutes (EC2 provisioning + setup)
- **Cost report generation**: < 5 seconds
- **Email command response**: < 30 seconds (agent processing + AWS API call)
