# DTOs Created - Quick Reference

## File Structure

```
src/
├── dto/
│   ├── index.ts                    # Barrel export
│   ├── auth.dto.ts                 # Authentication
│   ├── account.dto.ts              # Account management
│   ├── tenant.dto.ts               # Tenant management
│   ├── role.dto.ts                 # Role-based access control
│   ├── permission.dto.ts           # Permissions
│   ├── staff.dto.ts                # Staff profiles
│   ├── owner.dto.ts                # Owner profiles
│   ├── vehicle.dto.ts              # Vehicles
│   ├── service-center.dto.ts       # Service centers
│   ├── service-record.dto.ts       # Service records
│   ├── invitation.dto.ts           # Invitations
│   ├── reminder.dto.ts             # Reminders (inferred)
│   ├── notification.dto.ts         # Notifications
│   ├── document.dto.ts             # Documents
│   ├── subscription-plan.dto.ts    # Subscription plans
│   ├── payment.dto.ts              # Payments
│   ├── odometer-reading.dto.ts     # Odometer readings
│   ├── audit-log.dto.ts            # Audit logs
│   ├── report.dto.ts               # Reports
│   └── common.dto.ts               # Shared schemas (pagination, ID param)
├── middleware/
│   └── validation.middleware.ts    # Zod validation middleware
└── types/
    └── dto.ts                      # TypeScript type exports
```

## Usage Pattern

### 1. Import DTO and Validation Middleware

```typescript
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  IdParamSchema,
} from "../dto/vehicle.dto";
```

### 2. Apply to Route

```typescript
// POST /vehicles
router.post("/vehicles", validate(CreateVehicleSchema), controller.create);

// PUT /vehicles/:id
router.put(
  "/vehicles/:id",
  validateParams(IdParamSchema),
  validate(UpdateVehicleSchema),
  controller.update,
);
```

### 3. Access Validated Data in Controller

```typescript
// Type-safe access
export const create = asyncHandler(
  async (req: ValidatedRequest<CreateVehicleDTO>, res: Response) => {
    const data = req.validated; // Fully typed!
    const vehicle = await Vehicle.create(data);
    return createSuccessResponse(vehicle);
  },
);
```

## All DTOs Summary

### Auth (`auth.dto.ts`)

- `RegisterDTO` - email, password, name, role, tenantId
- `LoginDTO` - email, password
- `ForgotPasswordDTO` - email
- `ResetPasswordDTO` - token, password
- `ChangePasswordDTO` - currentPassword, newPassword
- `VerifyMFADTO` - code (6 digits)
- `EnableMFADTO` - enabled (boolean)

### Account (`account.dto.ts`)

- `CreateAccountDTO` - email, phone, password, primaryRole, tenantId
- `UpdateAccountDTO` - partial update
- `AssignRoleDTO` - roleId, profileId
- `SwitchRoleDTO` - accountId, roleId
- `UpdateAccountStatusDTO` - status, suspensionReason

### Tenant (`tenant.dto.ts`)

- `CreateTenantDTO` - name, slug, contact info, address, subscription, billing
- `UpdateTenantDTO` - partial update
- `UpdateTenantStatusDTO` - status

### Role (`role.dto.ts`)

- `CreateRoleDTO` - name, slug, type, permissions, inheritsFrom, level
- `UpdateRoleDTO` - partial
- `AddPermissionToRoleDTO` - permissionId
- `AssignRoleToUserDTO` - accountId, profileId

### Permission (`permission.dto.ts`)

- `CreatePermissionDTO` - key, name, resource, action, scope, requiredPlan
- `UpdatePermissionDTO` - partial

### Staff (`staff.dto.ts`)

- `CreateStaffDTO` - accountId, serviceCenterId, roleId, employment, schedule, skills
- `UpdateStaffDTO` - partial
- `UpdateStaffScheduleDTO` - workSchedule
- `AddCustomPermissionDTO` - permissionId, grantedBy, expiresAt, reason
- `DenyPermissionDTO` - permissionId, deniedBy, reason

### Owner (`owner.dto.ts`)

- `CreateOwnerDTO` - accountId, name, contact, address, preferences
- `UpdateOwnerDTO` - partial
- `UpdateOwnerPreferencesDTO` - language, notifications, theme

### Vehicle (`vehicle.dto.ts`)

- `CreateVehicleDTO` - reg, VIN, make, model, year, fuel, transmission, owner, centers
- `UpdateVehicleDTO` - partial
- `AuthorizeCenterDTO` - centerId, accessLevel
- `UpdateCenterAccessDTO` - accessLevel, status
- `UpdateOdometerDTO` - reading, unit, source
- `TransferOwnershipDTO` - newOwnerId, transferReason
- `UpdateWarrantyDTO` - provider, policyNumber, expires, coverage
- `UpdateInsuranceDTO` - provider, policyNumber, expires

### Service Center (`service-center.dto.ts`)

