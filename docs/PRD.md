# Product Requirements Document: Cloudable

## Overview

**Cloudable** is a CLI tool that helps junior engineers, vibe-coders, and early-stage startups deploy applications to AWS with intelligent cost monitoring and control. Built for hackathons and MVPs, Cloudable reduces deployment complexity from days to minutes while preventing unexpected cloud bills.

## Problem Statement

Early-stage teams face two critical challenges:

1. **Deployment Complexity**: Setting up cloud infrastructure requires deep DevOps knowledge. Choosing the right services, configuring networking, security groups, and IaC is overwhelming for developers who just want to ship.

2. **Hidden Costs**: AWS bills can spiral out of control. Unused NAT Gateways ($2,250/month), idle instances, and misconfigured services drain startup budgets. By the time teams notice, they've already overspent.

**Current solutions are fragmented**: Terraform requires expertise, AWS Console is manual and error-prone, and cost monitoring tools are reactive, not proactive.

## Product Vision

**"From code to production in one conversation, with costs under control."**

Cloudable is an intelligent CLI that:

- Analyzes your codebase to understand infrastructure needs
- Asks smart questions and provides recommendations
- Generates and deploys production-ready Terraform for AWS
- Monitors costs weekly and empowers you to control spend via email

## Target Users

1. **Junior Engineers / Vibe-Coders**: Developers with application skills but limited DevOps experience
2. **Hackathon Participants**: Teams needing fast, reliable deployments for demos
3. **Early-Stage Startups**: Small teams focused on product, not infrastructure
4. **Technical Founders**: Solo founders who need deployment without DevOps hiring

## User Flow

### Initial Deployment

```
$ cloudable initialize

→ Analyzes codebase (framework detection, dependencies, architecture patterns)
→ Asks interactive questions:
   - Preferred cloud provider? [AWS (recommended for hackathons)]
   - Expected daily active users? [helps size infrastructure]
   - Custom domain? [Domain provider if yes]
   - Monthly budget? [provides cost-aware recommendations]

→ Agent-based infrastructure planning
→ Generates Terraform configuration
→ Previews infrastructure and estimated costs
→ Confirms with user
→ Deploys to AWS EC2
→ Returns deployed URL

✓ Your app is live at: https://ec2-xx-xxx-xxx-xx.compute-1.amazonaws.com
✓ Cost monitoring enabled - weekly reports will be sent to your email
```

### Ongoing Cost Monitoring

```
Weekly email (via AgentMail):
---
Subject: Cloudable Cost Report - Week of Oct 28

Last week cost: $47.23
Next week expected: $52.00
Monthly projection: $208.00

⚠️ Red Flags:
- NAT Gateway running 24/7 ($32/month) - Consider VPC Endpoints
- t3.medium instance at 12% CPU - Downsize to t3.small?

Reply to this email to take action →
---

User replies: "Hey, stop the NAT Gateway and downsize the instance"

→ Agent confirms actions
→ Agent uses Composio to modify AWS resources
→ Agent replies with confirmation and new cost projections
```

## Core Features (MVP)

### 1. Interactive CLI Initialization

- Smart defaults with context-aware recommendations
- Framework detection (Node.js, Python, Go, etc.)
- Progressive disclosure (only ask necessary questions)
- Rich terminal UI with progress indicators

### 2. Intelligent Codebase Analysis

- **Moss-powered** semantic search to understand code patterns
- Detects: databases, WebSockets, file storage, scheduled jobs, ML workloads
- Maps code patterns to infrastructure requirements

### 3. Multi-Agent Infrastructure Planning

- **Mastra orchestration** for 5 specialized agents:
  - Code Analyzer Agent
  - Infrastructure Recommender Agent
  - Terraform Generator Agent
  - Deployment Coordinator Agent
  - Cost Monitor Agent
- Agents collaborate to make intelligent decisions

### 4. AWS Terraform Generation

