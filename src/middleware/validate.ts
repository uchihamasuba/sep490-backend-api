import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

// Validates + coerces req[part] against `schema`, then reassigns the parsed value
// back onto the request so downstream handlers read clean, typed data.
// NOTE: Express 5 makes `req.query` a getter-only accessor, so it must be
// overridden via defineProperty rather than plain assignment.
export function validate(schema: ZodType, part: RequestPart = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(result.error);
    }
    if (part === 'query') {
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[part] = result.data;
    }
    next();
  };
}
