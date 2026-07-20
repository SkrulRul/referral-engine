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

  it('lists all campaigns with their organization', async () => {
    prisma.campaign.findMany.mockResolvedValue([campaign]);

    const result = await service.findAll();

    expect(result).toEqual([campaign]);
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
});
