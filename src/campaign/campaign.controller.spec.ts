import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';

describe('CampaignController', () => {
  let controller: CampaignController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };
    controller = new CampaignController(service as unknown as CampaignService);
  });

  it('delegates create to the service', async () => {
    const dto = {
      name: 'Referral drive',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      organizationId: 'org_1',
    };
    service.create.mockResolvedValue({ id: 'camp_1', ...dto });

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'camp_1', ...dto });
  });

  it('delegates findAll to the service', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('delegates findOne to the service', async () => {
    service.findOne.mockResolvedValue({ id: 'camp_1' });

    const result = await controller.findOne('camp_1');

    expect(service.findOne).toHaveBeenCalledWith('camp_1');
    expect(result).toEqual({ id: 'camp_1' });
  });
});
