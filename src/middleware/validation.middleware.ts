import { Request, Response, NextFunction } from "express";
import { z, ZodError, ZodSchema } from "zod";
import { ERROR_CODES } from "../constants/errors";

export interface ValidatedRequest<T> extends Request {
  validated?: T;
}

function sendValidationError(req: Request, res: Response, error: ZodError) {
  const errors = error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
  }));
  const def = ERROR_CODES.VALIDATION_FAILED;
  res.status(def.httpStatus).json({
    success: false,
    code: def.code,
    key: def.key,
    correlationId: (req as any).id,
    message: "Validation failed",
    details: errors,
    timestamp: new Date().toISOString(),
  });
}

export const validate = <T extends ZodSchema<any>>(schema: T) => {
  return async (
    req: ValidatedRequest<any>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = schema.parse(req.body);
      req.validated = validatedData as T;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendValidationError(req, res, error);
      }
      next(error);
    }
  };
};

export const validateQuery = <T extends ZodSchema<any>>(schema: T) => {
  return async (
    req: ValidatedRequest<any>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = schema.parse(req.query);
      req.validated = validatedData as T;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendValidationError(req, res, error);
      }
      next(error);
    }
  };
};

export const validateParams = <T extends ZodSchema<any>>(schema: T) => {
  return async (
    req: ValidatedRequest<any>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = schema.parse(req.params);
      req.validated = validatedData as T;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendValidationError(req, res, error);
      }
      next(error);
    }
  };
};
