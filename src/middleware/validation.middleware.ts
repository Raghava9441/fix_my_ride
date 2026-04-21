import { Request, Response, NextFunction } from "express";
import { z, ZodError, ZodSchema } from "zod";

export interface ValidatedRequest<T> extends Request {
  validated?: T;
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
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
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
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
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
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }
      next(error);
    }
  };
};
