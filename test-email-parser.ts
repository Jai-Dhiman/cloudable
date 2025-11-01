import { EmailCommandParser } from './src/utils/email-parser.js';
import type { EmailCommandContext } from './src/types/cost-monitor.js';

// Test case 1: Email with quoted text (the problematic case)
const emailWithQuotedText: EmailCommandContext = {
  messageId: 'test-1',
  threadId: 'thread-1',
  from: 'user@example.com',
  subject: 'Re: Cost Report',
  bodyText: `Show me more details about EC2 costs

On Sat, Nov 1, 2025 at 8:25 AM AgentMail <cloudable-cost-reports@agentmail.to> wrote:

> 🚨 Weekly Cost Report: $170.74 ↑ 22.6% - 1 Critical Issue
>
> Generated on 11/1/2025, 8:25:43 AM
> Cost Summary
> Current Week $170.74
> Previous Week $139.20
> Change +22.6%
> Monthly Projection
> $803.32
> Top 3 Cost Optimization Recommendations
> 1
> Enable AWS Cost Anomaly Detection
> Est. Savings: $0.00/month (preventive)
> 2
> Review unused EBS volumes
> Est. Savings: $15.00/month (estimated)
> 3
> Consider Reserved Instances for stable workloads
> Est. Savings: $50.00/month (estimated)
> Reply to this email to take action
>
> You can control your AWS resources by simply replying to this email with
> natural language commands.
> *Example commands:* "Stop the NAT Gateway" "Approve recommendation #1" "Show
> me more details about EC2 costs"`,
  receivedAt: new Date().toISOString(),
};

// Test case 2: Simple command without quoted text
const simpleCommand: EmailCommandContext = {
  messageId: 'test-2',
  threadId: 'thread-2',
  from: 'user@example.com',
  subject: 'Re: Cost Report',
  bodyText: 'Stop the NAT Gateway',
  receivedAt: new Date().toISOString(),
};

// Test case 3: Approve recommendation command
const approveCommand: EmailCommandContext = {
  messageId: 'test-3',
  threadId: 'thread-3',
  from: 'user@example.com',
  subject: 'Re: Cost Report',
  bodyText: 'Approve recommendation #1',
  receivedAt: new Date().toISOString(),
};

console.log('\n=== Test Case 1: Email with Quoted Text ===');
const parsed1 = EmailCommandParser.parse(emailWithQuotedText);
console.log('Intent:', parsed1.intent);
console.log('Confidence:', `${(parsed1.confidence * 100).toFixed(1)}%`);
console.log('Resource Type:', parsed1.resourceType);
console.log('Requires Confirmation:', parsed1.requiresConfirmation);
console.log('Summary:', EmailCommandParser.summarize(parsed1));
console.log('✅ Expected: get_details intent for EC2');
console.log(`${parsed1.intent === 'get_details' && parsed1.resourceType === 'EC2' ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('\n=== Test Case 2: Simple Stop Command ===');
const parsed2 = EmailCommandParser.parse(simpleCommand);
console.log('Intent:', parsed2.intent);
console.log('Confidence:', `${(parsed2.confidence * 100).toFixed(1)}%`);
console.log('Resource Type:', parsed2.resourceType);
console.log('Resource ID:', parsed2.resourceId);
console.log('Requires Confirmation:', parsed2.requiresConfirmation);
console.log('Summary:', EmailCommandParser.summarize(parsed2));
console.log('✅ Expected: stop_resource intent');
const hasNATGateway = parsed2.resourceType === 'NAT Gateway' || (parsed2.resourceId && parsed2.resourceId.toLowerCase().includes('nat'));
console.log(`${parsed2.intent === 'stop_resource' && hasNATGateway ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('\n=== Test Case 3: Approve Recommendation ===');
const parsed3 = EmailCommandParser.parse(approveCommand);
console.log('Intent:', parsed3.intent);
console.log('Confidence:', `${(parsed3.confidence * 100).toFixed(1)}%`);
console.log('Recommendation ID:', parsed3.recommendationId);
console.log('Requires Confirmation:', parsed3.requiresConfirmation);
console.log('Summary:', EmailCommandParser.summarize(parsed3));
console.log('✅ Expected: approve_recommendation with recommendation ID 1');
console.log(`${parsed3.intent === 'approve_recommendation' && parsed3.recommendationId === '1' ? '✅ PASS' : '❌ FAIL'}\n`);

// Test the quoted text removal directly
console.log('\n=== Test Case 4: Quoted Text Removal ===');
const testText = `My actual reply

On ... wrote:
> quoted text
> more quoted text`;

console.log('Original text:', testText);
// Access private method via any cast for testing
const cleaned = (EmailCommandParser as any).removeQuotedText(testText);
console.log('Cleaned text:', cleaned);
console.log(`${cleaned.includes('My actual reply') && !cleaned.includes('quoted text') ? '✅ PASS' : '❌ FAIL'}\n`);

// Test the ambiguity detection
console.log('\n=== Test Case 5: Ambiguity Detection ===');
console.log('Test 1 (with quoted text) - should NOT be ambiguous:');
console.log('  Is ambiguous?', EmailCommandParser.isAmbiguous(parsed1));
console.log(`  ${!EmailCommandParser.isAmbiguous(parsed1) ? '✅ PASS' : '❌ FAIL'}`);

console.log('Test 2 (stop command) - should NOT be ambiguous:');
console.log('  Is ambiguous?', EmailCommandParser.isAmbiguous(parsed2));
console.log(`  ${!EmailCommandParser.isAmbiguous(parsed2) ? '✅ PASS' : '❌ FAIL'}`);

console.log('Test 3 (approve rec) - should NOT be ambiguous:');
console.log('  Is ambiguous?', EmailCommandParser.isAmbiguous(parsed3));
console.log(`  ${!EmailCommandParser.isAmbiguous(parsed3) ? '✅ PASS' : '❌ FAIL'}\n`);
