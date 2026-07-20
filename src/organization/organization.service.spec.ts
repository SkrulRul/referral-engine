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

  it('lists all organizations', async () => {
    prisma.organization.findMany.mockResolvedValue([organization]);

    const result = await service.findAll();

    expect(result).toEqual([organization]);
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
