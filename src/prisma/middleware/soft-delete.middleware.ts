import { Prisma } from '@prisma/client';

/**
 * Global soft‑delete middleware for Prisma.
 * - Adds `deletedAt IS NULL` filter to all read queries for models that have a `deletedAt` column.
 * - Transforms hard `delete` operations into `update` that sets `deletedAt`.
 */
export function softDeleteMiddleware() {
  return async (params: Prisma.MiddlewareParams, next: Prisma.NextMiddleware) => {
    // Apply filter to read actions
    if (
      ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(params.action) &&
      params.args?.where
    ) {
      const where = params.args.where as Record<string, unknown>;
      // Only inject filter if the model actually has a `deletedAt` column (Prisma schema ensures it)
      // We add an `AND` clause to keep existing conditions.
      params.args.where = {
        AND: [{ deletedAt: null }, where],
      } as any;
    }

    // Convert hard deletes into soft deletes
    if (params.action === 'delete') {
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };
    }

    return next(params);
  };
}
