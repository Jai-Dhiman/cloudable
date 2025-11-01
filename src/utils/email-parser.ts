/**
 * Email Command Parser
 * Natural language parser for human-in-the-loop email commands
 */

import type {
	EmailCommandIntent,
	ParsedEmailCommand,
	EmailCommandContext,
} from "../types/cost-monitor.js";

/**
 * Email Command Parser
 * Extracts intent and entities from natural language email commands
 */
export class EmailCommandParser {
	// Command patterns for intent detection
	private static readonly INTENT_PATTERNS: Record<
		EmailCommandIntent,
		Array<RegExp | string>
	> = {
		approve_recommendation: [
			/\b(approve|accept|yes|confirm|ok|okay|proceed)\b/i,
			/\b(do it|go ahead|sounds good)\b/i,
			/\b(recommendation\s*#?\s*\d+)/i,
		],
		reject_recommendation: [
			/\b(reject|decline|no|cancel|stop|deny)\b/i,
			/\b(don't|do not|not interested)\b/i,
			/\b(skip this|pass)\b/i,
		],
		stop_resource: [
			/\b(stop|shut\s*down|turn\s*off|disable|terminate)\b/i,
			/\b(kill|end)\b.*\b(instance|service|resource|server)\b/i,
		],
		start_resource: [
			/\b(start|turn\s*on|enable|resume|restart)\b/i,
			/\b(bring\s*up|spin\s*up)\b/i,
		],
		resize_resource: [
			/\b(resize|change|switch|downsize|upgrade)\b.*\b(to|instance|size)\b/i,
			/\b(scale\s*down|scale\s*up)\b/i,
		],
		get_details: [
			/\b(show|tell|give|provide)\s*(me)?\s*(more)?\s*(details|info|information)\b/i,
			/\b(what|how|why|explain)\b/i,
			/\b(breakdown|analysis)\b/i,
		],
		confirm_action: [
			/\b(confirm|verified?|affirm)\b/i,
			/\b(^yes$|^y$)\b/i,
			/\b(go ahead|proceed)\b/i,
		],
		cancel_action: [
			/\b(cancel|abort|nevermind|never mind)\b/i,
			/\b(^no$|^n$)\b/i,
			/\b(stop|halt|wait)\b/i,
		],
		unknown: [],
	};

	// AWS resource patterns
	private static readonly RESOURCE_PATTERNS = {
		ec2: /\b(i-[0-9a-f]{8,17})\b/gi,
		rds: /\b(db-[a-z0-9-]+)\b/gi,
		natGateway: /\b(nat[-\s]?gateway|ngw-[0-9a-f]+)\b/gi,
		loadBalancer: /\b(load[-\s]?balancer|lb|elb|alb|nlb)\b/gi,
		s3: /\b(s3[-\s]?bucket|bucket)\b/gi,
		securityGroup: /\b(sg-[0-9a-f]+|security[-\s]?group)\b/gi,
	};

	// Action verbs
	private static readonly ACTION_VERBS = [
		"stop",
		"start",
		"terminate",
		"shutdown",
		"shut down",
		"turn off",
		"turn on",
		"enable",
		"disable",
		"resize",
		"scale",
		"upgrade",
		"downgrade",
		"approve",
		"reject",
		"cancel",
	];

	// Amount patterns
	private static readonly AMOUNT_PATTERN =
		/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd)?/gi;

	/**
	 * Parse an email command and extract intent + entities
	 */
	static parse(context: EmailCommandContext): ParsedEmailCommand {
		const text = this.normalizeText(context.bodyText);

		// Extract intent
		const intent = this.extractIntent(text);

		// Extract entities
		const resources = this.extractResources(text);
		const actions = this.extractActions(text);
		const amounts = this.extractAmounts(text);

		// Extract recommendation ID if mentioned
		const recommendationId = this.extractRecommendationId(text);

		// Calculate confidence score
		const confidence = this.calculateConfidence(
			intent,
			text,
			resources,
			actions,
		);

		// Determine if confirmation is required
		const requiresConfirmation = this.requiresConfirmation(intent, resources);

		return {
			intent,
			confidence,
			resourceId: resources.length > 0 ? resources[0] : undefined,
			resourceType: this.inferResourceType(resources, text),
			recommendationId,
			rawCommand: context.bodyText.trim(),
			extractedEntities: {
				resources,
				actions,
				amounts,
			},
			requiresConfirmation,
		};
	}

	/**
	 * Normalize text for parsing (lowercase, clean whitespace)
	 */
	private static normalizeText(text: string): string {
		return text.toLowerCase().replace(/\s+/g, " ").trim();
	}

	/**
	 * Extract intent from text using pattern matching
	 */
	private static extractIntent(text: string): EmailCommandIntent {
		const scores: Record<EmailCommandIntent, number> = {
			approve_recommendation: 0,
			reject_recommendation: 0,
			stop_resource: 0,
			start_resource: 0,
			resize_resource: 0,
			get_details: 0,
			confirm_action: 0,
			cancel_action: 0,
			unknown: 0,
		};

		// Score each intent based on pattern matches
		for (const [intent, patterns] of Object.entries(this.INTENT_PATTERNS)) {
			for (const pattern of patterns) {
				if (typeof pattern === "string") {
					if (text.includes(pattern.toLowerCase())) {
						scores[intent as EmailCommandIntent] += 1;
					}
				} else {
					if (pattern.test(text)) {
						scores[intent as EmailCommandIntent] += 1;
					}
				}
			}
		}

		// Find highest scoring intent
		const entries = Object.entries(scores) as [EmailCommandIntent, number][];
		const [topIntent, topScore] = entries.reduce((max, curr) =>
			curr[1] > max[1] ? curr : max,
		);

		return topScore > 0 ? topIntent : "unknown";
	}

	/**
	 * Extract AWS resource IDs from text
	 */
	private static extractResources(text: string): string[] {
		const resources: string[] = [];

		for (const pattern of Object.values(this.RESOURCE_PATTERNS)) {
			const matches = text.matchAll(pattern);
			for (const match of matches) {
				resources.push(match[0]);
			}
		}

		return [...new Set(resources)]; // Remove duplicates
	}

	/**
	 * Extract action verbs from text
	 */
	private static extractActions(text: string): string[] {
		const actions: string[] = [];

		for (const verb of this.ACTION_VERBS) {
			const pattern = new RegExp(`\\b${verb}\\b`, "i");
			if (pattern.test(text)) {
				actions.push(verb);
			}
		}

		return actions;
	}

	/**
	 * Extract dollar amounts from text
	 */
	private static extractAmounts(text: string): number[] {
		const amounts: number[] = [];
		const matches = text.matchAll(this.AMOUNT_PATTERN);

		for (const match of matches) {
			const amount = parseFloat(match[1].replace(/,/g, ""));
			if (!isNaN(amount)) {
				amounts.push(amount);
			}
		}

		return amounts;
	}

	/**
	 * Extract recommendation ID from text (e.g., "recommendation #1", "rec 2")
	 */
	private static extractRecommendationId(text: string): string | undefined {
		const patterns = [
			/recommendation\s*#?(\d+)/i,
			/rec\s*#?(\d+)/i,
			/option\s*#?(\d+)/i,
			/#(\d+)/,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				return match[1];
			}
		}

		return undefined;
	}

