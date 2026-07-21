import { NotFoundException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: {
    organization: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
  };

  const organization: Organization = {
    id: 'org_1',
    name: 'Acme Inc',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      organization: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new OrganizationService(prisma as unknown as PrismaService);
  });

  it('creates an organization', async () => {
    prisma.organization.create.mockResolvedValue(organization);

    const result = await service.create({ name: 'Acme Inc' });

    expect(prisma.organization.create).toHaveBeenCalledWith({
      data: { name: 'Acme Inc' },
    });
    expect(result).toEqual(organization);
  });

  it('lists organizations with pagination metadata', async () => {
    prisma.organization.findMany.mockResolvedValue([organization]);
    prisma.organization.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({
      data: [organization],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
  });

  it('computes skip from the requested page', async () => {
    prisma.organization.findMany.mockResolvedValue([]);
    prisma.organization.count.mockResolvedValue(45);

    const result = await service.findAll({ page: 3, limit: 20 });

    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      skip: 40,
      take: 20,
    });
    expect(result.meta).toEqual({
      total: 45,
      page: 3,
      limit: 20,
      totalPages: 3,
    });
  });

  it('returns an organization by id', async () => {
    prisma.organization.findUnique.mockResolvedValue(organization);

    const result = await service.findOne('org_1');

    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org_1' },
    });
    expect(result).toEqual(organization);
  });

  it('throws NotFoundException when the organization does not exist', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
