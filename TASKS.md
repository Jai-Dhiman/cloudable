# CLOUDABLE IMPLEMENTATION TASKS

## From C-Tier to Ferrari: 7-Day Sprint Plan

**Goal:** Deliver on the PRD promise - "From code to production in one conversation, with costs under control."

**Current State:** Excellent cost monitoring system, missing core deployment workflow.

**Target State:** Full end-to-end working demo with all sponsor integrations meaningfully utilized.

---

## PART 1: CORE DEPLOYMENT WORKFLOW (Days 1-4)

### Philosophy

Build the "initialize → deploy" workflow first. This is your core value proposition. Cost monitoring is already done - just needs activation.

### Success Criteria

- `cloudable initialize` completes without errors
- Interactive Q&A works (5 questions, smart defaults)
- All 5 agents implemented and orchestrated via Mastra
- Terraform files generated on disk
- AWS deployment executes via Composio
- Returns live EC2 URL
- Can deploy a real Next.js + PostgreSQL app in < 15 minutes

---

## DAY 1: Agent Foundation & Mastra Orchestration

### Morning (4 hours): Set Up Proper Mastra Architecture

#### Task 1.1: Create Agent Base Structure (1 hour)

**File:** `src/agents/base-agent.ts`

**Requirements:**

- [ ] Create BaseAgent abstract class that wraps Mastra Agent
- [ ] Define AgentConfig interface with name, instructions, model fields
- [ ] Define AgentState interface matching orchestrator expectations (projectId, projectPath, codeAnalysis, userAnswers, infraRecommendation, terraformConfigs, dockerConfigs, dnsSetup, validationResult, deploymentResult, errors)
- [ ] BaseAgent constructor should initialize Mastra Agent with OpenAI provider
- [ ] Abstract execute method that takes AgentState and returns Promise<AgentState>
- [ ] Handle OpenAI API key loading from environment

**Acceptance Criteria:**

- [ ] BaseAgent class compiles without errors
- [ ] Can instantiate a test agent that extends BaseAgent
- [ ] AgentState interface has all fields needed by orchestrator
- [ ] OpenAI integration works with API key from env

---

#### Task 1.2: Implement Code Analyzer Agent (1.5 hours)

**File:** `src/agents/code-analyzer.ts`

**Requirements:**

- [ ] Create CodeAnalyzerAgent class extending BaseAgent
- [ ] Implement Moss semantic search integration for codebase indexing
- [ ] Create index of all project files with Moss SDK
- [ ] Query Moss for infrastructure patterns: database connections, authentication, file uploads, websockets, background jobs
- [ ] Map Moss query results to infrastructure requirements
- [ ] Fall back to existing AIProjectAnalyzer if Moss fails or is unavailable
- [ ] Detect framework, language, package manager from file analysis
- [ ] Extract dependencies from package.json/requirements.txt/go.mod
- [ ] Return structured CodeAnalysis object with all detected features
- [ ] Export executeCodeAnalyzer function that takes state and projectPath

**Acceptance Criteria:**

- [ ] Moss creates index successfully for sample project
- [ ] Semantic queries return relevant code snippets
- [ ] Correctly identifies databases (postgresql, mysql, mongodb) from code patterns
- [ ] Correctly identifies features (auth, file uploads, websockets, background jobs)
- [ ] Falls back gracefully if Moss unavailable
- [ ] Test with Next.js + PostgreSQL sample project shows correct analysis
- [ ] CodeAnalysis object matches type definition in src/types/

---

#### Task 1.3: Implement Infrastructure Recommender Agent (1.5 hours)

**File:** `src/agents/infra-recommender.ts`

**Requirements:**

- [ ] Create InfraRecommenderAgent class extending BaseAgent
- [ ] Initialize and query Hyperspell for similar past deployment patterns
- [ ] Query Hyperspell with framework name and detected databases
- [ ] Use Hyperspell patterns to inform recommendations when available
- [ ] Implement DAU-based instance sizing logic (< 100 → t3.micro, < 1000 → t3.small, < 10000 → t3.medium, else t3.large)
- [ ] Map code analysis features to AWS services (databases → RDS, file uploads → S3, etc)
- [ ] Calculate database instance class based on DAU and detected database type
- [ ] Decide on networking strategy (prefer VPC endpoints over NAT Gateway to save costs)
- [ ] Use existing AWS cost estimation utilities to calculate monthly costs
- [ ] Return InfrastructureRecommendation with detailed service breakdown and cost estimates
- [ ] Export executeInfraRecommender function