	/**
	 * Infer resource type from context
	 */
	private static inferResourceType(
		resources: string[],
		text: string,
	): string | undefined {
		if (resources.length === 0) {
			// Try to infer from keywords
			if (/nat[-\s]?gateway/i.test(text)) return "NAT Gateway";
			if (/load[-\s]?balancer/i.test(text)) return "Load Balancer";
			if (/rds|database/i.test(text)) return "RDS";
			if (/ec2|instance|server/i.test(text)) return "EC2";
			if (/s3|bucket/i.test(text)) return "S3";
			return undefined;
		}

		const resource = resources[0];

		// Match against known patterns
		if (/^i-/.test(resource)) return "EC2";
		if (/^db-/.test(resource)) return "RDS";
		if (/^ngw-/.test(resource)) return "NAT Gateway";
		if (/^sg-/.test(resource)) return "Security Group";

		return undefined;
	}

	/**
	 * Calculate confidence score for the parsed command
	 */
	private static calculateConfidence(
		intent: EmailCommandIntent,
		text: string,
		resources: string[],
		actions: string[],
	): number {
		let confidence = 0;

		// Base confidence for known intent
		if (intent !== "unknown") {
			confidence += 0.4;
		}

		// Boost for specific resource IDs
		if (resources.length > 0) {
			confidence += 0.3;
		}

		// Boost for action verbs
		if (actions.length > 0) {
			confidence += 0.2;
		}

		// Boost for short, direct commands (less ambiguity)
		if (text.split(" ").length <= 10) {
			confidence += 0.1;
		}

		return Math.min(confidence, 1.0);
	}

