/**
 * Hyperspell Integration
 * Memory and self-learning layer for AI agents
 */

import Hyperspell from "hyperspell";
import type {
	UserDecisionMemory,
	DeploymentPatternMemory,
	CostEstimateMemory,
	ErrorResolutionMemory,
	HyperspellQuery,
	HyperspellStoreRequest,
	LearningInsight,
} from "../types/cost-monitor.js";

export type HyperspellCollection =
	| "user_decisions"
	| "deployment_patterns"
	| "cost_estimates"
	| "error_resolutions";

export interface HyperspellSearchResult<T> {
	id: string;
	data: T;
	score: number;
	metadata?: Record<string, unknown>;
}

/**
 * Hyperspell Client
 * Provides memory storage and retrieval for the self-learning feedback engine
 */
export class HyperspellClient {
	private client: Hyperspell;
	private apiKey: string;
	private isInitialized: boolean = false;

	constructor(apiKey?: string) {
		this.apiKey = apiKey || process.env.HYPERSPELL_API_KEY || "";

		if (!this.apiKey) {
			throw new Error(
				"HYPERSPELL_API_KEY is required. Set it in your environment variables.",
			);
		}

		this.client = new Hyperspell({ apiKey: this.apiKey });
	}

	/**
	 * Initialize the Hyperspell client and ensure collections exist
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// Test connection - check if we can access the memories endpoint
			await this.client.memories.status();

			// Initialize collections if they don't exist
			const collections: HyperspellCollection[] = [
				"user_decisions",
				"deployment_patterns",
				"cost_estimates",
				"error_resolutions",
			];

			for (const collection of collections) {
				await this.ensureCollection(collection);
			}

			this.isInitialized = true;
		} catch (error) {
			throw new Error(
				`Failed to initialize Hyperspell: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Ensure a collection exists, create if it doesn't
	 * Note: Hyperspell uses vaults instead of collections
	 */
	private async ensureCollection(name: HyperspellCollection): Promise<void> {
		// Hyperspell manages collections automatically, no need to create them explicitly
		// This is a no-op for now
		return Promise.resolve();
	}

	/**
	 * Get description for a collection
	 */
	private getCollectionDescription(collection: HyperspellCollection): string {
		const descriptions: Record<HyperspellCollection, string> = {
			user_decisions:
				"Stores user decisions (accepted/rejected recommendations) for learning preferences",
			deployment_patterns:
				"Stores successful deployment configurations and patterns for reuse",
			cost_estimates:
				"Stores cost estimates vs actuals for improving prediction accuracy",
			error_resolutions:
				"Stores error patterns and their resolutions for auto-suggesting fixes",
		};
		return descriptions[collection];
	}

	// ============================================
	// User Decision Methods
	// ============================================

	/**
	 * Store a user's decision (accept/reject) for a recommendation
	 */
	async storeUserDecision(decision: UserDecisionMemory): Promise<void> {
		await this.store({
			collection: "user_decisions",
			data: decision,
			metadata: {
				action: decision.action,
				framework: decision.context.framework,
				services: decision.context.services,
				timestamp: decision.timestamp,
			},
		});
	}

	/**
	 * Query historical user decisions to learn preferences
	 * Example: "What NAT Gateway recommendations has user accepted?"
	 */
	async queryUserDecisions(
		query: string,
		filters?: { action?: "accepted" | "rejected"; framework?: string },
	): Promise<HyperspellSearchResult<UserDecisionMemory>[]> {
		const results = await this.search<UserDecisionMemory>({
			collection: "user_decisions",
			query,
			filter: filters,
			limit: 10,
		});

		return results;
	}

	/**
	 * Get acceptance rate for a specific type of recommendation
	 */
	async getRecommendationAcceptanceRate(
		recommendationType: string,
	): Promise<number> {
		const allDecisions = await this.queryUserDecisions(recommendationType);

		if (allDecisions.length === 0) {
			return 0.5; // Default 50% confidence if no history
		}

		const accepted = allDecisions.filter(
			(result) => result.data.action === "accepted",
		).length;

		return accepted / allDecisions.length;
	}

	// ============================================
	// Deployment Pattern Methods
	// ============================================

	/**
	 * Store a successful deployment pattern
	 */
	async storeDeploymentPattern(
		pattern: DeploymentPatternMemory,
	): Promise<void> {
		await this.store({
			collection: "deployment_patterns",
			data: pattern,
			metadata: {
				framework: pattern.framework,
				services: pattern.services,
				region: pattern.region,
				success: pattern.success,
				timestamp: pattern.timestamp,
			},
		});
	}

	/**
	 * Query successful deployment patterns for similar apps
	 * Example: "Next.js app with PostgreSQL database"
	 */
	async queryDeploymentPatterns(
		framework: string,
		services: string[],
		successOnly: boolean = true,
	): Promise<HyperspellSearchResult<DeploymentPatternMemory>[]> {
		const query = `${framework} with ${services.join(", ")}`;
		const filter = successOnly ? { success: true } : undefined;

		const results = await this.search<DeploymentPatternMemory>({
			collection: "deployment_patterns",
			query,
			filter,
			limit: 10,
		});

		return results;
	}

