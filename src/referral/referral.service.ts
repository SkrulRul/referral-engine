import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Referral } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ReferralCodeService } from '../referral-code/referral-code.service';
import { CreateReferralDto } from './dto/create-referral.dto';

const REFERRAL_WITH_CODE_AND_CAMPAIGN = {
  include: {
    referralCode: {
      select: {
        id: true,
        code: true,
        campaign: { select: { id: true, name: true } },
      },
    },
  },
} as const;

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignService: CampaignService,
    private readonly referralCodeService: ReferralCodeService,
  ) {}

  async register(dto: CreateReferralDto): Promise<Referral> {
    const referralCode = await this.referralCodeService.findByCode(
      dto.referralCode,
    );
    const campaign = await this.campaignService.findOne(
      referralCode.campaignId,
    );

    if (!this.campaignService.isActive(campaign)) {
      throw new UnprocessableEntityException(
        'Campaign is not currently active',
      );
    }

    return this.prisma.referral.upsert({
      where: {
        referralCodeId_refereeEmail: {
          referralCodeId: referralCode.id,
          refereeEmail: dto.refereeEmail,
        },
      },
      update: {},
      create: {
        referralCodeId: referralCode.id,
        refereeEmail: dto.refereeEmail,
        refereeName: dto.refereeName,
      },
      ...REFERRAL_WITH_CODE_AND_CAMPAIGN,
    });
  }

  async findOne(id: string): Promise<Referral> {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      ...REFERRAL_WITH_CODE_AND_CAMPAIGN,
    });

    if (!referral) {
      throw new NotFoundException(`Referral ${id} not found`);
    }

    return referral;
  }
}
