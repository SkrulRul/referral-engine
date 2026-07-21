import { Injectable, NotFoundException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/paginated-result';
import { paginate } from '../common/paginate';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateOrganizationDto): Promise<Organization> {
    return this.prisma.organization.create({ data: dto });
  }

  findAll(query: PaginationQueryDto): Promise<PaginatedResult<Organization>> {
    return paginate(
      query,
      (args) => this.prisma.organization.findMany(args),
      () => this.prisma.organization.count(),
    );
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization ${id} not found`);
    }

    return organization;
  }
}
