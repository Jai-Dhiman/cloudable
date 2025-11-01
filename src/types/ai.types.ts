export interface ProjectFile {
  path: string;
  content: string;
}

export interface DirectoryTree {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: DirectoryTree[];
}

export interface FileDiscoveryResult {
  files: string[];
  reasoning?: string;
}

export interface DockerConfiguration {
  dockerfile: string;
  dockerignore: string;
  dockerCompose?: string;
  kubernetesYaml?: string;
  explanation?: string;
}

export interface AIGeneratorConfig {
  openaiApiKey: string;
  model?: string;
  maxTokens?: number;
}

