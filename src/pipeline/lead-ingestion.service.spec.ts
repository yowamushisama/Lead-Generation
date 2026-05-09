import { Prisma } from '@prisma/client';
import { LeadIngestionService } from './lead-ingestion.service';

const mockLeadRepository = {
  create: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
};

const mockDeduplicationService = {
  computeContentHash: jest.fn().mockReturnValue('hash-123'),
};

const tenant = { organizationId: 'org-1', userId: 'user-1' };

const leadRow = {
  id: 'lead-1',
  organizationId: 'org-1',
  name: 'Acme Dental',
  source: 'google_maps',
  status: 'NEW',
  tier: 'COLD',
  score: 0,
};

describe('LeadIngestionService', () => {
  let service: LeadIngestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLeadRepository.findUnique.mockResolvedValue(null);
    mockLeadRepository.findFirst.mockResolvedValue(null);
    service = new LeadIngestionService(mockLeadRepository as any, mockDeduplicationService as any);
  });

  it('creates a lead from raw discovery input', async () => {
    mockLeadRepository.create.mockResolvedValue(leadRow);

    const result = await service.ingestRawLead(
      {
        externalId: 'place-1',
        source: 'google_maps',
        sourceType: 'discovery',
        sourceUrl: 'https://maps.example/place-1',
        name: 'Acme Dental',
        company: 'Acme Dental',
        location: 'Austin, TX',
        metadata: {
          placeId: 'place-1',
          rating: 4.8,
          reviewCount: 41,
          googleTypes: ['dentist'],
          businessHours: { monday: '9-5' },
          lastReviewAt: '2026-05-01T00:00:00.000Z',
          socialHandlesFromGmaps: { instagram: '@acme' },
        },
      },
      tenant as any,
      { campaignId: 'camp-1' },
    );

    expect(result).toEqual({ lead: leadRow, created: true, duplicate: false });
    expect(mockLeadRepository.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        campaignId: 'camp-1',
        sourceType: 'discovery',
        placeId: 'place-1',
        rating: 4.8,
        reviewCount: 41,
        contentHash: 'hash-123',
      }),
    });
  });

  it('returns an existing lead for externalId duplicates', async () => {
    mockLeadRepository.findUnique.mockResolvedValue(leadRow);

    const result = await service.ingestRawLead(
      { externalId: 'person-1', source: 'linkedin', name: 'Jane Doe' },
      tenant as any,
    );

    expect(result).toEqual({ lead: leadRow, created: false, duplicate: true });
    expect(mockLeadRepository.create).not.toHaveBeenCalled();
  });

  it('handles unique constraint races by returning the existing lead', async () => {
    mockLeadRepository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    mockLeadRepository.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(leadRow);

    const result = await service.ingestRawLead(
      { externalId: 'person-1', source: 'linkedin', name: 'Jane Doe' },
      tenant as any,
    );

    expect(result).toEqual({ lead: leadRow, created: false, duplicate: true });
  });
});