- `CreateServiceCenterDTO` - name, BRN, contact, address, subscription, settings, services
- `UpdateServiceCenterDTO` - partial
- `UpdateServiceSettingsDTO` - settings
- `AddServiceDTO` - name, category, duration, basePrice
- `UpdateServiceDTO` - partial
- `CreateReviewDTO` - rating (1-5), comment

### Service Record (`service-record.dto.ts`)

- `CreateServiceRecordDTO` - vehicleId, serviceCenterId, technicianId, ownerId, type, date, odometer, description, cost, parts, nextService
- `UpdateServiceRecordDTO` - partial
- `AddPartDTO` - partName, quantity, unitCost, warrantyMonths
- `UpdatePartDTO` - partial
- `AddLaborDTO` - description, hours, rate, total
- `UpdateStatusDTO` - status
- `AddFeedbackDTO` - rating, comment
- `SetNextServiceDTO` - date, mileage, serviceType
- `GenerateInvoiceDTO` - dueDate, taxRate

### Invitation (`invitation.dto.ts`)

- `CreateInvitationSchema` - inviter, invitee, type, vehicle/center, role, access
- `UpdateInvitationSchema` - message, maxUses, expiresAt
- `AcceptInvitationSchema` - userId, userType
- `RevokeInvitationSchema` - reason

### Reminder (`reminder.dto.ts`)

- `CreateReminderSchema` - vehicleId, type, title, dueDate, priority, recurrence
- `UpdateReminderSchema` - partial
- `SnoozeReminderSchema` - until
- `BulkReminderActionSchema` - ids[]

### Notification (`notification.dto.ts`)

- `NotificationFiltersSchema` - status, type, channel, limit, skip, unreadOnly
- `MarkAsReadSchema` - notificationIds[]

### Document (`document.dto.ts`)

- `UploadDocumentSchema` - entityType, entityId, documentType, access control
- `UpdateDocumentSchema` - partial
- `VerifyDocumentSchema` - verifiedBy
- `QueryDocumentsSchema` - type, includeDeleted

### Subscription Plan (`subscription-plan.dto.ts`)

- `CreateSubscriptionPlanSchema` - name, slug, type, price, limits, features
- `UpdateSubscriptionPlanSchema` - partial
- `AssignPermissionsToPlanSchema` - permissionIds[]

### Payment (`payment.dto.ts`)

- `CreatePaymentSchema` - accountId, type, amount, provider, billing details
- `UpdatePaymentStatusSchema` - status, paidAt, failedAt, failureReason
- `RefundPaymentSchema` - refundAmount, refundReason

### Odometer (`odometer-reading.dto.ts`)

- `CreateOdometerReadingSchema` - vehicleId, value, unit, source, recordedBy
- `UpdateOdometerReadingSchema` - partial
- `VerifyOdometerSchema` - verifiedBy
- `QueryOdometerHistorySchema` - limit, from, to

### Audit Log (`audit-log.dto.ts`)

- `AuditLogFiltersSchema` - tenantId, actorId, action, entityType, date range

### Report (`report.dto.ts`)

- `ReportDateRangeSchema` - startDate, endDate, serviceCenterId
- `ExportReportSchema` - type, format, date range

### Common (`common.dto.ts`)

- `PaginationSchema` - page, limit, sortBy, sortOrder
- `IdParamSchema` - id (ObjectId validation)
- `MessageSchema` - message string

## Validation Rules Applied

✅ **Email** - format validation, lowercase trimming  
✅ **Password** - min 8 chars, must contain uppercase, lowercase, number  
✅ **ObjectId** - 24 hex character validation  
✅ **Enums** - type-safe enum validation  
✅ **Numbers** - min/max, positive checks  
✅ **Dates** - ISO format validation  
✅ **Strings** - min/max length, trim, lowercase where needed  
✅ **Arrays** - min length, item validation  
✅ **Nested objects** - deep validation  
✅ **Optional fields** - marked with `.optional()`  
✅ **Partial updates** - `.partial()` makes all fields optional  
✅ **Defaults** - sensible defaults where appropriate

## Type Safety Benefits

```typescript
// Before DTOs - any type
req.body; // type: any ❌

// After DTOs - full type inference
req.validated; // type: CreateVehicleDTO ✅
// - Autocomplete in IDE
// - Compile-time type checking
// - No runtime type errors
```

## Error Responses

DTO validation automatically returns:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "path": "email",
      "message": "Invalid email address"
    },
    {
      "path": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

## Migration Path

1. **Start small**: Pick 1-2 routes to convert first
2. **Add DTO validation** to those routes
3. **Update controllers** to use `ValidatedRequest<T>`
4. **Remove old validation** code from controllers
5. **Gradually migrate** remaining routes
6. **Remove duplicate validators**

## Additional Notes

- All DTOs are **generated from model schemas** - they match 1:1
- **Enums are consistent** across models, routes, and DTOs
- **ObjectId validation** ensures proper MongoDB ID format
- **No runtime overhead** - Zod compiles to optimized code
- **Server-side only** - additional client-side validation recommended
