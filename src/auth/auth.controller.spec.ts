import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
  refreshToken: jest.fn(),
};

const authResult = {
  accessToken: 'jwt-token',
  user: { id: 'user-1', email: 'a@b.com', name: 'Alice', role: 'admin', organizationId: 'org-1' },
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      email: 'a@b.com',
      password: 'Password123',
      name: 'Alice',
      organizationName: 'Acme',
      organizationSlug: 'acme',
    };

    it('returns wrapped registration result on success', async () => {
      mockAuthService.register.mockResolvedValue(authResult);

      const res = await controller.register(dto as any);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(authResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });

    it('propagates ConflictException for duplicate email', async () => {
      mockAuthService.register.mockRejectedValue(new ConflictException('Email already registered'));

      await expect(controller.register(dto as any)).rejects.toThrow(ConflictException);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'a@b.com', password: 'Password123' };

    it('returns wrapped login result on success', async () => {
      mockAuthService.login.mockResolvedValue(authResult);

      const res = await controller.login(dto as any);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(authResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });

    it('propagates UnauthorizedException on bad credentials', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(dto as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    const profile = {
      id: 'user-1',
      email: 'a@b.com',
      name: 'Alice',
      role: 'admin',
      organizationId: 'org-1',
      organization: { id: 'org-1', name: 'Acme', slug: 'acme', tier: 'starter' },
      createdAt: new Date(),
    };

    it('returns wrapped profile on success', async () => {
      mockAuthService.getProfile.mockResolvedValue(profile);
      const req = { user: { sub: 'user-1', email: 'a@b.com', organizationId: 'org-1', role: 'admin' } };

      const res = await controller.getProfile(req as any);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(profile);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1');
    });

    it('propagates NotFoundException when user is missing', async () => {
      mockAuthService.getProfile.mockRejectedValue(new NotFoundException('User not found'));
      const req = { user: { sub: 'ghost', email: '', organizationId: '', role: '' } };

      await expect(controller.getProfile(req as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns new access token', async () => {
      mockAuthService.refreshToken.mockResolvedValue({ accessToken: 'new-jwt' });
      const req = { user: { sub: 'user-1', email: 'a@b.com', organizationId: 'org-1', role: 'admin' } };

      const res = await controller.refreshToken(req as any);

      expect(res.success).toBe(true);
      expect((res.data as any).accessToken).toBe('new-jwt');
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('user-1');
    });
  });
});
