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

    const now = new Date();
    if (now < campaign.startDate || now > campaign.endDate) {
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
        if (this.isCodeCollision(error)) {
          continue;
        }
        throw error;
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

  // Under @prisma/adapter-pg, P2002's `meta.target` is undefined; the violated
  // constraint's columns live at meta.driverAdapterError.cause.constraint.fields.
  private isCodeCollision(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const fields = (
      error.meta as
        | {
            driverAdapterError?: {
              cause?: { constraint?: { fields?: unknown } };
            };
          }
        | undefined
    )?.driverAdapterError?.cause?.constraint?.fields;

    return Array.isArray(fields) && fields.includes('code');
  }
}