	/**
	 * Determine if this command requires confirmation before execution
	 */
	private static requiresConfirmation(
		intent: EmailCommandIntent,
		resources: string[],
	): boolean {
		// Destructive actions always require confirmation
		const destructiveIntents: EmailCommandIntent[] = [
			"stop_resource",
			"resize_resource",
		];

		if (destructiveIntents.includes(intent)) {
			return true;
		}

		// Approvals with specific resources require confirmation
		if (intent === "approve_recommendation" && resources.length > 0) {
			return true;
		}

		return false;
	}

	/**
	 * Generate a human-readable summary of the parsed command
	 */
	static summarize(parsed: ParsedEmailCommand): string {
		const intentDescriptions: Record<EmailCommandIntent, string> = {
			approve_recommendation: "Approve a cost optimization recommendation",
			reject_recommendation: "Reject a cost optimization recommendation",
			stop_resource: "Stop or terminate an AWS resource",
			start_resource: "Start or enable an AWS resource",
			resize_resource: "Resize or modify an AWS resource",
			get_details: "Request more details or information",
			confirm_action: "Confirm a pending action",
			cancel_action: "Cancel a pending action",
			unknown: "Unable to determine intent",
		};

		let summary = intentDescriptions[parsed.intent];

		if (parsed.resourceId) {
			summary += ` (${parsed.resourceType || "Resource"}: ${parsed.resourceId})`;
		} else if (parsed.resourceType) {
			summary += ` (${parsed.resourceType})`;
		}

		if (parsed.recommendationId) {
			summary += ` [Recommendation #${parsed.recommendationId}]`;
		}

		summary += ` (${Math.round(parsed.confidence * 100)}% confidence)`;

		return summary;
	}

	/**
	 * Check if a command is ambiguous and needs clarification
	 */
	static isAmbiguous(parsed: ParsedEmailCommand): boolean {
		// Low confidence means ambiguity
		if (parsed.confidence < 0.5) {
			return true;
		}

		// Unknown intent is ambiguous
		if (parsed.intent === "unknown") {
			return true;
		}

		// Resource-related commands without a clear resource are ambiguous
		const resourceIntents: EmailCommandIntent[] = [
			"stop_resource",
			"start_resource",
			"resize_resource",
		];

		if (
			resourceIntents.includes(parsed.intent) &&
			!parsed.resourceId &&
			!parsed.resourceType
		) {
			return true;
		}

		return false;
	}

	/**
	 * Generate a clarification question for ambiguous commands
	 */
	static generateClarification(parsed: ParsedEmailCommand): string {
		if (parsed.intent === "unknown") {
			return "I'm not sure what you'd like me to do. Could you please rephrase your request? For example:\n- 'Stop the NAT Gateway'\n- 'Approve recommendation #1'\n- 'Show me more details'";
		}

		const resourceIntents: EmailCommandIntent[] = [
			"stop_resource",
			"start_resource",
			"resize_resource",
		];

		if (
			resourceIntents.includes(parsed.intent) &&
			!parsed.resourceId &&
			!parsed.resourceType
		) {
			return `Which resource would you like to ${parsed.intent.replace("_resource", "")}? Please specify the resource type (e.g., NAT Gateway, EC2 instance, RDS database) or provide the resource ID.`;
		}

		return "Could you please clarify your request?";
	}
}