	/**
	 * Get most commonly used instance type for a framework + service combo
	 */
	async getRecommendedInstanceType(
		framework: string,
		service: string,
	): Promise<{ instanceType: string; confidence: number } | null> {
		const patterns = await this.queryDeploymentPatterns(framework, [service]);

		if (patterns.length === 0) {
			return null;
		}

		// Count instance type occurrences
		const instanceCounts: Record<string, number> = {};
		patterns.forEach((pattern) => {
			const instanceType = pattern.data.configuration.instanceTypes[service];
			if (instanceType) {
				instanceCounts[instanceType] = (instanceCounts[instanceType] || 0) + 1;
			}
		});

		// Find most common
		const sortedInstances = Object.entries(instanceCounts).sort(
			([, countA], [, countB]) => countB - countA,
		);

		if (sortedInstances.length === 0) {
			return null;
		}

		const [instanceType, count] = sortedInstances[0];
		const confidence = count / patterns.length;

		return { instanceType, confidence };
	}

	// ============================================
	// Cost Estimate Methods
	// ============================================

	/**
	 * Store cost estimate and actual cost for learning
	 */
	async storeCostEstimate(estimate: CostEstimateMemory): Promise<void> {
		await this.store({
			collection: "cost_estimates",
			data: estimate,
			metadata: {
				service: estimate.service,
				resourceType: estimate.resourceType,
				region: estimate.context.region,
				timestamp: estimate.timestamp,
			},
		});
	}

	/**
	 * Update cost estimate with actual cost after deployment
	 */
	async updateCostActual(
		deploymentId: string,
		service: string,
		actualMonthlyCost: number,
	): Promise<void> {
		// Find the estimate
		const results = await this.search<CostEstimateMemory>({
			collection: "cost_estimates",
			query: deploymentId,
			filter: { deploymentId, service },
			limit: 1,
		});

		if (results.length === 0) {
			throw new Error(
				`No cost estimate found for deployment ${deploymentId}, service ${service}`,
			);
		}

		const estimate = results[0].data;
		const varianceAmount = actualMonthlyCost - estimate.estimatedMonthlyCost;
		const variancePercent =
			(varianceAmount / estimate.estimatedMonthlyCost) * 100;

		const updatedEstimate: CostEstimateMemory = {
			...estimate,
			actualMonthlyCost,
			variancePercent,
			varianceAmount,
		};

		// Update the record - Hyperspell doesn't support direct updates, so we'll store a new version
		await this.store({
			collection: "cost_estimates",
			data: updatedEstimate,
			metadata: {
				service: updatedEstimate.service,
				resourceType: updatedEstimate.resourceType,
				region: updatedEstimate.context.region,
				timestamp: updatedEstimate.timestamp,
				updated: true,
			},
		});
	}

	/**
	 * Get average variance for cost estimates to improve future predictions
	 */
	async getCostEstimateAccuracy(
		service: string,
		resourceType: string,
	): Promise<{ avgVariancePercent: number; sampleSize: number }> {
		const results = await this.search<CostEstimateMemory>({
			collection: "cost_estimates",
			query: `${service} ${resourceType}`,
			filter: { service, resourceType },
			limit: 50,
		});

		const withActuals = results.filter(
			(r) =>
				r.data.actualMonthlyCost !== undefined &&
				r.data.variancePercent !== undefined,
		);

		if (withActuals.length === 0) {
			return { avgVariancePercent: 0, sampleSize: 0 };
		}

		const totalVariance = withActuals.reduce(
			(sum, r) => sum + (r.data.variancePercent || 0),
			0,
		);

		const avgVariancePercent = totalVariance / withActuals.length;

		return {
			avgVariancePercent,
			sampleSize: withActuals.length,
		};
	}

	// ============================================
	// Error Resolution Methods
	// ============================================

	/**
	 * Store an error resolution pattern
	 */
	async storeErrorResolution(resolution: ErrorResolutionMemory): Promise<void> {
		await this.store({
			collection: "error_resolutions",
			data: resolution,
			metadata: {
				errorType: resolution.errorType,
				service: resolution.service,
				successful: resolution.resolutionSuccessful,
				timestamp: resolution.timestamp,
			},
		});
	}

	/**
	 * Query for known error resolutions
	 * Example: "InsufficientCapacity in us-east-1a"
	 */
	async queryErrorResolution(
		errorMessage: string,
	): Promise<ErrorResolutionMemory | null> {
		const results = await this.search<ErrorResolutionMemory>({
			collection: "error_resolutions",
			query: errorMessage,
			filter: { resolutionSuccessful: true },
			limit: 1,
		});

		if (results.length === 0) {
			return null;
		}

		// Return the most relevant resolution
		return results[0].data;
	}

