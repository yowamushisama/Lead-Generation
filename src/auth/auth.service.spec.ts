import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../database/supabase.service';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockSupabase = {
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  getAnonClient: jest.fn(),
};

const mockJwt = { sign: jest.fn().mockReturnValue('signed-token') };

// ── Helpers ────────────────────────────────────────────────────────────────

const orgRow = { id: 'org-1', name: 'Acme', slug: 'acme', tier: 'free', maxLeadsPerDay: 50 };
const userRow = { id: 'user-1', email: 'a@b.com', name: 'Alice', role: 'admin', organizationId: 'org-1', supabaseUserId: 'supa-1', createdAt: new Date(), updatedAt: new Date(), organization: orgRow };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = { email: 'a@b.com', password: 'pw', name: 'Alice', organizationName: 'Acme', organizationSlug: 'acme' };

    it('creates org + user and returns auth result', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);        // no existing user
      mockPrisma.organization.findUnique.mockResolvedValue(null); // no existing org
      mockSupabase.createUser.mockResolvedValue({ id: 'supa-1' });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({ organization: { create: jest.fn().mockResolvedValue(orgRow) }, user: { create: jest.fn().mockResolvedValue(userRow) } }),
      );

      const result = await service.register(dto);

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe('a@b.com');
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRow);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when org slug already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue(orgRow);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('deletes Supabase user and re-throws on Prisma transaction failure', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockSupabase.createUser.mockResolvedValue({ id: 'supa-1' });
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

      await expect(service.register(dto)).rejects.toThrow('DB error');
      expect(mockSupabase.deleteUser).toHaveBeenCalledWith('supa-1');
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'a@b.com', password: 'pw' };

    it('returns auth result on valid credentials', async () => {
      mockSupabase.getAnonClient.mockReturnValue({
        auth: { signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'supa-1' } }, error: null }) },
      });
      mockPrisma.user.findUnique.mockResolvedValue(userRow);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe('a@b.com');
    });

    it('throws UnauthorizedException on bad credentials', async () => {
      mockSupabase.getAnonClient.mockReturnValue({
        auth: { signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }) },
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found in DB after Supabase success', async () => {
      mockSupabase.getAnonClient.mockReturnValue({
        auth: { signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'supa-1' } }, error: null }) },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns user profile with organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRow);

      const result = await service.getProfile('user-1');

      expect(result.id).toBe('user-1');
      expect(result.organization.slug).toBe('acme');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('issues new token for existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRow);

      const result = await service.refreshToken('user-1');

      expect(result.accessToken).toBe('signed-token');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('ghost')).rejects.toThrow(UnauthorizedException);
    });
  });
});
