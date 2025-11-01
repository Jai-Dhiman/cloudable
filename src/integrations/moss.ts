import { MossClient as MossSDK } from "@inferedge/moss";

interface MossDocument {
	id: string;
	text: string;
}

export class MossClient {
	private client: MossSDK;
	private projectId: string;
	private projectKey: string;

	constructor(projectId?: string, projectKey?: string) {
		this.projectId = projectId || process.env.MOSS_PROJECT_ID || "";
		this.projectKey = projectKey || process.env.MOSS_PROJECT_KEY || "";

		if (!this.projectId || !this.projectKey) {
			throw new Error("MOSS_PROJECT_ID and MOSS_PROJECT_KEY are required");
		}

		this.client = new MossSDK(this.projectId, this.projectKey);
	}

	async createIndex(
		indexName: string,
		documents: MossDocument[],
		model = "moss-minilm",
	) {
		return await this.client.createIndex(indexName, documents, model);
	}

	async loadIndex(indexName: string) {
		return await this.client.loadIndex(indexName);
	}

	async query(indexName: string, query: string) {
		return await this.client.query(indexName, query);
	}

	getClient(): MossSDK {
		return this.client;
	}
}

export function createMossClient(
	projectId?: string,
	projectKey?: string,
): MossClient {
	return new MossClient(projectId, projectKey);
}
