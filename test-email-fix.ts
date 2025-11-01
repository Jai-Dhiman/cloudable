/**
 * Test script to verify email monitoring fixes
 * This simulates the email reply flow to ensure we're fetching full message content
 */

import { AgentMailClient } from './src/integrations/agentmail.js';
import { EmailMonitorService } from './src/services/email-monitor.js';

async function testEmailFix() {
  console.log('Testing Email Monitoring Fix...\n');

  try {
    // Initialize AgentMail client
    const agentMail = new AgentMailClient();
    await agentMail.initialize('cloudable-test');
    console.log('✓ AgentMail initialized');

    // Test getMessage method exists
    const inboxId = agentMail.getDefaultInboxId();
    console.log(`✓ Default inbox: ${inboxId}`);

    // List recent messages
    const messages = await agentMail.listMessages(undefined, { limit: 5 });
    console.log(`✓ Found ${messages.length} messages in inbox`);

    if (messages.length > 0) {
      const testMessage = messages[0];
      const messageId = testMessage.messageId || testMessage.message_id;

      console.log(`\nTesting full message fetch for: ${messageId}`);

      // Fetch full message (this is the fix)
      const fullMessage = await agentMail.getMessage(messageId);

      const bodyText = fullMessage.text || fullMessage.body || fullMessage.plaintext || "";

      console.log(`✓ Full message fetched`);
      console.log(`  - Message ID: ${messageId}`);
      console.log(`  - From: ${fullMessage.from}`);
      console.log(`  - Subject: ${fullMessage.subject}`);
      console.log(`  - Body length: ${bodyText.length} characters`);
      console.log(`  - Body preview: ${bodyText.substring(0, 100)}...`);

      if (bodyText.length > 0) {
        console.log('\n✅ SUCCESS: Email body is now being fetched correctly!');
      } else {
        console.log('\n⚠️  WARNING: Email body is still empty (might be an empty message)');
      }
    } else {
      console.log('\n⚠️  No messages in inbox to test with');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run test
testEmailFix();
