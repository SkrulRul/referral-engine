import { Injectable, NotFoundException } from '@nestjs/common';
import { Campaign } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/paginated-result';
import { paginate } from '../common/paginate';

const CAMPAIGN_WITH_ORGANIZATION = {
  include: { organization: { select: { id: true, name: true } } },
} as const;

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organization ${dto.organizationId} not found`,
      );
    }

    return this.prisma.campaign.create({
      data: dto,
      ...CAMPAIGN_WITH_ORGANIZATION,
    });
  }

  findAll(query: PaginationQueryDto): Promise<PaginatedResult<Campaign>> {
    return paginate(
      query,
      (args) =>
        this.prisma.campaign.findMany({
          ...args,
          ...CAMPAIGN_WITH_ORGANIZATION,
        }),
      () => this.prisma.campaign.count(),
    );
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      ...CAMPAIGN_WITH_ORGANIZATION,
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    return campaign;
  }

  isActive(
    campaign: Pick<Campaign, 'startDate' | 'endDate'>,
    referenceDate: Date = new Date(),
  ): boolean {
    return (
      referenceDate >= campaign.startDate && referenceDate <= campaign.endDate
    );
  }
}
