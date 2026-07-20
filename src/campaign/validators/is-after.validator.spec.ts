import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCampaignDto } from '../dto/create-campaign.dto';

async function validateDates(startDate: unknown, endDate: unknown) {
  const dto = plainToInstance(CreateCampaignDto, {
    name: 'Referral drive',
    organizationId: 'org_1',
    startDate,
    endDate,
  });

  return validate(dto);
}

describe('IsAfter (endDate > startDate)', () => {
  it('passes when endDate is after startDate', async () => {
    const errors = await validateDates(
      '2026-01-01T00:00:00.000Z',
      '2026-01-31T00:00:00.000Z',
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects an inverted range', async () => {
    const errors = await validateDates(
      '2026-01-31T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    );

    const endDateError = errors.find((error) => error.property === 'endDate');
    expect(endDateError?.constraints).toHaveProperty('isAfter');
  });

  it('rejects an equal start and end date', async () => {
    const errors = await validateDates(
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    );

    const endDateError = errors.find((error) => error.property === 'endDate');
    expect(endDateError?.constraints).toHaveProperty('isAfter');
  });

  it('compares real instants, not lexical strings, across mixed UTC offsets', async () => {
    // 09:00+02:00 == 07:00Z, which is before 08:00Z — but lexically
    // "...+02:00" > "...Z" would wrongly look "after" if compared as raw strings.
    const errors = await validateDates(
      '2026-01-01T08:00:00.000Z',
      '2026-01-01T09:00:00.000+02:00',
    );

    const endDateError = errors.find((error) => error.property === 'endDate');
    expect(endDateError?.constraints).toHaveProperty('isAfter');
  });

  it('degrades to a validation failure (not a throw) when endDate is unparseable', async () => {
    await expect(
      validateDates('2026-01-01T00:00:00.000Z', 'not-a-date'),
    ).resolves.not.toThrow();

    const errors = await validateDates(
      '2026-01-01T00:00:00.000Z',
      'not-a-date',
    );
    const endDateError = errors.find((error) => error.property === 'endDate');
    expect(endDateError).toBeDefined();
  });

  it('degrades to a validation failure (not a throw) when startDate is missing', async () => {
    await expect(
      validateDates(undefined, '2026-01-01T00:00:00.000Z'),
    ).resolves.not.toThrow();
  });
});
