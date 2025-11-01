/**
 * API Configuration
 * Backend API URL for cloudable deployment service
 */

// TODO: Replace with your actual Vercel deployment URL after deploying backend-api/
export const API_CONFIG = {
  // Development: Use localhost
  // Production: Use your Vercel URL
  BASE_URL: process.env.CLOUDABLE_API_URL || 'https://backend-api-lilac-tau.vercel.app',
  
  ENDPOINTS: {
    DEPLOY: '/api/deploy',
    DEPLOY_STATUS: '/api/deploy/status',
    ANALYZE: '/api/analyze',
    RECOMMEND: '/api/recommend'
  },
  
  // Timeout for API requests (30 minutes for deployments)
  TIMEOUT: 30 * 60 * 1000
};

// Helper to get full endpoint URL
export function getEndpoint(endpoint: keyof typeof API_CONFIG.ENDPOINTS): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS[endpoint]}`;
}

