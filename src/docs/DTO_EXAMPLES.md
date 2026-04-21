# DTO Implementation Examples

## Complete Examples of Using DTOs

### 1. Simple POST Endpoint (Create)

```typescript
// vehicle.routes.ts
import { validate } from "../middleware/validation.middleware";
import { CreateVehicleSchema } from "../dto/vehicle.dto";

router.post(
  "/vehicles",
  validate(CreateVehicleSchema),
  vehicleController.createVehicle,
);

// vehicle.controller.ts
import { ValidatedRequest } from "../middleware/validation.middleware";
import { CreateVehicleDTO } from "../dto/vehicle.dto";

export const vehicleController = {
  createVehicle: asyncHandler(
    async (req: ValidatedRequest<CreateVehicleDTO>, res: Response) => {
      const data = req.validated;

      // Type-safe! Autocomplete works:
      // data.registrationNumber (string)
      // data.make (string)
      // data.year (number)
      // data.fuelType ('petrol' | 'diesel' | ...)

      const vehicle = await Vehicle.create(data);
      return createSuccessResponse(
        vehicle,
        "Vehicle created",
        HttpStatus.CREATED,
      );
    },
  ),
};
```

### 2. PUT with Path Parameters

```typescript
// PUT /vehicles/:id
router.put(
  "/vehicles/:id",
  validateParams(IdParamSchema), // Validates :id
  validate(UpdateVehicleSchema), // Validates body
  vehicleController.updateVehicle,
);

// Controller
export const updateVehicle = asyncHandler(
  async (req: ValidatedRequest<UpdateVehicleDTO>, res: Response) => {
    const params = (req as any).validatedParams; // { id: string }
    const updates = req.validated;

    const vehicle = await Vehicle.findByIdAndUpdate(
      params.id,
      { $set: updates },
      { new: true },
    );

    return createSuccessResponse(vehicle);
  },
);
```

### 3. GET with Query Parameters

```typescript
// GET /vehicles?status=active&page=1&limit=20
router.get(
  "/vehicles",
  validateQuery(VehicleFiltersSchema),
  vehicleController.getVehicles,
);

// vehicle.dto.ts
export const VehicleFiltersSchema = z.object({
  status: z.enum(["active", "inactive", "pending"]).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
});

// Controller
export const getVehicles = asyncHandler(
  async (req: ValidatedRequest<any>, res: Response) => {
    const query = (req as any).validatedQuery;
    const { page, limit, sortBy, status } = query;

    const filter: any = { isDeleted: false };
    if (status) filter.status = status;

    const vehicles = await Vehicle.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort(sortBy);

    return createSuccessResponse(vehicles);
  },
);
```

### 4. POST with File Upload

```typescript
import multer from "multer";

// For file uploads, validate body before multer, or extract after
router.post(
  "/vehicles/:id/documents",
  validateParams(IdParamSchema),
  validate(UploadDocumentSchema), // Validate non-file fields
  uploadDocumentMiddleware, // multer for file
  vehicleController.uploadDocument,
);

// In controller, validated body is separate from file
export const uploadDocument = asyncHandler(
  async (req: ValidatedRequest<UploadDocumentDTO>, res: Response) => {
    const params = (req as any).validatedParams;
    const metadata = req.validated; // Form fields
    const file = req.file; // Multer file

    // Process file upload
    const document = await Document.create({
      ...metadata,
      entityId: params.id,
      fileName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      url: `/uploads/${file.filename}`,
    });

    return createSuccessResponse(
      document,
      "Document uploaded",
      HttpStatus.CREATED,
    );
  },
);
```

### 5. Bulk Operations

```typescript
// Bulk delete
export const BulkDeleteSchema = z.object({
  ids: z.array(IdParamSchema).min(1),
});

router.delete(
  "/vehicles/bulk",
  validate(BulkDeleteSchema),
  vehicleController.bulkDelete,
);

export const bulkDelete = asyncHandler(
  async (req: ValidatedRequest<{ ids: string[] }>, res: Response) => {
    const { ids } = req.validated;

    const result = await Vehicle.updateMany(
      { _id: { $in: ids } },
      { isDeleted: true, deletedAt: new Date() },
    );

    return createSuccessResponse(
      { deletedCount: result.modifiedCount },
      "Bulk delete completed",
    );
  },
);
```

