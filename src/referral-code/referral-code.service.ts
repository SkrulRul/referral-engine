import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ReferralCode } from '@prisma/client';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';

const REFERRAL_CODE_WITH_CAMPAIGN = {
  include: { campaign: { select: { id: true, name: true } } },
} as const;

const MAX_CODE_GENERATION_ATTEMPTS = 5;

@Injectable()
export class ReferralCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignService: CampaignService,
  ) {}

  async create(dto: CreateReferralCodeDto): Promise<ReferralCode> {
    const campaign = await this.campaignService.findOne(dto.campaignId);

    if (!this.campaignService.isActive(campaign)) {
      throw new UnprocessableEntityException(
        'Campaign is not currently active',
      );
    }

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = nanoid(8);
      try {
        return await this.prisma.referralCode.upsert({
          where: {
            campaignId_referrerEmail: {
              campaignId: dto.campaignId,
              referrerEmail: dto.referrerEmail,
            },
          },
          update: {},
          create: {
            code,
            campaignId: dto.campaignId,
            referrerEmail: dto.referrerEmail,
          },
          ...REFERRAL_CODE_WITH_CAMPAIGN,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }

        // Either the self-generated `code` collided (retry with a new one)
        // or a concurrent identical request already created the row for
        // this campaign+referrer (return it). Re-fetching by the natural
        // key tells us which, without depending on Prisma/adapter-internal
        // error shapes to identify the violated constraint.
        const existing = await this.prisma.referralCode.findUnique({
          where: {
            campaignId_referrerEmail: {
              campaignId: dto.campaignId,
              referrerEmail: dto.referrerEmail,
            },
          },
          ...REFERRAL_CODE_WITH_CAMPAIGN,
        });
        if (existing) {
          return existing;
        }
      }
    }

    throw new ConflictException(
      'Could not generate a unique referral code, please retry',
    );
  }

  async findByCode(code: string): Promise<ReferralCode> {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
      ...REFERRAL_CODE_WITH_CAMPAIGN,
    });

    if (!referralCode) {
      throw new NotFoundException(`Referral code ${code} not found`);
    }

    return referralCode;
  }
}