	/**
	 * Update error resolution success metrics
	 */
	async updateErrorResolutionSuccess(
		errorPattern: string,
		successful: boolean,
	): Promise<void> {
		const results = await this.search<ErrorResolutionMemory>({
			collection: "error_resolutions",
			query: errorPattern,
			limit: 1,
		});

		if (results.length === 0) {
			return;
		}

		const resolution = results[0].data;
		const newTimesToResolution =
			resolution.timesToResolution + (successful ? 1 : 0);
		const totalAttempts = resolution.timesToResolution + 1;
		const newSuccessRate = newTimesToResolution / totalAttempts;

		const updatedResolution: ErrorResolutionMemory = {
			...resolution,
			timesToResolution: newTimesToResolution,
			successRate: newSuccessRate,
			lastUsed: new Date().toISOString(),
		};

		// Update the record - Hyperspell doesn't support direct updates, so we'll store a new version
		await this.store({
			collection: "error_resolutions",
			data: updatedResolution,
			metadata: {
				errorType: updatedResolution.errorType,
				service: updatedResolution.service,
				successful: updatedResolution.resolutionSuccessful,
				timestamp: updatedResolution.timestamp,
				updated: true,
			},
		});
	}

	// ============================================
	// Learning Insights
	// ============================================

	/**
	 * Generate learning insights from all memory collections
	 */
	async generateLearningInsights(deploymentContext: {
		framework?: string;
		services?: string[];
		region?: string;
	}): Promise<LearningInsight[]> {
		const insights: LearningInsight[] = [];

		// Insight from deployment patterns
		if (deploymentContext.framework && deploymentContext.services) {
			const patterns = await this.queryDeploymentPatterns(
				deploymentContext.framework,
				deploymentContext.services,
			);

			if (patterns.length >= 3) {
				const avgCost =
					patterns.reduce(
						(sum, p) => sum + (p.data.costActual || p.data.costEstimate),
						0,
					) / patterns.length;

				insights.push({
					type: "pattern",
					message: `Based on ${patterns.length} similar ${deploymentContext.framework} deployments, average monthly cost is $${avgCost.toFixed(2)}`,
					confidence: Math.min(patterns.length / 10, 1), // More patterns = higher confidence
					source: "deployment_patterns",
					metadata: {
						sampleSize: patterns.length,
						lastUpdated: patterns[0]?.data.timestamp,
					},
				});
			}
		}

		// Insight from cost estimate accuracy
		if (deploymentContext.services) {
			for (const service of deploymentContext.services) {
				const accuracy = await this.getCostEstimateAccuracy(service, "");

				if (accuracy.sampleSize >= 5) {
					const direction =
						accuracy.avgVariancePercent > 0 ? "higher" : "lower";
					insights.push({
						type: "prediction",
						message: `Our ${service} cost estimates are typically ${Math.abs(accuracy.avgVariancePercent).toFixed(1)}% ${direction} than actual costs`,
						confidence: Math.min(accuracy.sampleSize / 20, 1),
						source: "cost_estimates",
						metadata: {
							sampleSize: accuracy.sampleSize,
							accuracy: 100 - Math.abs(accuracy.avgVariancePercent),
						},
					});
				}
			}
		}

		return insights;
	}

	// ============================================
	// Generic Methods
	// ============================================

	/**
	 * Generic store method
	 */
	private async store(request: HyperspellStoreRequest): Promise<void> {
		await this.client.memories.add({
			text: JSON.stringify(request.data),
			collection: request.collection,
			date: new Date().toISOString(),
		});
	}

	/**
	 * Generic search method
	 */
	private async search<T>(
		query: HyperspellQuery,
	): Promise<HyperspellSearchResult<T>[]> {
		const results = await this.client.memories.search({
			query: query.query,
			sources: query.collection ? ["collections"] : undefined,
			max_results: query.limit || 10,
		});

		return (results.documents || []).map((result: any) => ({
			id: result.resource_id || result.id,
			data: JSON.parse(result.text || "{}") as T,
			score: result.score || 0,
			metadata: result.metadata,
		}));
	}

	/**
	 * Delete all data in a collection (for testing)
	 */
	async clearCollection(collection: HyperspellCollection): Promise<void> {
		// Hyperspell doesn't support bulk delete operations
		// This would need to be implemented by querying all items and deleting them individually
		// For now, this is a no-op
		console.warn(
			`clearCollection not fully implemented for Hyperspell. Collection: ${collection}`,
		);
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		try {
			await this.client.memories.status();
			return true;
		} catch {
			return false;
		}
	}
}

// Export singleton instance
let hyperspellInstance: HyperspellClient | null = null;

export function getHyperspellClient(): HyperspellClient {
	if (!hyperspellInstance) {
		hyperspellInstance = new HyperspellClient();
	}
	return hyperspellInstance;
}

export function resetHyperspellClient(): void {
	hyperspellInstance = null;
}
