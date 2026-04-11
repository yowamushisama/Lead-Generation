import { Test, TestingModule } from '@nestjs/testing';
import { DeduplicationService } from '../../src/leads/deduplication.service';
import { PrismaService } from '../../src/database/prisma.service';
import { HashUtil } from '../../src/common/utils/hash.util';

describe('DeduplicationService', () => {
  let service: DeduplicationService;
  let hashUtil: HashUtil;

  const mockPrismaService = {
    lead: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeduplicationService,
        HashUtil,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DeduplicationService>(DeduplicationService);
    hashUtil = module.get<HashUtil>(HashUtil);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDuplicate', () => {
    const baseInput = {
      name: 'John Doe',
      email: 'john@acme.com',
      company: 'Acme Corp',
      source: 'reddit',
      organizationId: 'org-123',
    };

    it('should return false for a new unique lead', async () => {
      mockPrismaService.lead.findUnique.mockResolvedValue(null);
      mockPrismaService.lead.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicate(baseInput);
      expect(result).toBe(false);
    });

    it('should detect duplicate by email', async () => {
      mockPrismaService.lead.findUnique.mockResolvedValue(null);
      mockPrismaService.lead.findFirst.mockResolvedValueOnce({
        id: 'existing-lead-id',
        email: 'john@acme.com',
      });

      const result = await service.checkDuplicate(baseInput);
      expect(result).toBe(true);
    });

    it('should detect duplicate by externalId + source + organizationId', async () => {
      mockPrismaService.lead.findUnique.mockResolvedValue({
        id: 'existing-lead-id',
        externalId: 'ext-123',
      });

      const result = await service.checkDuplicate({
        ...baseInput,
        externalId: 'ext-123',
      });

      expect(result).toBe(true);
      expect(mockPrismaService.lead.findUnique).toHaveBeenCalledWith({
        where: {
          externalId_source_organizationId: {
            externalId: 'ext-123',
            source: 'reddit',
            organizationId: 'org-123',
          },
        },
      });
    });

    it('should detect duplicate by content hash', async () => {
      mockPrismaService.lead.findUnique.mockResolvedValue(null);
      mockPrismaService.lead.findFirst
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'existing-lead' }); // hash check

      const result = await service.checkDuplicate({ ...baseInput, email: undefined });
      expect(result).toBe(true);
    });

    it('should not check externalId when not provided', async () => {
      mockPrismaService.lead.findFirst.mockResolvedValue(null);

      await service.checkDuplicate(baseInput);

      expect(mockPrismaService.lead.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('computeContentHash', () => {
    it('should produce consistent hashes for same input', () => {
      const input = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        company: 'Example Inc',
        source: 'linkedin',
        organizationId: 'org-456',
      };

      const hash1 = service.computeContentHash(input);
      const hash2 = service.computeContentHash(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should normalize case before hashing', () => {
      const input1 = {
        name: 'JANE DOE',
        email: 'JANE@EXAMPLE.COM',
        company: 'Example Inc',
        source: 'linkedin',
        organizationId: 'org-456',
      };

      const input2 = {
        name: 'jane doe',
        email: 'jane@example.com',
        company: 'example inc',
        source: 'linkedin',
        organizationId: 'org-456',
      };

      const hash1 = service.computeContentHash(input1);
      const hash2 = service.computeContentHash(input2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const input1 = {
        name: 'Alice Smith',
        email: 'alice@test.com',
        company: 'Test Co',
        source: 'reddit',
        organizationId: 'org-789',
      };

      const input2 = {
        name: 'Bob Jones',
        email: 'bob@test.com',
        company: 'Test Co',
        source: 'reddit',
        organizationId: 'org-789',
      };

      const hash1 = service.computeContentHash(input1);
      const hash2 = service.computeContentHash(input2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle missing optional fields gracefully', () => {
      const input = {
        name: 'No Email User',
        source: 'csv_import',
        organizationId: 'org-000',
      };

      const hash = service.computeContentHash(input);
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('markDuplicatesInBatch', () => {
    it('should identify duplicates within a batch', async () => {
      const leads = [
        { name: 'Alice', email: 'alice@test.com', source: 'reddit' },
        { name: 'Bob', email: 'bob@test.com', source: 'reddit' },
        { name: 'Alice', email: 'alice@test.com', source: 'reddit' }, // duplicate
      ];

      const results = await service.markDuplicatesInBatch('org-123', leads);

      expect(results[0]).toBe(false);
      expect(results[1]).toBe(false);
      expect(results[2]).toBe(true); // third entry is duplicate of first
    });

    it('should return all false for unique leads in batch', async () => {
      const leads = [
        { name: 'Alice', email: 'alice@test.com', source: 'reddit' },
        { name: 'Bob', email: 'bob@test.com', source: 'reddit' },
        { name: 'Charlie', email: 'charlie@test.com', source: 'reddit' },
      ];

      const results = await service.markDuplicatesInBatch('org-123', leads);

      expect(results).toEqual([false, false, false]);
    });
  });

  describe('getDeduplicationStats', () => {
    it('should return correct stats', async () => {
      mockPrismaService.lead.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(75) // with email
        .mockResolvedValueOnce(90); // with hash

      const stats = (await service.getDeduplicationStats('org-123')) as Record<string, unknown>;

      expect(stats['totalLeads']).toBe(100);
      expect(stats['leadsWithEmail']).toBe(75);
      expect(stats['leadsWithHash']).toBe(90);
      expect(stats['deduplicationCoverage']).toBe(90);
    });

    it('should handle zero total leads without division by zero', async () => {
      mockPrismaService.lead.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const stats = (await service.getDeduplicationStats('org-empty')) as Record<string, unknown>;
      expect(stats['deduplicationCoverage']).toBe(0);
    });
  });
});