**Acceptance Criteria:**

- [ ] Queries Hyperspell deployment_patterns collection successfully
- [ ] Falls back to rule-based recommendations if no patterns found
- [ ] Instance sizing is appropriate for given DAU ranges
- [ ] Cost estimates are within 10% of actual AWS pricing
- [ ] Recommends VPC endpoints instead of NAT Gateway when S3 is needed
- [ ] Returns complete InfrastructureRecommendation object
- [ ] Test with various DAU inputs produces sensible recommendations

---

### Afternoon (4 hours): Terraform Generation & User Input

#### Task 1.4: Implement Interactive Questions (1 hour)

**File:** `src/commands/initialize.ts` (update existing)

**Requirements:**

- [ ] Import inquirer package (already in dependencies)
- [ ] Create 5 interactive questions: cloud provider, expected DAU, budget, custom domain, AWS region
- [ ] Set sensible defaults for all questions (AWS, 100 DAU, $50 budget, empty domain, us-east-1)
- [ ] Add validation to ensure DAU and budget are positive numbers
- [ ] Store answers in state.userAnswers object
- [ ] Support --skip-questions flag to use all defaults
- [ ] Display questions with clear formatting using chalk colors
- [ ] Show current defaults in question prompts

**Acceptance Criteria:**

- [ ] Questions appear with proper formatting
- [ ] User can press Enter to accept defaults
- [ ] Validation prevents invalid inputs
- [ ] Answers are properly stored in state
- [ ] --skip-questions flag bypasses prompts and uses defaults
- [ ] Questions complete in under 1 minute for user

---

#### Task 1.7: Update Orchestrator to Use Real Agents (1 hour)

**File:** `src/orchestrator.ts` (replace existing)

**Requirements:**

- [ ] Import all agent classes (CodeAnalyzerAgent, InfraRecommenderAgent, TerraformGeneratorAgent, DeploymentCoordinatorAgent)
- [ ] Instantiate all agent classes
- [ ] Initialize Mastra instance with agents registered by name
- [ ] In orchestrateCloudableWorkflow function, initialize AgentState with projectId and projectPath
- [ ] Execute CodeAnalyzerAgent and update state, display progress
- [ ] Execute InfraRecommenderAgent and update state, display progress
- [ ] Execute TerraformGeneratorAgent and update state, display progress
- [ ] Execute DeploymentCoordinatorAgent and update state, display progress
- [ ] Wrap all agent executions in try-catch blocks
- [ ] Store errors in state.errors array
- [ ] Use ora spinners for progress indication
- [ ] Use chalk for colored output
- [ ] Return final state after all agents complete
- [ ] Export mastra instance for use elsewhere

**Acceptance Criteria:**

- [ ] Mastra instance has all 4 agents registered
- [ ] Agents execute sequentially with state passing between them
- [ ] Progress indicators show current agent and status
- [ ] Errors are caught and stored in state
- [ ] Console output is clear and colorized
- [ ] State flows correctly through all agents
- [ ] Can run full orchestration without crashes

#### Task 2.8: CLI Polish & Error Handling (1 hour)

**File:** `src/commands/initialize.ts` (update)

**Requirements:**

- [ ] After Terraform generation, display formatted cost breakdown
- [ ] Show cost for each service (EC2, RDS, S3, networking)
- [ ] Show total monthly cost in bold
- [ ] Add confirmation prompt before deployment: "Proceed with deployment?"
- [ ] Allow user to cancel and save Terraform files without deploying
- [ ] Wrap deployment in try-catch block
- [ ] On deployment error, display helpful error message
- [ ] On deployment error, offer rollback option via confirmation prompt
- [ ] If user chooses rollback, run terraform destroy or Composio cleanup
- [ ] Display final success message with URL in green
- [ ] Display cost monitoring activation message
- [ ] Add --dry-run flag to generate Terraform without deploying

**Acceptance Criteria:**

- [ ] Cost preview is clear and formatted nicely
- [ ] User can cancel before deployment
- [ ] Terraform files saved even if user cancels
- [ ] Errors display helpful messages with next steps
- [ ] Rollback option works correctly
- [ ] Success message is prominent and includes URL
- [ ] --dry-run flag works for testing without AWS costs
