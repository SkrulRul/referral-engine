import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Payout,
  PayoutStatus,
  Referral,
  ReferralStatus,
  RewardRule,
  RewardType,
} from '@prisma/client';
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

const REFERRAL_WITH_CODE_CAMPAIGN_AND_PAYOUT = {
  include: {
    ...REFERRAL_WITH_CODE_AND_CAMPAIGN.include,
    payout: true,
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

  async convert(id: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      include: {
        referralCode: {
          include: { campaign: { include: { rewardRule: true } } },
        },
      },
    });

    if (!referral) {
      throw new NotFoundException(`Referral ${id} not found`);
    }

    if (referral.status === ReferralStatus.pending) {
      const rewardRule = referral.referralCode.campaign.rewardRule;

      if (!rewardRule) {
        throw new UnprocessableEntityException(
          "Referral's campaign has no reward rule defined",
        );
      }

      if (rewardRule.type === RewardType.percentage) {
        throw new UnprocessableEntityException(
          'Percentage-based reward calculation is not yet supported',
        );
      }

      await this.applyConversion(id, rewardRule);
    }

    return this.prisma.referral.findUniqueOrThrow({
      where: { id },
      ...REFERRAL_WITH_CODE_CAMPAIGN_AND_PAYOUT,
    });
  }

  private async applyConversion(
    id: string,
    rewardRule: RewardRule,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.referral.updateMany({
        where: { id, status: ReferralStatus.pending },
        data: { status: ReferralStatus.converted },
      });

      if (updated.count > 0) {
        await tx.payout.create({
          data: {
            referralId: id,
            amount: rewardRule.value,
            status: PayoutStatus.pending,
          },
        });
      }
    });
  }

  async findPayout(referralId: string): Promise<Payout> {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: { id: true },
    });

    if (!referral) {
      throw new NotFoundException(`Referral ${referralId} not found`);
    }

    const payout = await this.prisma.payout.findUnique({
      where: { referralId },
    });

    if (!payout) {
      throw new NotFoundException(`Referral ${referralId} has no payout`);
    }

    return payout;
  }
}
