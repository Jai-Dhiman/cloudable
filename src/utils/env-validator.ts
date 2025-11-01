export function validateEnv(): { valid: boolean; missing: string[] } {
	const required = [
		"MOSS_PROJECT_ID",
		"MOSS_PROJECT_KEY",
		"AGENTMAIL_API_KEY",
		"AWS_REGION",
	];

	const missing = required.filter((key) => !process.env[key]);

	return {
		valid: missing.length === 0,
		missing,
	};
}

export function throwIfInvalid(): void {
	const { valid, missing } = validateEnv();
	if (!valid) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}
}
