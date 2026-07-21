import { NotFoundException } from '@nestjs/common';
import { Campaign } from '@prisma/client';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

describe('CampaignService', () => {
  let service: CampaignService;
  let prisma: {
    organization: { findUnique: jest.Mock };
    campaign: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
  };

  const createDto: CreateCampaignDto = {
    name: 'Referral drive',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-31T00:00:00.000Z'),
    organizationId: 'org_1',
  };

  const campaign: Campaign = {
    id: 'camp_1',
    name: createDto.name,
    startDate: createDto.startDate,
    endDate: createDto.endDate,
    organizationId: 'org_1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn() },
      campaign: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new CampaignService(prisma as unknown as PrismaService);
  });

  it('creates a campaign when the organization exists', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org_1' });
    prisma.campaign.create.mockResolvedValue(campaign);

    const result = await service.create(createDto);

    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      select: { id: true },
    });
    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: createDto }),
    );
    expect(result).toEqual(campaign);
  });

  it('throws NotFoundException instead of creating a campaign for a missing organization', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    expect(prisma.campaign.create).not.toHaveBeenCalled();
  });

  it('lists campaigns with their organization and pagination metadata', async () => {
    prisma.campaign.findMany.mockResolvedValue([campaign]);
    prisma.campaign.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      include: { organization: { select: { id: true, name: true } } },
    });
    expect(result).toEqual({
      data: [campaign],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
  });

  it('returns a campaign by id', async () => {
    prisma.campaign.findUnique.mockResolvedValue(campaign);

    const result = await service.findOne('camp_1');

    expect(result).toEqual(campaign);
  });

  it('throws NotFoundException when the campaign does not exist', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  describe('isActive', () => {
    // Falls inside the fixture campaign's window (2026-01-01 .. 2026-01-31).
    const referenceDate = new Date('2026-01-15T00:00:00.000Z');

    it('returns true when the reference date falls within the campaign window', () => {
      expect(service.isActive(campaign, referenceDate)).toBe(true);
    });

    it('returns false when the reference date is before the campaign starts', () => {
      expect(
        service.isActive(
          {
            ...campaign,
            startDate: new Date('2026-02-01T00:00:00.000Z'),
            endDate: new Date('2026-02-28T00:00:00.000Z'),
          },
          referenceDate,
        ),
      ).toBe(false);
    });

    it('returns false when the reference date is after the campaign ends', () => {
      expect(
        service.isActive(
          {
            ...campaign,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            endDate: new Date('2026-01-10T00:00:00.000Z'),
          },
          referenceDate,
        ),
      ).toBe(false);
    });

    it('defaults the reference date to now when none is provided', () => {
      const activeCampaign = {
        ...campaign,
        startDate: new Date(Date.now() - 1000),
        endDate: new Date(Date.now() + 1000),
      };

      expect(service.isActive(activeCampaign)).toBe(true);
    });
  });
});
