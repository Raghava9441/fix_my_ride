

import mongoose, { Schema } from "mongoose";


const permissionSchema = new Schema({
    // Unique permission key: resource:action
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Human readable
    name: { type: String, required: true },
    description: String,

    // Categorization
    resource: {
        type: String,
        required: true,
        enum: [
            'vehicle',           // Vehicle management
            'service_record',    // Service history
            'owner_profile',     // Own profile
            'staff_profile',     // Staff management
            'service_center',    // Center settings
            'reminder',          // Notifications
            'invitation',        // Access sharing
            'report',            // Analytics
            'billing',           // Payments/invoices
            'audit_log',         // Activity logs
            'role',              // RBAC management
            'account',           // User management
            'system'             // SaaS admin
        ]
    },

    action: {
        type: String,
        required: true,
        enum: [
            'create',      // Create new
            'read',        // View own
            'read_all',    // View all in scope
            'update',      // Edit own
            'update_all',  // Edit all in scope
            'delete',      // Soft delete
            'hard_delete', // Permanent delete
            'manage',      // Full control
            'execute',     // Special actions
            'assign'       // Delegate permissions
        ]
    },

    // Scope: where does this apply?
    scope: {
        type: String,
        enum: ['own', 'center', 'tenant', 'global'],
        default: 'own'
    },

    // Metadata
    isActive: { type: Boolean, default: true },
    category: String, // UI grouping

    // For SaaS: which plans include this
    requiredPlan: {
        type: String,
        enum: ['free', 'basic', 'professional', 'enterprise'],
        default: 'free'
    }

}, { timestamps: true });

// Static: Seed default permissions
permissionSchema.statics.seedDefaults = async function () {
    const defaults = [
        // Vehicle permissions
        { key: 'vehicle:create', name: 'Create Vehicle', resource: 'vehicle', action: 'create', scope: 'own' },
        { key: 'vehicle:read', name: 'View Own Vehicle', resource: 'vehicle', action: 'read', scope: 'own' },
        { key: 'vehicle:read_all', name: 'View All Vehicles', resource: 'vehicle', action: 'read_all', scope: 'center' },
        { key: 'vehicle:update', name: 'Update Vehicle', resource: 'vehicle', action: 'update', scope: 'own' },
        { key: 'vehicle:delete', name: 'Delete Vehicle', resource: 'vehicle', action: 'delete', scope: 'own' },

        // Service record permissions
        { key: 'service_record:create', name: 'Create Service Record', resource: 'service_record', action: 'create', scope: 'center' },
        { key: 'service_record:read', name: 'View Service History', resource: 'service_record', action: 'read', scope: 'own' },
        { key: 'service_record:read_all', name: 'View All Service Records', resource: 'service_record', action: 'read_all', scope: 'center' },
        { key: 'service_record:update', name: 'Update Service Record', resource: 'service_record', action: 'update', scope: 'center' },
        { key: 'service_record:delete', name: 'Delete Service Record', resource: 'service_record', action: 'delete', scope: 'center' },

        // Staff management
        { key: 'staff_profile:create', name: 'Add Staff', resource: 'staff_profile', action: 'create', scope: 'center' },
        { key: 'staff_profile:read', name: 'View Staff', resource: 'staff_profile', action: 'read', scope: 'center' },
        { key: 'staff_profile:update', name: 'Update Staff', resource: 'staff_profile', action: 'update', scope: 'center' },
        { key: 'staff_profile:delete', name: 'Remove Staff', resource: 'staff_profile', action: 'delete', scope: 'center' },
        { key: 'staff_profile:manage', name: 'Manage All Staff', resource: 'staff_profile', action: 'manage', scope: 'center' },

        // Service center
        { key: 'service_center:read', name: 'View Center', resource: 'service_center', action: 'read', scope: 'center' },
        { key: 'service_center:update', name: 'Update Center', resource: 'service_center', action: 'update', scope: 'center' },
        { key: 'service_center:manage', name: 'Manage Center', resource: 'service_center', action: 'manage', scope: 'center' },

        // Reminders
        { key: 'reminder:create', name: 'Create Reminder', resource: 'reminder', action: 'create', scope: 'own' },
        { key: 'reminder:read', name: 'View Reminders', resource: 'reminder', action: 'read', scope: 'own' },
        { key: 'reminder:manage', name: 'Manage All Reminders', resource: 'reminder', action: 'manage', scope: 'center' },

        // Reports
        { key: 'report:read', name: 'View Reports', resource: 'report', action: 'read', scope: 'center' },
        { key: 'report:read_all', name: 'View All Reports', resource: 'report', action: 'read_all', scope: 'tenant' },

        // Billing
        { key: 'billing:read', name: 'View Billing', resource: 'billing', action: 'read', scope: 'center' },
        { key: 'billing:manage', name: 'Manage Billing', resource: 'billing', action: 'manage', scope: 'center' },

        // RBAC (admin only)
        { key: 'role:manage', name: 'Manage Roles', resource: 'role', action: 'manage', scope: 'tenant' },
        { key: 'permission:assign', name: 'Assign Permissions', resource: 'permission', action: 'assign', scope: 'tenant' },

        // System (SaaS admin)
        { key: 'system:admin', name: 'System Admin', resource: 'system', action: 'manage', scope: 'global' }
    ];

    for (const perm of defaults) {
        await this.findOneAndUpdate(
            { key: perm.key },
            perm,
            { upsert: true, new: true }
        );
    }
};

export const Permission = mongoose.model('Permission', permissionSchema);