import { NotFoundException } from '@nestjs/common';
import { Campaign, RewardRule, RewardType } from '@prisma/client';
import { RewardRuleService } from './reward-rule.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';

describe('RewardRuleService', () => {
  let service: RewardRuleService;
  let prisma: {
    rewardRule: { create: jest.Mock; findUnique: jest.Mock };
  };
  let campaignService: { findOne: jest.Mock };

  const createDto: CreateRewardRuleDto = {
    campaignId: 'camp_1',
    type: RewardType.fixed,
    value: 50,
  };

  const campaign: Campaign = {
    id: 'camp_1',
    name: 'Referral drive',
    startDate: new Date('2020-01-01T00:00:00.000Z'),
    endDate: new Date('2030-01-01T00:00:00.000Z'),
    organizationId: 'org_1',
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  };

  const rewardRule = {
    id: 'rule_1',
    campaignId: 'camp_1',
    type: RewardType.fixed,
    value: 50,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  } as unknown as RewardRule;

  beforeEach(() => {
    prisma = {
      rewardRule: { create: jest.fn(), findUnique: jest.fn() },
    };
    campaignService = { findOne: jest.fn() };
    service = new RewardRuleService(
      prisma as unknown as PrismaService,
      campaignService as unknown as CampaignService,
    );
  });

  describe('create', () => {
    it('creates a reward rule when the campaign exists', async () => {
      campaignService.findOne.mockResolvedValue(campaign);
      prisma.rewardRule.create.mockResolvedValue(rewardRule);

      const result = await service.create(createDto);

      expect(campaignService.findOne).toHaveBeenCalledWith(
        createDto.campaignId,
      );
      expect(prisma.rewardRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            campaignId: createDto.campaignId,
            type: createDto.type,
            value: createDto.value,
          },
        }),
      );
      expect(result).toEqual(rewardRule);
    });

    it('propagates NotFoundException when the campaign does not exist', async () => {
      campaignService.findOne.mockRejectedValue(
        new NotFoundException(`Campaign ${createDto.campaignId} not found`),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.rewardRule.create).not.toHaveBeenCalled();
    });
  });

  describe('findByCampaign', () => {
    it('returns the reward rule when found', async () => {
      prisma.rewardRule.findUnique.mockResolvedValue(rewardRule);

      const result = await service.findByCampaign('camp_1');

      expect(result).toEqual(rewardRule);
    });

    it('throws NotFoundException when the campaign has no reward rule', async () => {
      prisma.rewardRule.findUnique.mockResolvedValue(null);

      await expect(service.findByCampaign('camp_1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