- Production-ready configurations for:
  - EC2 instances (right-sized based on DAU)
  - VPC and networking (subnets, security groups, routing)
  - RDS databases (if detected in code)
  - S3 buckets (if file storage detected)
- Security best practices built-in (least privilege IAM, encrypted storage)

### 5. One-Command Deployment

- **Composio MCP Gateway** for AWS API integration
- Terraform apply with progress tracking
- DNS configuration (if custom domain provided)
- Health checks and validation
- Returns live URL

### 6. Weekly Cost Reports

- **AgentMail-powered** email reports with:
  - Last week actual costs
  - Next week projected costs
  - Monthly projection
  - Cost breakdown by service
  - Red flags (idle resources, over-provisioned instances, expensive services)

### 7. Human-in-the-Loop Cost Control

- Natural language commands via email reply
- "Stop this service" → Agent terminates AWS resources
- "Downsize the database" → Agent modifies RDS instance class
- "Show me what's running" → Agent lists all active resources
- Confirmation workflow (agent asks before destructive actions)

## Success Metrics (Hackathon Demo)

### User Experience

- [ ] Time to first deployment: < 15 minutes (from `cloudable initialize` to live URL)
- [ ] Questions asked: ≤ 5 (intelligent defaults reduce decision fatigue)
- [ ] Valid Terraform generated for real-world app

### Technical Achievement

- [ ] 5 agents orchestrated via Mastra
- [ ] 4 sponsor tools integrated (Mastra, Composio, Moss, AgentMail)
- [ ] Working AWS deployment (EC2 + VPC + Security Groups)
- [ ] Cost report email sent with accurate data
- [ ] Agent successfully handles 1+ email command ("stop this service")

### Cost Intelligence

- [ ] Identifies 3+ cost optimization opportunities
- [ ] Provides accurate cost projections (within 10% of actual AWS estimates)
- [ ] Demonstrates cost savings scenario (before/after)

## Out of Scope (MVP)

### Phase 2 Features

- GCP and Azure support (architecture supports it, not implemented)
- Advanced services (Lambda, ECS, Kubernetes, CDN)
- CI/CD pipeline generation
- Multi-environment management (staging, production)
- Team collaboration and shared state
- Custom Terraform module templates
- Mobile app for cost alerts

### Explicitly Not Building

- Visual infrastructure designer (CLI-first)
- Cloud provider account creation (assumes user has AWS account)
- Cost prediction ML models (use AWS Cost Explorer APIs)
- Automated performance tuning (manual recommendations only)

## Key Differentiators

1. **Agent-Based Intelligence**: Unlike traditional IaC tools, Cloudable uses multi-agent systems to understand context and make smart recommendations
2. **Proactive Cost Control**: Not just monitoring - agents can take action based on natural language commands
3. **Zero-to-Production Speed**: Reduces 2-3 days of DevOps work to 15 minutes
4. **Opinionated Best Practices**: Security, cost optimization, and reliability built-in by default

## Timeline

**Day 1**: Core CLI + Mastra agent orchestration + Moss codebase analysis
**Day 2**: Terraform generation + Composio AWS integration + EC2 deployment
**Day 3**: AgentMail cost monitoring + weekly reports + human-in-the-loop commands
**Day 4**: Polish, testing, demo scenario preparation

## Demo Scenario

**The Pitch**:
"Watch us deploy a full-stack app to AWS and control costs through email - all in under 5 minutes."

**Demo Flow**:

1. Show sample app codebase (Next.js + PostgreSQL)
2. Run `cloudable initialize`
3. Answer 4 questions in 30 seconds
4. Watch agents analyze, plan, generate Terraform
5. Confirm and deploy
6. Show live URL with working app
7. Fast-forward to "weekly email" (pre-seeded)
8. Reply to email: "Stop the NAT Gateway"
9. Agent confirms and shows new cost projection ($176/month → $144/month savings)

**Tagline**: "Deployment should be a conversation, not a configuration nightmare."
