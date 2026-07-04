import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

/**
 * Generic Zod validation middleware factory.
 * Validates `req.body` against the provided Zod schema.
 * Returns a 400 error with formatted field errors if validation fails.
 *
 * @param schema - A Zod schema to validate against
 * @returns Express middleware
 *
 * @example
 * router.post('/users', validate(createUserSchema), controller.create);
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Parse and replace body with validated/transformed data
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((e) => {
          const path = e.path.join('.');
          return path ? `${path}: ${e.message}` : e.message;
        });
        next(ApiError.badRequest('Validation failed', formattedErrors));
        return;
      }
      next(error);
    }
  };
};
