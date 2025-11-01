# Cloudable - Context for AI Agents

## What is Cloudable?

Cloudable is a **hackathon project** (2-4 day MVP) that helps junior engineers and early-stage startups deploy applications to AWS with intelligent cost monitoring.

**Core workflow**:
`cloudable initialize` → codebase analysis → interactive questions → Terraform generation → AWS deployment → weekly cost reports via email → human-in-the-loop cost control

**Key differentiator**: Multi-agent architecture that not only deploys infrastructure but proactively monitors costs and lets users control AWS resources via natural language email commands.

## Quick Links

- **[PRD.md](./PRD.md)**: Product requirements, user flow, MVP features, success criteria
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Technical architecture, agent design, sponsor integrations, AWS details
- **[RESEARCH.md](./RESEARCH.md)**: Comprehensive research document (original vision, may differ from MVP scope)

## Key Architecture Decisions

### Tech Stack
- **CLI**: oclif (TypeScript, already scaffolded)
- **Orchestration**: Mastra (multi-agent framework)
- **Cloud APIs**: Composio (AWS integration via MCP Gateway)
- **Code Analysis**: Moss (semantic search, sub-10ms performance)
- **Cost Monitoring**: AgentMail (email-based agent communication)
- **IaC**: Terraform generation (programmatic via CDKTF consideration)
- **Package Manager**: bun (user preference, currently using npm)

### 5-Agent Architecture
1. **Code Analyzer Agent** (Moss): Understands what the codebase needs
2. **Infrastructure Recommender Agent**: Maps requirements to AWS services
3. **Terraform Generator Agent**: Creates production-ready Terraform configs
4. **Deployment Coordinator Agent** (Composio): Executes deployment to AWS
5. **Cost Monitor Agent** (AgentMail): Weekly reports + human-in-the-loop cost control

### Sponsor Tool Integration (All Required for Hackathon)
- **Mastra**: Agent orchestration and state management
- **Composio**: AWS API access (EC2, VPC, RDS, S3, CloudWatch)
- **Moss**: Fast semantic codebase search for analysis
- **AgentMail**: Email-based cost reports and natural language commands
- *(Optional) Hyperspell*: RAG pipeline for deployment pattern memory
- *(Optional) Convex*: Backend if needed for agent state persistence

### AWS Services (MVP Scope)
- EC2 (primary compute)
- VPC + Security Groups (networking)
- RDS PostgreSQL (if database detected)
- S3 (if file storage detected)
- CloudWatch Cost Explorer (for cost monitoring)

## Development Guidelines

### Code Style
- **Error Handling**: Use explicit exception handling (user preference - no silent fallbacks)
- **Package Management**: Prefer bun over npm when adding dependencies
- **Emojis**: Never use in code, comments, or docs unless explicitly requested
- **Documentation**: Use Context7 MCP Server for up-to-date library docs when needed

### User Experience
- **Interactive Questions**: ≤5 questions during `initialize` (use smart defaults)
- **Progress Indicators**: Show agent progress (analyzing → planning → generating → deploying)
- **Confirmation Gates**: Always confirm before destructive actions
- **Error Messages**: Clear and actionable (e.g., "Insufficient capacity in us-east-1a. Try us-east-1b?")

### Security
- **Credentials**: Use AWS CLI profiles + OS keychain, never store in code
- **Defaults**: All resources encrypted, minimal security group rules, least privilege IAM
- **Validation**: Pre-flight checks before deployment (quotas, conflicts, credentials)

## Current State

**What exists**:
- oclif CLI scaffold with example `hello` command
- TypeScript configuration
- Basic project structure (`src/commands/`, `bin/`, `dist/`)

**What needs building** (for MVP):
- 5 agents with Mastra orchestration
- Sponsor tool integrations (Composio, Moss, AgentMail)
- `initialize` command with interactive questions
- Terraform generation modules (`vpc.ts`, `compute.ts`, `database.ts`, `storage.ts`)
- AWS deployment logic via Composio
- Cost monitoring agent with weekly email reports
- Email command parser for human-in-the-loop control

## File Structure Reference

```
src/
├── commands/          # oclif commands (initialize, deploy, cost-report, destroy)
├── agents/            # 5 Mastra agent definitions
├── integrations/      # Sponsor tool wrappers (composio, moss, agentmail)
├── terraform/         # Terraform template generators (aws/vpc, compute, database, storage)
├── utils/             # aws-pricing, credentials, logger
└── types/             # TypeScript interfaces
```

## Success Criteria (Hackathon Demo)

- [ ] Deploy working app to AWS EC2 in <15 minutes
- [ ] All 4 sponsor tools integrated (Mastra, Composio, Moss, AgentMail)
- [ ] Weekly cost email sent with accurate data
- [ ] Human-in-the-loop command works ("stop this service" terminates AWS resource)
- [ ] Valid, production-ready Terraform generated
- [ ] 3+ cost optimization recommendations

## Demo Flow (5 minutes)

1. Show Next.js + PostgreSQL sample app
2. Run `cloudable initialize` → answer 4 questions
3. Watch agents analyze → plan → generate → deploy
4. Show live URL with working app
5. Display "weekly email" (pre-seeded for demo)
6. Reply to email: "Stop the NAT Gateway"
7. Agent confirms + shows $32/month savings

## Important Notes for Development

- **MVP is AWS-only**: Architecture supports multi-cloud, but only implement AWS for hackathon
- **Focus on depth**: Better to have polished AWS deployment + cost monitoring than half-built multi-cloud
- **Agent-based is the differentiator**: The multi-agent intelligence is what makes Cloudable unique vs traditional IaC tools
- **Cost monitoring is core**: This isn't a nice-to-have feature - it's the primary value proposition alongside deployment
- **Sponsor integration is required**: All 4 tools (Mastra, Composio, Moss, AgentMail) must be meaningfully integrated for hackathon judging

## Useful Commands

```bash
# Development
bun run dev          # Run CLI in dev mode
bun test             # Run test suite
bun run build        # Compile TypeScript

# Using the CLI (once built)
cloudable initialize # Main command - analyze and deploy
cloudable destroy    # Teardown infrastructure
cloudable cost-report # Generate cost report on-demand
```

## Questions or Blockers?

Refer to:
- **Product questions**: See [PRD.md](./PRD.md)
- **Technical questions**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Original research**: See [RESEARCH.md](./RESEARCH.md) (note: may be more expansive than MVP scope)
