<div align="center">

# ![Rocket](https://img.icons8.com/?id=15152&format=png&size=24) Cloudable

![Deployment](https://img.icons8.com/?id=12005&format=png&size=64) ![Command Line](https://img.icons8.com/?id=19291&format=png&size=64) ![AWS](https://img.icons8.com/?id=Igd4E7P0RbCf&format=png&size=64)

**From code to production in one conversation, with costs under control.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

</div>

---

## ![Book](https://img.icons8.com/?id=114325&format=png&size=24) Overview

**Cloudable** is an intelligent CLI tool that helps junior engineers, vibe-coders, and early-stage startups deploy applications to AWS with intelligent cost monitoring and control. Built for hackathons and MVPs, Cloudable reduces deployment complexity from days to minutes while preventing unexpected cloud bills.

### ![Star](https://img.icons8.com/?id=19295&format=png&size=24) Key Features

| Feature | Description |
|--------|-------------|
| ![Code](https://img.icons8.com/?id=19293&format=png&size=32) **AI-Powered Code Analysis** | Analyzes your codebase using Moss semantic search and AI to understand infrastructure needs |
| ![Deployment](https://img.icons8.com/?id=12005&format=png&size=32) **Intelligent Infrastructure** | Generates production-ready Terraform configurations based on your codebase |
| ![Money](https://img.icons8.com/?id=13013&format=png&size=32) **Proactive Cost Monitoring** | Weekly email reports with cost projections and optimization recommendations |
| ![Robot](https://img.icons8.com/?id=9inONWn9EvfI&format=png&size=32) **Multi-Agent Intelligence** | Uses Mastra orchestration with 5 specialized agents for smart decisions |
| ![AWS](https://img.icons8.com/?id=Igd4E7P0RbCf&format=png&size=32) **AWS Integration** | Deep integration with AWS services via Composio |

---

## ![Goal](https://img.icons8.com/?id=63765&format=png&size=24) Problem It Solves

Early-stage teams face two critical challenges:

1. **Deployment Complexity**: Setting up cloud infrastructure requires deep DevOps knowledge
2. **Hidden Costs**: AWS bills can spiral out of control (unused NAT Gateways, idle instances, etc.)

Cloudable solves both by providing intelligent, cost-aware infrastructure recommendations and proactive monitoring.

---

## ![Rocket](https://img.icons8.com/?id=15152&format=png&size=24) Quick Start

### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- AWS Account (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/Jai-Dhiman/cloudable.git
cd cloudable

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Basic Usage

```bash
# Analyze your project
cloudable analyze

# Get AWS deployment recommendations
cloudable recommend

# Initialize and deploy to AWS
cloudable initialize
```

---

## ![Clipboard](https://img.icons8.com/?id=11864&format=png&size=24) Available Commands

### `analyze`
Analyze your project using AI to understand its structure and deployment needs.

```bash
cloudable analyze [path]
cloudable analyze /path/to/project
```

Analyzes your codebase and provides insights about:
- Framework detection
- Service requirements
- Build configurations
- Deployment recommendations

### `recommend`
Get AI-powered AWS deployment recommendations for your project.

```bash
cloudable recommend [path]
cloudable recommend /path/to/project
```

### `initialize`
Initialize and deploy your application to AWS with intelligent infrastructure recommendations.

```bash
cloudable initialize [path]
cloudable initialize --skip-questions
cloudable initialize --dry-run
```

**Options:**
- `--skip-questions` - Skip interactive questions and use defaults
- `--dry-run` - Generate Terraform without deploying

### `deploy`
Complete deployment: Build Docker image, push to registry, and deploy with Terraform to AWS EC2.

```bash
cloudable deploy <app-name>
cloudable deploy my-app --region us-west-2
cloudable deploy my-app --remote
```

**Options:**
- `--provider` - Cloud provider (aws, gcp, azure)
- `--region` - Cloud region (default: us-east-1)
- `--remote` - Use remote Docker builder

### `build`
Build Docker image and push to cloud registry (auto-generates Dockerfile with AI if needed).

```bash
cloudable build <app-name>
cloudable build my-app --region us-west-2
```

### `docker`
Generate Docker configurations using AI.

```bash
cloudable docker [path]
```

### `setup`
Interactive setup for AWS credentials and configuration.

```bash
cloudable setup
```

### `setup-remote`
Setup AWS IAM role for remote Docker builds.

```bash
cloudable setup-remote
```

---

## ![Construction](https://img.icons8.com/?id=WCHDg9c5GuRM&format=png&size=24) Architecture

Cloudable uses a **multi-agent orchestration system** powered by:

- **Mastra**: Agent orchestration and state management
- **Moss**: Semantic code search and analysis
- **Composio**: AWS API integration
- **AgentMail**: Email-based cost monitoring and control
- **Hyperspell**: RAG pipeline for intelligent recommendations

### Agent System

1. **Code Analyzer Agent**: Understands codebase structure and requirements
2. **Infrastructure Recommender Agent**: Maps requirements to AWS services
3. **Terraform Generator Agent**: Creates production-ready Terraform configs
4. **Deployment Coordinator Agent**: Executes deployment via Composio
5. **Cost Monitor Agent**: Weekly reports + human-in-the-loop cost control

---

## ![Innovation](https://img.icons8.com/?id=33470&format=png&size=24) Features in Detail

### ![Robot](https://img.icons8.com/?id=9inONWn9EvfI&format=png&size=24) AI-Powered Analysis
- Framework detection (Next.js, Django, React, Express, etc.)
- Dependency analysis
- Service requirements detection (databases, cache, storage, queues)
- Build configuration detection
- Environment variable detection

### ![Analytics](https://img.icons8.com/?id=SROvvC91x7DL&format=png&size=24) Cost Monitoring
- Weekly email reports with cost breakdown
- Cost projections and anomaly detection
- Human-in-the-loop cost control via email
- Automatic optimization recommendations

### ![Analytics](https://img.icons8.com/?id=SROvvC91x7DL&format=png&size=24) Detailed Analysis
Get comprehensive insights about your project:
- Framework and runtime detection
- Service dependencies (databases, cache, storage)
- Build and deployment configurations
- Environment variable requirements
- Confidence scoring for analysis accuracy

### ![AWS](https://img.icons8.com/?id=Igd4E7P0RbCf&format=png&size=24) AWS Integration
- EC2 deployment
- VPC/networking configuration
- Security group management
- IAM role provisioning
- CloudWatch integration
- Cost Explorer integration

---

## ![Tools](https://img.icons8.com/?id=13121&format=png&size=24) Development

### Project Structure

```
cloudable/
├── bin/                    # Entry point scripts
│   ├── dev.js             # Development mode
│   └── run.js             # Production mode
├── src/                   # TypeScript source files
│   ├── commands/          # CLI commands
│   ├── agents/            # Mastra agent definitions
│   ├── analyzers/         # Code analysis modules
│   ├── integrations/      # Sponsor tool wrappers
│   ├── terraform/         # Terraform generators
│   └── services/          # Core services
├── docs/                  # Documentation
└── dist/                  # Compiled output
```

### Development Workflow

```bash
# Run in development mode (auto-compiles TypeScript)
npm run dev [COMMAND]

# Build for production
npm run build

# Run production build
npm run start [COMMAND]
```

### Adding a New Command

Create a new file in `src/commands/`:

```typescript
import {Args, Command, Flags} from '@oclif/core'

export default class MyCommand extends Command {
  static description = 'Description of your command'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  async run(): Promise<void> {
    // Your command logic
  }
}
```

---

## ![Settings](https://img.icons8.com/?id=12784&format=png&size=24) Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1

# OpenAI (for AI analysis)
OPENAI_API_KEY=your_openai_key

# AgentMail (for cost monitoring)
AGENTMAIL_API_KEY=your_agentmail_key
```

### AWS Setup

1. Run `cloudable setup` for interactive AWS credential configuration
2. Ensure your AWS account has necessary permissions for EC2, VPC, IAM, etc.

---

## ![Book](https://img.icons8.com/?id=114325&format=png&size=24) Documentation

- **[Product Requirements Document](./docs/PRD.md)** - Full product vision and requirements
- **[Architecture Documentation](./docs/ARCHITECTURE.md)** - Technical architecture details
- **[Research Document](./docs/RESEARCH.md)** - Background research and design decisions

---

## ![Link](https://img.icons8.com/?id=12312&format=png&size=24) Integrations

Cloudable integrates with:

- **AWS**: Full AWS SDK integration for deployment and monitoring
- **Composio**: AWS API access via MCP Gateway
- **Moss**: Semantic code search and analysis
- **AgentMail**: Email-based agent communication for cost control
- **Hyperspell**: RAG pipeline for intelligent recommendations
- **Mastra**: Multi-agent orchestration framework

---

## ![Handshake](https://img.icons8.com/?id=12208&format=png&size=24) Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and commit: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

---

## ![Memo](https://img.icons8.com/?id=12053&format=png&size=24) License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ![Users](https://img.icons8.com/?id=37913&format=png&size=24) Authors

- **Bikash Pokharel** (Dpakkk) - *Original Author & Creator*
- **Jai Dhiman** - *Maintainer & Core Developer*
- **Luke Pettit** - *Contributor*
- **Nihal Nihalani** - *Contributor*

---

## ![Bug](https://img.icons8.com/?id=13449&format=png&size=24) Issues

Found a bug or have a feature request? Please open an issue at:
https://github.com/Jai-Dhiman/cloudable/issues

---

## ![Star](https://img.icons8.com/?id=19295&format=png&size=24) Acknowledgments

- Built with [oclif](https://oclif.io) - Enterprise CLI framework
- Powered by [Mastra](https://mastra.ai) - Multi-agent orchestration
- Icon assets from [Icons8](https://icons8.com)

---

<div align="center">

**Made with ![Heart](https://img.icons8.com/?id=19411&format=png&size=16) for developers who just want to ship**

[![Star](https://img.icons8.com/?id=19295&format=png&size=16) Star us on GitHub](https://github.com/Jai-Dhiman/cloudable)

</div>
