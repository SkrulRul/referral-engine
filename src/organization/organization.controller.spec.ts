import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

describe('OrganizationController', () => {
  let controller: OrganizationController;
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
    controller = new OrganizationController(
      service as unknown as OrganizationService,
    );
  });

  it('delegates create to the service', async () => {
    service.create.mockResolvedValue({ id: 'org_1', name: 'Acme Inc' });

    const result = await controller.create({ name: 'Acme Inc' });

    expect(service.create).toHaveBeenCalledWith({ name: 'Acme Inc' });
    expect(result).toEqual({ id: 'org_1', name: 'Acme Inc' });
  });

  it('delegates findAll to the service with the pagination query', async () => {
    const paginated = {
      data: [{ id: 'org_1', name: 'Acme Inc' }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    service.findAll.mockResolvedValue(paginated);

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result).toEqual(paginated);
  });

  it('delegates findOne to the service', async () => {
    service.findOne.mockResolvedValue({ id: 'org_1', name: 'Acme Inc' });

    const result = await controller.findOne('org_1');

    expect(service.findOne).toHaveBeenCalledWith('org_1');
    expect(result).toEqual({ id: 'org_1', name: 'Acme Inc' });
  });
});
