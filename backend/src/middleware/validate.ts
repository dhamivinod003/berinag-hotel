import type { Request, Response, NextFunction } from "express";
import { z, type ZodTypeAny } from "zod";
import { ValidationError } from "../utils/errors.js";

type Source = "body" | "query" | "params";

export function validate<T extends ZodTypeAny>(schema: T, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new ValidationError("Validation failed", result.error.flatten()));
      return;
    }
    // Replace with parsed (and stripped) data.
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
}

// Common helpers
export const objectId = z.string().min(1).max(64);
export const cuid = z.string().regex(/^c[a-z0-9]{20,}$/i, "Invalid id");
export const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
