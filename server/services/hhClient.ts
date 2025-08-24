import https from 'https';
import http from 'http';
import { URL } from 'url';
import zlib from 'zlib';

// Keep-alive agents
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 10,
  timeout: 30000
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 10,
  timeout: 30000
});

export interface HHRequestOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class HHClient {
  private userAgent: string;
  private baseURL = 'https://api.hh.ru';

  constructor() {
    this.userAgent = process.env.HH_USER_AGENT || 'hh-finder/1.0 (+localhost)';
  }

  private async makeRequest(
    path: string, 
    options: HHRequestOptions = {},
    queryParams: Record<string, any> = {}
  ): Promise<any> {
    const { timeout = 8000, retryAttempts = 3, retryDelay = 1000 } = options;
    
    const url = new URL(path, this.baseURL);
    
    // Add query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v.toString()));
        } else {
          url.searchParams.set(key, value.toString());
        }
      }
    });

    const startTime = Date.now();
    
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'ru',
            'Accept-Encoding': 'gzip, deflate',
            'User-Agent': this.userAgent,
            'HH-User-Agent': this.userAgent
          },
          signal: controller.signal,
          // @ts-ignore - Node.js specific options
          agent: url.protocol === 'https:' ? httpsAgent : httpAgent
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryInMs = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay * (attempt + 1);
          
          if (attempt === retryAttempts - 1) {
            throw {
              error: 'rate_limited',
              retryInMs,
              status: 429,
              message: 'Rate limited by HH.ru'
            };
          }
          
          await new Promise(resolve => setTimeout(resolve, retryInMs + Math.random() * 1000));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HH.ru API error: ${response.status} ${response.statusText}`);
        }

        const duration = Date.now() - startTime;
        
        // Set Server-Timing header info
        const timing = {
          total: duration,
          upstream: duration,
          cache: 0
        };

        const data = await response.json();
        
        return { data, timing };

      } catch (error: any) {
        if (error.name === 'AbortError') {
          if (attempt === retryAttempts - 1) {
            throw new Error('Request timeout');
          }
        } else if (error.error === 'rate_limited') {
          throw error;
        } else if (attempt === retryAttempts - 1) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  async getSuggestions(text: string): Promise<{ data: any; timing: any }> {
    return this.makeRequest('/suggests/vacancy_search_keyword', {}, { text });
  }

  async getDictionaries(): Promise<{ data: any; timing: any }> {
    return this.makeRequest('/dictionaries');
  }

  async getAreas(): Promise<{ data: any; timing: any }> {
    return this.makeRequest('/areas');
  }

  async searchVacancies(params: {
    text?: string;
    area?: string;
    experience?: string;
    employment?: string[];
    schedule?: string[];
    salary?: number;
    currency?: string;
    only_with_salary?: boolean;
    period?: number;
    order_by?: string;
    per_page?: number;
    page?: number;
    specialization?: string;
    metro?: string;
    employer_id?: string;
  }): Promise<{ data: any; timing: any }> {
    return this.makeRequest('/vacancies', {}, params);
  }

  async getVacancy(id: string): Promise<{ data: any; timing: any }> {
    return this.makeRequest(`/vacancies/${id}`);
  }

  async getEmployer(employerUrl: string): Promise<{ data: any; timing: any }> {
    // Extract employer ID from URL (e.g., https://api.hh.ru/employers/123 -> 123)
    const employerId = employerUrl.split('/').pop();
    return this.makeRequest(`/employers/${employerId}`);
  }
}

export const hhClient = new HHClient();
