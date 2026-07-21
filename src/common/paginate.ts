import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResult } from './dto/paginated-result';

export async function paginate<T>(
  query: PaginationQueryDto,
  findMany: (args: { skip: number; take: number }) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<PaginatedResult<T>> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    findMany({ skip, take: limit }),
    count(),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
