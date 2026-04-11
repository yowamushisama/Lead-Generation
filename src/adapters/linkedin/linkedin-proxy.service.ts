import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyConfig } from './linkedin-stealth.service';

@Injectable()
export class LinkedInProxyService {
  private readonly logger = new Logger(LinkedInProxyService.name);
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;

  constructor(private readonly configService: ConfigService) {
    this.loadProxies();
  }

  private loadProxies(): void {
    const proxyList = this.configService.get<string>('LINKEDIN_PROXY_LIST', '');
    if (!proxyList) {
      this.logger.warn({
        message: 'No LINKEDIN_PROXY_LIST configured — running without proxy rotation',
      });
      return;
    }

    this.proxies = proxyList.split(',').reduce<ProxyConfig[]>((acc, raw) => {
      const trimmed = raw.trim();
      const [host, port, username, password] = trimmed.split(':');
      if (!host || !port) return acc;
      acc.push({
        server: `http://${host}:${port}`,
        username: username ?? undefined,
        password: password ?? undefined,
        raw: trimmed,
      });
      return acc;
    }, []);

    this.logger.log({
      message: `Loaded ${this.proxies.length} proxies for LinkedIn rotation`,
    });
  }

  getNextProxy(): ProxyConfig | undefined {
    if (this.proxies.length === 0) return undefined;
    const proxy = this.proxies[this.currentIndex % this.proxies.length];
    this.currentIndex++;
    return proxy;
  }

  markFailed(proxy: ProxyConfig): void {
    const idx = this.proxies.findIndex((p) => p.raw === proxy.raw);
    if (idx !== -1) {
      this.proxies.splice(idx, 1);
      this.logger.warn({
        message: `Removed failed proxy: ${proxy.server}`,
        remaining: this.proxies.length,
      });
      if (this.currentIndex >= this.proxies.length) {
        this.currentIndex = 0;
      }
    }
  }

  get proxyCount(): number {
    return this.proxies.length;
  }
}
