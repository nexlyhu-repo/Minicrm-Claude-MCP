import { MiniCrmConfig, SearchResponse } from "./types.js";

export class MiniCrmClient {
  private config: MiniCrmConfig;
  private authHeader: string;
  private requestTimestamps: number[] = [];
  private readonly RATE_LIMIT = 55; // 60/min limit, keep 5 buffer
  private readonly RATE_WINDOW = 60_000;

  constructor(config: MiniCrmConfig) {
    this.config = config;
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.systemId}:${config.apiKey}`).toString("base64");
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < this.RATE_WINDOW
    );

    if (this.requestTimestamps.length >= this.RATE_LIMIT) {
      const oldest = this.requestTimestamps[0]!;
      const waitMs = this.RATE_WINDOW - (now - oldest) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.requestTimestamps.push(Date.now());
  }

  async request<T = unknown>(
    method: "GET" | "PUT" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    // Invoice endpoints have no rate limit
    const isInvoice = path.startsWith("/Api/Invoice");
    if (!isInvoice) {
      await this.throttle();
    }

    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
    };

    const options: RequestInit = { method, headers };
    if (body && (method === "PUT" || method === "POST")) {
      options.body = JSON.stringify(body);
    }

    let retries = 0;
    while (retries <= 2) {
      const response = await fetch(url, options);

      if (response.status === 429) {
        retries++;
        if (retries > 2) {
          throw new Error("MiniCRM API sebessegkorlat tullepve (429). Probalja ujra kesobb.");
        }
        const waitMs = Math.min(retries * 5000, 15000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `MiniCRM API hiba (${response.status}): ${errorText}`
        );
      }

      const text = await response.text();
      if (!text) return {} as T;

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`MiniCRM API ervenytelen valasz: ${text.substring(0, 200)}`);
      }
    }

    throw new Error("MiniCRM API: tul sok ujraproba");
  }

  async search(
    basePath: string,
    params: Record<string, string | number | undefined>,
    fetchAll = false
  ): Promise<SearchResponse> {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");

    const path = query ? `${basePath}?${query}` : basePath;
    const first = await this.request<SearchResponse>("GET", path);

    if (!fetchAll || first.Count <= 100) {
      return first;
    }

    const totalPages = Math.ceil(first.Count / 100);
    const allResults = { ...first.Results };

    for (let page = 1; page < totalPages; page++) {
      const pagePath = query
        ? `${basePath}?${query}&Page=${page}`
        : `${basePath}?Page=${page}`;
      const pageData = await this.request<SearchResponse>("GET", pagePath);
      Object.assign(allResults, pageData.Results);
    }

    return { Count: first.Count, Results: allResults };
  }

  get voipApiKey(): string | undefined {
    return this.config.voipApiKey;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get systemId(): string {
    return this.config.systemId;
  }
}
