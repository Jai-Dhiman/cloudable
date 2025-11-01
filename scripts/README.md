# Scripts

Demo and test scripts for the cost analysis system.

## Demo Mode (For Hackathon)

### Generate JSON Report

```bash
npx tsx scripts/generate-demo-report.ts > demo-report.json
```

Generates a complete JSON report with dummy AWS data. Perfect for testing PDF/email generation without AWS credentials.

### Run Demo Analysis

```bash
npx tsx scripts/test-demo-mode.ts
```

Runs full cost analysis in demo mode with formatted console output showing:

- Cost summary and projections
- Red flags detected
- Recommendations
- What's real vs dummy data

## Testing with Real AWS

### Full Cost Analysis Test

```bash
npx tsx scripts/test-cost-analysis.ts
```

Requires AWS credentials. Tests:

- AWS Cost Explorer integration
- All 4 red flag detectors
- Cost projections
- Hyperspell learning

## Output Examples

### JSON Report Structure

```bash
npx tsx scripts/generate-demo-report.ts 2>/dev/null | jq '.emailSubject'
npx tsx scripts/generate-demo-report.ts 2>/dev/null | jq '.redFlags.summary'
npx tsx scripts/generate-demo-report.ts 2>/dev/null | jq '.projections.monthly'
```

## Environment Variables

For real AWS testing:

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
export HYPERSPELL_API_KEY=your_key
```

For demo mode: No environment variables needed!
