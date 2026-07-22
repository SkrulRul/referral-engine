import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { RewardType } from '@prisma/client';

@ValidatorConstraint({ name: 'isValidRewardValue', async: false })
export class IsValidRewardValueConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return false;
    }

    const [typePropertyName] = args.constraints as [string];
    const type = (args.object as Record<string, unknown>)[typePropertyName];

    if (type === RewardType.percentage) {
      return value > 0 && value <= 100;
    }

    return value > 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const [typePropertyName] = args.constraints as [string];
    const type = (args.object as Record<string, unknown>)[typePropertyName];

    return type === RewardType.percentage
      ? 'value must be greater than 0 and at most 100 for a percentage reward rule'
      : 'value must be greater than 0';
  }
}

export function IsValidRewardValue(
  typeProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [typeProperty],
      validator: IsValidRewardValueConstraint,
    });
  };
}
