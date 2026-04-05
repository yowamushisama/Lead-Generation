import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ExtractJwt } from 'passport-jwt';

interface ApiKeyUser {
  organizationId: string;
  role: string;
  sub: string;
  email: string;
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  private readonly internalApiKey: string;
  private readonly defaultOrgId: string;

  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromHeader(
        configService.get<string>('API_KEY_HEADER') ?? 'x-api-key',
      ),
      ignoreExpiration: true,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'change-me',
      passReqToCallback: true,
    });

    this.internalApiKey = configService.get<string>('INTERNAL_API_KEY') ?? '';
    this.defaultOrgId = configService.get<string>('DEFAULT_ORGANIZATION_ID') ?? 'default';
  }

  validate(_req: Request, _payload: unknown): ApiKeyUser {
    throw new UnauthorizedException('API key validation not implemented for JWT strategy');
  }

  validateApiKey(apiKey: string): ApiKeyUser {
    if (!this.internalApiKey || apiKey !== this.internalApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return {
      organizationId: this.defaultOrgId,
      role: 'service',
      sub: 'service-account',
      email: 'service@internal',
    };
  }
}
