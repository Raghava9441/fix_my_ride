# DTO Usage Guide

## Overview

DTOs (Data Transfer Objects) use Zod for runtime validation and TypeScript type inference. They ensure type safety and validate incoming requests.

## 1. Validation Middleware

The `validation.middleware.ts` provides three middleware functions:

### `validate(schema)`

Validates request body. Use for POST/PUT/PATCH requests.

### `validateQuery(schema)`

Validates query parameters. Use for GET requests with query params.

### `validateParams(schema)`

Validates route parameters (e.g., `:id`). Use for routes with dynamic params.

## 2. Using DTOs in Routes

### Example: Account Routes with DTOs

```typescript
import { Router, Request, Response } from "express";
import { validate, validateParams } from "../middleware/validation.middleware";
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  AssignRoleSchema,
  SwitchRoleSchema,
  UpdateAccountStatusSchema,
} from "../dto/account.dto";
import { accountController } from "../controllers/account.controller";

const router = Router();

// POST /accounts - Create account with validation
router.post(
  "/accounts",
  validate(CreateAccountSchema),
  accountController.createAccount,
);

// PUT /accounts/:id - Update account
router.put(
  "/accounts/:id",
  validateParams(IdParamSchema),
  validate(UpdateAccountSchema),
  accountController.updateAccount,
);

// POST /accounts/:id/roles - Assign role
router.post(
  "/accounts/:id/roles",
  validateParams(IdParamSchema),
  validate(AssignRoleSchema),
  accountController.assignRole,
);

// PATCH /accounts/:id/status - Update status
router.patch(
  "/accounts/:id/status",
  validateParams(IdParamSchema),
  validate(UpdateAccountStatusSchema),
  accountController.updateAccountStatus,
);
```

## 3. Accessing Validated Data

In your controller, access validated data via `req.validated`:

```typescript
export const accountController = {
  createAccount: asyncHandler(async (req: Request, res: Response) => {
    // Access validated body
    const validatedBody = req.validated; // Type: CreateAccountDTO

    // Use validated data directly - it's already type-safe
    const { email, password, primaryRole, tenantId } = validatedBody;

    // Create account...
    const account = await Account.create({
      email,
      passwordHash: password,
      primaryRole,
      tenantId,
    });

    return createSuccessResponse(
      account,
      "Account created",
      HttpStatus.CREATED,
    );
  }),

  updateAccount: asyncHandler(async (req: Request, res: Response) => {
    // For validations with multiple middleware, validated data is merged
    const params = (req as any).validatedParams; // from validateParams
    const body = req.validated; // from validate

    const account = await Account.findByIdAndUpdate(params.id, body, {
      new: true,
    });

    return createSuccessResponse(account);
  }),
};
```

## 4. Custom Validation Middleware Setup

To handle multiple validation sources, extend the middleware:

```typescript
// In validation.middleware.ts, add support for params:
export const validateAll = (
  paramsSchema?: ZodSchema,
  bodySchema?: ZodSchema,
  querySchema?: ZodSchema,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result: any = { ...req.query, ...req.body, ...req.params };

      if (paramsSchema) {
        const parsedParams = paramsSchema.parse(req.params);
        (req as any).validatedParams = parsedParams;
      }
      if (bodySchema) {
        const parsedBody = bodySchema.parse(req.body);
        req.validated = parsedBody;
      }
      if (querySchema) {
        const parsedQuery = querySchema.parse(req.query);
        (req as any).validatedQuery = parsedQuery;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};
```

## 5. Example: Vehicle Routes

```typescript
import { Router } from "express";
import {
  validate,
  validateParams,
  validateQuery,
} from "../middleware/validation.middleware";
import {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  AuthorizeCenterSchema,
  UpdateOdometerSchema,
} from "../dto/vehicle.dto";

const router = Router();

// POST /vehicles - Create vehicle
router.post(
  "/vehicles",
  validate(CreateVehicleSchema),
  vehicleController.createVehicle,
);

// PUT /vehicles/:id - Update vehicle
router.put(
  "/vehicles/:id",
  validateParams(IdParamSchema),
  validate(UpdateVehicleSchema),
  vehicleController.updateVehicle,
);

// POST /vehicles/:id/service-centers - Authorize center
router.post(
  "/vehicles/:id/service-centers",
  validateParams(IdParamSchema),
  validate(AuthorizeCenterSchema),
  vehicleController.authorizeCenter,
);

// POST /vehicles/:id/odometer - Update odometer
router.post(
  "/vehicles/:id/odometer",
  validateParams(IdParamSchema),
  validate(UpdateOdometerSchema),
  vehicleController.updateOdometer,
);
```

## 6. Controller Implementation

```typescript
import { ValidatedRequest } from "../middleware/validation.middleware";
import { CreateVehicleDTO } from "../dto/vehicle.dto";

export const vehicleController = {
  createVehicle: asyncHandler(
    async (req: ValidatedRequest<CreateVehicleDTO>, res: Response) => {
      const data = req.validated; // Fully typed!

      // data has type safety:
      // - registrationNumber: string (uppercase enforced by Zod)
      // - vin: string | undefined (optional)
      // - make: string (required)
      // etc.

      const vehicle = await Vehicle.create(data);
      return createSuccessResponse(
        vehicle,
        "Vehicle created",
        HttpStatus.CREATED,
      );
    },
  ),

  updateVehicle: asyncHandler(
    async (req: ValidatedRequest<UpdateVehicleDTO>, res: Response) => {
      const id = (req as any).validatedParams.id;
      const updates = req.validated;

      const vehicle = await Vehicle.findByIdAndUpdate(id, updates, {
        new: true,
      });
      return createSuccessResponse(vehicle);
    },
  ),
};
```

## 7. Testing DTOs

```typescript
import { CreateAccountSchema } from "../dto/account.dto";

// Test valid data
const validData = {
  email: "test@example.com",
  password: "Pass123",
  firstName: "John",
  lastName: "Doe",
  primaryRole: "owner",
};

const result = CreateAccountSchema.parse(validData);
// result is typed as CreateAccountDTO

// Test invalid data - throws ZodError
try {
  CreateAccountSchema.parse({
    email: "invalid-email",
    password: "weak",
  });
} catch (error) {
  if (error instanceof ZodError) {
    console.log(error.errors);
    // [
    //   { path: ["email"], message: "Invalid email address" },
    //   { path: ["password"], message: "Password must be at least 8 characters" }
    // ]
  }
}
```

## 8. Optional: Validation Helper for Partial Updates

For PATCH endpoints where all fields are optional:

```typescript
// All update schemas already use .partial()
// This makes all fields optional automatically

router.patch(
  "/accounts/:id",
  validateParams(IdParamSchema),
  validate(UpdateAccountSchema), // All fields optional
  accountController.updateAccount,
);
```

## 9. Benefits

✅ **Type Safety**: `req.validated` is fully typed  
✅ **Runtime Validation**: Zod validates at runtime  
✅ **Auto Documentation**: Schema shape shows expected data  
✅ **Consistent Errors**: Uniform error format  
✅ **DRY**: Define schema once, use everywhere

## 10. Next Steps

1. Update all route files to use DTOs with `validate()` middleware
2. Update controllers to use `ValidatedRequest<T>` type
3. Remove old inline validation code
4. Add unit tests for DTO validation
5. Consider adding custom validators for complex rules
