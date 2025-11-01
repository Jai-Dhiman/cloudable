export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface AWSCredentialLocation {
  source: 'environment' | 'file' | '.env file';
  credentials: AWSCredentials;
}

export interface AWSIdentity {
  userId: string;
  account: string;
  arn: string;
}

export interface CredentialCheckResult {
  found: boolean;
  location?: AWSCredentialLocation;
  valid?: boolean;
  identity?: AWSIdentity;
}

