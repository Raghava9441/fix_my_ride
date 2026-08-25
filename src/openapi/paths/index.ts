// Side-effect-only barrel: importing this file registers every domain's
// OpenAPI paths onto the shared registry. Order doesn't matter — each file
// is independent and only touches its own paths/schemas.
import "./auth.openapi";
import "./health.openapi";
import "./account.openapi";
import "./admin.openapi";
import "./vehicle.openapi";
import "./serviceRecord.openapi";
import "./serviceCenter.openapi";
import "./staff.openapi";
import "./owner.openapi";
import "./invitation.openapi";
import "./permission.openapi";
import "./role.openapi";
import "./reminder.openapi";
import "./notification.openapi";
import "./document.openapi";
import "./audit.openapi";
import "./report.openapi";
import "./public.openapi";
import "./tenant.openapi";
import "./subscriptionPlan.openapi";
import "./subscription.openapi";
import "./payment.openapi";
import "./invoice.openapi";
