import { Injectable, NotFoundException } from '@nestjs/common';
import { Campaign } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

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

  findAll(): Promise<Campaign[]> {
    return this.prisma.campaign.findMany(CAMPAIGN_WITH_ORGANIZATION);
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
}
