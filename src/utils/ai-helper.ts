// Calls Cloudable backend API (your API key is server-side)
const API_URL = 'https://backend-nzex4q8mo-dpakkks-projects.vercel.app'

export class AIHelper {
  private apiUrl: string

  constructor() {
    // Use environment variable if set (for development), otherwise use production API
    this.apiUrl = process.env.CLOUDABLE_API_URL || API_URL
  }

  isEnabled(): boolean {
    // Always enabled - uses your backend API
    return true
  }

  async analyzeCodebase(analysis: any): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysis }),
      })

      const data = await response.json() as any
      
      if (data.success) {
        return data.insight
      }

      return 'AI analysis temporarily unavailable'
    } catch (error) {
      // Silently fail - don't break the CLI if API is down
      return ''
    }
  }

  async getInfrastructureRecommendation(analysis: any): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/api/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysis }),
      })

      const data = await response.json() as any
      
      if (data.success) {
        return data.recommendation
      }

      return 'AI recommendation temporarily unavailable'
    } catch (error) {
      // Silently fail - don't break the CLI if API is down
      return ''
    }
  }
}

export const aiHelper = new AIHelper()

