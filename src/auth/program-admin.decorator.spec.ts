import { InternalServerErrorException } from '@nestjs/common';
import { extractProgramAdmin } from './program-admin.decorator';
import { ProgramAdminIdentity } from './auth.guard';

describe('extractProgramAdmin', () => {
  it('returns the programAdmin when present on the request', () => {
    const programAdmin: ProgramAdminIdentity = {
      id: 'admin-id',
      organizationId: 'org-id',
    };

    const result = extractProgramAdmin({ programAdmin });

    expect(result).toEqual(programAdmin);
  });

  it('throws InternalServerErrorException when programAdmin is missing from the request', () => {
    expect(() => extractProgramAdmin({ programAdmin: undefined })).toThrow(
      InternalServerErrorException,
    );
  });
});
