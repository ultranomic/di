import { DIError } from '@ultranomic/di';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof DIError) {
    return c.json({ error: { code: err.code } }, 500);
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  throw err;
};
