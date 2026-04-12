import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { OrganizationRepository } from '../database/repositories/organization.repository';
import { PrismaTransactionService } from '../database/repositories/prisma-transaction.service';
import { UserRepository } from '../database/repositories/user.repository';
import { SupabaseService } from '../database/supabase.service';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUserRepository = {
  findUnique: jest.fn(),
  create: jest.fn(),
};

const mockOrganizationRepository = {
  findUnique: jest.fn(),
  create: jest.fn(),
};

const mockTransaction = {
  run: jest.fn(),
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
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: OrganizationRepository, useValue: mockOrganizationRepository },
        { provide: PrismaTransactionService, useValue: mockTransaction },
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
      mockUserRepository.findUnique.mockResolvedValue(null);
      mockOrganizationRepository.findUnique.mockResolvedValue(null);
      mockSupabase.createUser.mockResolvedValue({ id: 'supa-1' });
      mockOrganizationRepository.create.mockResolvedValue(orgRow);
      mockUserRepository.create.mockResolvedValue(userRow);
      mockTransaction.run.mockImplementation(async (fn: Function) => fn({}));

      const result = await service.register(dto);

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe('a@b.com');
    });

    it('throws ConflictException when email already exists', async () => {
      mockUserRepository.findUnique.mockResolvedValue(userRow);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when org slug already taken', async () => {
      mockUserRepository.findUnique.mockResolvedValue(null);
      mockOrganizationRepository.findUnique.mockResolvedValue(orgRow);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('deletes Supabase user and re-throws on Prisma transaction failure', async () => {
      mockUserRepository.findUnique.mockResolvedValue(null);
      mockOrganizationRepository.findUnique.mockResolvedValue(null);
      mockSupabase.createUser.mockResolvedValue({ id: 'supa-1' });
      mockTransaction.run.mockRejectedValue(new Error('DB error'));

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
      mockUserRepository.findUnique.mockResolvedValue(userRow);

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
      mockUserRepository.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns user profile with organization', async () => {
      mockUserRepository.findUnique.mockResolvedValue(userRow);

      const result = await service.getProfile('user-1');

      expect(result.id).toBe('user-1');
      expect(result.organization.slug).toBe('acme');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockUserRepository.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('issues new token for existing user', async () => {
      mockUserRepository.findUnique.mockResolvedValue(userRow);

      const result = await service.refreshToken('user-1');

      expect(result.accessToken).toBe('signed-token');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockUserRepository.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('ghost')).rejects.toThrow(UnauthorizedException);
    });
  });
});
