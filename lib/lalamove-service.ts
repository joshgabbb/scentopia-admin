// lib/lalamove-service.ts
// Shared Lalamove API service — used by create-delivery and lalamove-quote endpoints
import crypto from 'crypto';

export class LalamoveService {
  private apiKey: string;
  private apiSecret: string;
  private market: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_LALAMOVE_API_KEY!;
    this.apiSecret = process.env.LALAMOVE_API_SECRET!;
    this.market = process.env.LALAMOVE_MARKET!;
    this.baseUrl = process.env.LALAMOVE_BASE_URL!;

    if (!this.apiKey || !this.apiSecret || !this.market || !this.baseUrl) {
      throw new Error('Missing required Lalamove environment variables');
    }
  }

  private generateSignature(timestamp: string, method: string, path: string, body = ''): string {
    const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
    return crypto.createHmac('sha256', this.apiSecret).update(rawSignature, 'utf8').digest('hex');
  }

  private generateHeaders(method: string, path: string, body?: any): Record<string, string> {
    const timestamp = Date.now().toString();
    let bodyString = '';
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      bodyString = JSON.stringify(body);
    }
    const signature = this.generateSignature(timestamp, method, path, bodyString);
    return {
      'Content-Type': 'application/json',
      'Authorization': `hmac ${this.apiKey}:${timestamp}:${signature}`,
      'Market': this.market,
      'Request-ID': crypto.randomUUID(),
    };
  }

  async makeRequest<T = any>(method: string, path: string, body?: any): Promise<T> {
    const headers = this.generateHeaders(method, path, body);
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(`Lalamove API Error: ${response.status} - ${responseData?.message || responseText}`);
    }

    return responseData as T;
  }

  async getQuotation(quotationData: any) {
    return this.makeRequest('POST', '/v3/quotations', { data: quotationData });
  }

  async placeOrder(orderData: any) {
    return this.makeRequest('POST', '/v3/orders', { data: orderData });
  }
}
