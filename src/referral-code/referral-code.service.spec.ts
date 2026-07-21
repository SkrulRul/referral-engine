import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Campaign, Prisma, ReferralCode } from '@prisma/client';
import { ReferralCodeService } from './referral-code.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';

describe('ReferralCodeService', () => {
  let service: ReferralCodeService;
  let prisma: {
    referralCode: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let campaignService: { findOne: jest.Mock; isActive: jest.Mock };

  const createDto: CreateReferralCodeDto = {
    campaignId: 'camp_1',
    referrerEmail: 'referrer@example.com',
  };

  const activeCampaign: Campaign = {
    id: 'camp_1',
    name: 'Referral drive',
    startDate: new Date('2020-01-01T00:00:00.000Z'),
    endDate: new Date('2030-01-01T00:00:00.000Z'),
    organizationId: 'org_1',
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  };

  const referralCode: ReferralCode = {
    id: 'ref_1',
    code: 'ABCD1234',
    campaignId: 'camp_1',
    referrerEmail: 'referrer@example.com',
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      referralCode: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    campaignService = { findOne: jest.fn(), isActive: jest.fn() };
    service = new ReferralCodeService(
      prisma as unknown as PrismaService,
      campaignService as unknown as CampaignService,
    );
  });

  describe('create', () => {
    it('returns the referral code resolved by upsert, whether newly created or already existing', async () => {
      campaignService.findOne.mockResolvedValue(activeCampaign);
      campaignService.isActive.mockReturnValue(true);
      prisma.referralCode.upsert.mockResolvedValue(referralCode);

      const result = await service.create(createDto);

      expect(campaignService.findOne).toHaveBeenCalledWith(
        createDto.campaignId,
      );
      expect(prisma.referralCode.upsert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(referralCode);
    });

    it('retries with a new code when the upsert hits a code collision', async () => {
      campaignService.findOne.mockResolvedValue(activeCampaign);
      campaignService.isActive.mockReturnValue(true);

      const collisionError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: {
            modelName: 'ReferralCode',
            driverAdapterError: {
              name: 'DriverAdapterError',
              cause: {
                originalCode: '23505',
                originalMessage:
                  'duplicate key value violates unique constraint "referral_codes_code_key"',
                kind: 'UniqueConstraintViolation',
                constraint: { fields: ['code'] },
              },
            },
          },
        },
      );

      prisma.referralCode.upsert
        .mockRejectedValueOnce(collisionError)
        .mockResolvedValueOnce(referralCode);

      const result = await service.create(createDto);

      expect(prisma.referralCode.upsert).toHaveBeenCalledTimes(2);
      expect(result).toEqual(referralCode);
    });

    it('throws UnprocessableEntityException when the campaign is not active', async () => {
      campaignService.findOne.mockResolvedValue(activeCampaign);
      campaignService.isActive.mockReturnValue(false);

      await expect(service.create(createDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(prisma.referralCode.upsert).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when the campaign does not exist', async () => {
      campaignService.findOne.mockRejectedValue(
        new NotFoundException(`Campaign ${createDto.campaignId} not found`),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.referralCode.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findByCode', () => {
    it('returns the referral code when found', async () => {
      prisma.referralCode.findUnique.mockResolvedValue(referralCode);

      const result = await service.findByCode('ABCD1234');

      expect(result).toEqual(referralCode);
    });

    it('throws NotFoundException when the referral code does not exist', async () => {
      prisma.referralCode.findUnique.mockResolvedValue(null);

      await expect(service.findByCode('MISSING')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
