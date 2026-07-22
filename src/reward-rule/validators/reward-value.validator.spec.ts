import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateRewardRuleDto } from '../dto/create-reward-rule.dto';

async function validateValue(type: unknown, value: unknown) {
  const dto = plainToInstance(CreateRewardRuleDto, {
    campaignId: '00000000-0000-0000-0000-000000000000',
    type,
    value,
  });

  return validate(dto);
}

function valueErrorOf(errors: Awaited<ReturnType<typeof validateValue>>) {
  return errors.find((error) => error.property === 'value');
}

describe('IsValidRewardValue', () => {
  describe('fixed reward rules', () => {
    it('passes for a positive value', async () => {
      const errors = await validateValue('fixed', 50);
      expect(valueErrorOf(errors)).toBeUndefined();
    });

    it('rejects zero', async () => {
      const errors = await validateValue('fixed', 0);
      expect(valueErrorOf(errors)?.constraints).toHaveProperty(
        'isValidRewardValue',
      );
    });

    it('rejects a negative value', async () => {
      const errors = await validateValue('fixed', -10);
      expect(valueErrorOf(errors)?.constraints).toHaveProperty(
        'isValidRewardValue',
      );
    });
  });

  describe('percentage reward rules', () => {
    it('passes for a value between 0 and 100', async () => {
      const errors = await validateValue('percentage', 10);
      expect(valueErrorOf(errors)).toBeUndefined();
    });

    it('passes for exactly 100', async () => {
      const errors = await validateValue('percentage', 100);
      expect(valueErrorOf(errors)).toBeUndefined();
    });

    it('rejects zero', async () => {
      const errors = await validateValue('percentage', 0);
      expect(valueErrorOf(errors)?.constraints).toHaveProperty(
        'isValidRewardValue',
      );
    });

    it('rejects a negative value', async () => {
      const errors = await validateValue('percentage', -5);
      expect(valueErrorOf(errors)?.constraints).toHaveProperty(
        'isValidRewardValue',
      );
    });

    it('rejects a value over 100', async () => {
      const errors = await validateValue('percentage', 101);
      expect(valueErrorOf(errors)?.constraints).toHaveProperty(
        'isValidRewardValue',
      );
    });
  });

  it('rejects a non-numeric value', async () => {
    const errors = await validateValue('fixed', 'not-a-number');
    expect(valueErrorOf(errors)?.constraints).toHaveProperty(
      'isValidRewardValue',
    );
  });
});