### 6. Nested Object Validation

```typescript
// DTO with nested objects
export const CreateServiceRecordSchema = z.object({
  vehicleId: IdParamSchema,
  serviceType: z.enum([...]),
  odometerReading: z.object({
    value: z.number().min(0),
    unit: z.enum(["km", "miles"]),
  }),
  cost: z.object({
    partsTotal: z.number().min(0),
    laborTotal: z.number().min(0),
    tax: z.number().min(0).default(0),
  }),
  partsReplaced: z.array(
    z.object({
      partName: z.string(),
      quantity: z.number().min(1),
      unitCost: z.number().min(0),
    })
  ).optional(),
});

// Controller access - fully typed
const data = req.validated;
console.log(data.odometerReading.value); // number
console.log(data.cost.tax); // number
console.log(data.partsReplaced?.[0]?.partName); // string | undefined
```

### 7. Enum Validation

```typescript
// All enums are type-safe
export const UpdateVehicleSchema = z.object({
  fuelType: z
    .enum(["petrol", "diesel", "electric", "hybrid", "cng", "lpg"])
    .optional(),
  transmission: z.enum(["manual", "automatic", "cvt"]).optional(),
});

// Controller
if (data.fuelType === "electric") {
  // TypeScript knows this is valid
  // data cannot be "diesel" or any other invalid value
}
```

### 8. Optional vs Required

```typescript
// Required field (will fail if missing)
export const CreateVehicleSchema = z.object({
  registrationNumber: z.string().min(1), // REQUIRED
  make: z.string().min(1), // REQUIRED
  vin: z.string().optional(), // OPTIONAL
});

// Update - all optional using .partial()
export const UpdateVehicleSchema = z
  .object({
    registrationNumber: z.string().min(1).optional(),
    make: z.string().min(1).optional(),
    vin: z.string().optional(),
  })
  .partial(); // Makes all fields optional
```

### 9. Custom Validators

```typescript
export const CreateVehicleSchema = z.object({
  year: z
    .number()
    .int()
    .min(1900, "Year must be 1900 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future"),

  vin: z
    .string()
    .length(17, "VIN must be exactly 17 characters")
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "Invalid VIN format")
    .optional(),

  email: z.string().email("Invalid email format").toLowerCase().trim(),
});
```

### 10. Default Values

```typescript
export const CreateReminderSchema = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  isActive: z.boolean().default(true),

  recurrence: z.object({
    enabled: z.boolean().default(false),
    interval: z.number().min(1).default(1),
  }),
});

// If client sends: { title: "Oil Change" }
// req.validated = {
//   title: "Oil Change",
//   priority: "medium",      // auto-filled
//   isActive: true,          // auto-filled
//   recurrence: {            // auto-filled
//     enabled: false,
//     interval: 1
//   }
// }
```

## Tips

1. **Always validate at route level** - Never skip `validate()` middleware
2. **Use specific schemas** - Separate create/update schemas, even if similar
3. **Keep DTOs close to routes** - Easy to maintain and discover
4. **Leverage TypeScript inference** - Use `ValidatedRequest<T>` for autocomplete
5. **Handle missing params separately** - `validateParams()` for `:id` params
6. **Order matters**: `validateParams` → `validate` → controller
7. **For complex logic**, create custom validators:

```typescript
const uniqueEmail = async (email: string): Promise<boolean> => {
  const existing = await Account.findOne({ email });
  return !existing;
};

export const RegisterSchema = z.object({
  email: z.string().email().refine(uniqueEmail, "Email already exists"),
});
```

## Common Patterns

| Scenario        | DTO                                 | Middleware                             |
| --------------- | ----------------------------------- | -------------------------------------- |
| Create resource | `CreateXSchema`                     | `validate(CreateXSchema)`              |
| Update resource | `UpdateXSchema` (with `.partial()`) | `validate(UpdateXSchema)`              |
| Get by ID       | `IdParamSchema`                     | `validateParams(IdParamSchema)`        |
| Filter/List     | `XFiltersSchema`                    | `validateQuery(XFiltersSchema)`        |
| Bulk operation  | `BulkActionSchema`                  | `validate(BulkActionSchema)`           |
| File upload     | `UploadXSchema`                     | `validate(UploadXSchema)` + `multer()` |
