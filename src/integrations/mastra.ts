import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";

export class MastraOrchestrator {
	private mastra: Mastra;

	constructor(agents: Record<string, Agent> = {}) {
		this.mastra = new Mastra({
			agents,
		});
	}

	getAgent(name: string): Agent {
		const agents = this.mastra.getAgents();
		const agent = agents[name];
		if (!agent) {
			throw new Error(`Agent ${name} not found`);
		}
		return agent;
	}

	getAllAgents(): Record<string, Agent> {
		return this.mastra.getAgents();
	}
}

export function createMastraClient(
	agents: Record<string, Agent> = {},
): MastraOrchestrator {
	return new MastraOrchestrator(agents);
}
