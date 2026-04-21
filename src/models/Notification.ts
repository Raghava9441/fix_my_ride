// server/models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    // Recipient Information
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'recipientModel',
        index: true
    },
    recipientModel: {
        type: String,
        required: true,
        enum: ['Owner', 'User', 'ServiceCenter'],
        index: true
    },

    // Notification Details
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },

    // Channel
    channel: {
        type: String,
        enum: ['email', 'sms', 'push', 'in_app'],
        required: true,
        index: true
    },

    // Notification Type
    type: {
        type: String,
        enum: [
            'service_reminder',
            'appointment_reminder',
            'appointment_confirmation',
            'appointment_cancelled',
            'invoice_generated',
            'payment_received',
            'payment_overdue',
            'vehicle_authorized',
            'vehicle_revoked',
            'invitation_received',
            'invitation_accepted',
            'service_completed',
            'review_request',
            'welcome',
            'password_reset',
            'email_verification',
            'phone_verification',
            'account_suspended',
            'account_activated',
            'subscription_expiring',
            'subscription_expired',
            'subscription_renewed',
            'subscription_upgraded',
            'subscription_downgraded',
            'promotion',
            'system_alert',
            'maintenance_update',
            'security_alert'
        ],
        required: true,
        index: true
    },

    // Related Entities (for context linking)
    data: {
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle'
        },
        serviceRecordId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServiceRecord'
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment'
        },
        invoiceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Invoice'
        },
        invitationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Invitation'
        },
        serviceCenterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServiceCenter'
        },
        reminderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Reminder'
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Owner'
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        amount: {
            type: Number,
            min: 0
        },
        currency: {
            type: String,
            default: 'USD',
            uppercase: true,
            enum: ['USD', 'EUR', 'GBP', 'INR', 'AED']
        },
        dueDate: Date,
        scheduledDate: Date,
        customData: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },

    // Status Tracking
    status: {
        type: String,
        enum: ['pending', 'queued', 'sent', 'delivered', 'failed', 'read', 'clicked', 'cancelled'],
        default: 'pending',
        index: true
    },

    // Delivery Tracking
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    clickedAt: Date,

    // Retry Logic
    retryCount: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    lastRetryAt: Date,
    nextRetryAt: Date,
    failureReason: String,

    // Priority
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
        index: true
    },

    // Expiry
    expiresAt: {
        type: Date,
        index: true,
        default: function () {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // 30 days default expiry
            return expiryDate;
        }
    },

    // Template Information
    templateId: String,
    templateVersion: Number,

    // Tracking
    messageId: String, // External provider message ID
    provider: {
        type: String,
        enum: ['sendgrid', 'twilio', 'firebase', 'internal']
    },

    // Metadata
    metadata: {
        ipAddress: String,
        userAgent: String,
        deviceType: {
            type: String,
            enum: ['web', 'mobile', 'tablet', 'desktop', 'unknown']
        },
        location: String,
        referrer: String
    },

    // Batch Information
    batchId: {
        type: String,
        index: true
    },
    isBulk: {
        type: Boolean,
        default: false
    },

    // Read Receipt
    readReceiptRequested: {
        type: Boolean,
        default: false
    },

    // Soft Delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: Date,
    deletedReason: String
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
notificationSchema.index({ recipientId: 1, recipientModel: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ status: 1, nextRetryAt: 1 });
notificationSchema.index({ batchId: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days for old notifications

// Compound indexes for common queries
notificationSchema.index({ recipientId: 1, status: 1, channel: 1 });
notificationSchema.index({ type: 1, status: 1, priority: 1 });
notificationSchema.index({ 'data.vehicleId': 1, type: 1 });
notificationSchema.index({ 'data.serviceCenterId': 1, createdAt: -1 });

// Virtual for age
notificationSchema.virtual('age').get(function () {
    const now = new Date();
    const diffMs = now - this.createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes`;
    if (diffHours < 24) return `${diffHours} hours`;
    return `${diffDays} days`;
});

// Virtual for isExpired
notificationSchema.virtual('isExpired').get(function () {
    return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for isRead
notificationSchema.virtual('isRead').get(function () {
    return this.status === 'read';
});

// Pre-save middleware
notificationSchema.pre('save', function (next) {
    // Auto-set expiry for certain types
    if (!this.expiresAt) {
        let expiryDays = 30; // default

        switch (this.type) {
            case 'service_reminder':
            case 'appointment_reminder':
                expiryDays = 7;
                break;
            case 'email_verification':
            case 'phone_verification':
            case 'password_reset':
                expiryDays = 1;
                break;
            case 'invitation_received':
                expiryDays = 7;
                break;
            case 'promotion':
                expiryDays = 14;
                break;
            case 'system_alert':
            case 'security_alert':
                expiryDays = 90;
                break;
            default:
                expiryDays = 30;
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        this.expiresAt = expiryDate;
    }

    next();
});

// Methods
notificationSchema.methods.markAsSent = async function (providerMessageId) {
    this.status = 'sent';
    this.sentAt = new Date();
    if (providerMessageId) this.messageId = providerMessageId;
    return this.save();
};

notificationSchema.methods.markAsDelivered = async function () {
    this.status = 'delivered';
    this.deliveredAt = new Date();
    return this.save();
};

notificationSchema.methods.markAsRead = async function () {
    if (this.status !== 'read') {
        this.status = 'read';
        this.readAt = new Date();
        return this.save();
    }
    return this;
};

notificationSchema.methods.markAsClicked = async function () {
    this.clickedAt = new Date();
    return this.save();
};

notificationSchema.methods.markAsFailed = async function (reason) {
    this.status = 'failed';
    this.failureReason = reason;

    if (this.retryCount < 5) {
        this.retryCount += 1;
        this.lastRetryAt = new Date();

        // Exponential backoff: 5min, 15min, 45min, 2h, 6h
        const delays = [5, 15, 45, 120, 360];
        const delayMinutes = delays[this.retryCount - 1];
        this.nextRetryAt = new Date(Date.now() + delayMinutes * 60000);
        this.status = 'pending';
    }

    return this.save();
};

notificationSchema.methods.cancel = async function (reason) {
    this.status = 'cancelled';
    this.failureReason = reason;
    return this.save();
};

notificationSchema.methods.getRecipientModel = async function () {
    return mongoose.model(this.recipientModel).findById(this.recipientId);
};

// Static methods
notificationSchema.statics.findByRecipient = function (recipientId, recipientModel, options = {}) {
    const query = this.find({
        recipientId,
        recipientModel,
        isDeleted: false
    }).sort({ createdAt: -1 });

    if (options.limit) query.limit(options.limit);
    if (options.skip) query.skip(options.skip);
    if (options.status) query.where('status').in(options.status);
    if (options.type) query.where('type').in(options.type);
    if (options.channel) query.where('channel').equals(options.channel);
    if (options.unreadOnly) query.where('status').ne('read');

    return query;
};

notificationSchema.statics.findUnreadByRecipient = function (recipientId, recipientModel) {
    return this.find({
        recipientId,
        recipientModel,
        status: { $ne: 'read' },
        isDeleted: false,
        expiresAt: { $gt: new Date() }
    }).sort({ priority: -1, createdAt: -1 });
};

notificationSchema.statics.markAllAsRead = async function (recipientId, recipientModel) {
    return this.updateMany(
        {
            recipientId,
            recipientModel,
            status: { $ne: 'read' },
            isDeleted: false
        },
        {
            status: 'read',
            readAt: new Date()
        }
    );
};

notificationSchema.statics.deleteOldNotifications = async function (daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return this.updateMany(
        {
            createdAt: { $lt: cutoffDate },
            isDeleted: false
        },
        {
            isDeleted: true,
            deletedAt: new Date(),
            deletedReason: 'Auto-archived by retention policy'
        }
    );
};

notificationSchema.statics.getNotificationStats = async function (recipientId, recipientModel) {
    return this.aggregate([
        {
            $match: {
                recipientId: mongoose.Types.ObjectId(recipientId),
                recipientModel,
                isDeleted: false
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
};

notificationSchema.statics.createFromTemplate = async function (template, recipient, data) {
    // Replace template variables
    let content = template.content;
    let title = template.title;

    Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, data[key]);
        title = title.replace(regex, data[key]);
    });

    return this.create({
        recipientId: recipient.id,
        recipientModel: recipient.model,
        title,
        content,
        channel: template.channel,
        type: template.type,
        data: data,
        templateId: template.id,
        templateVersion: template.version,
        priority: template.priority || 'medium'
    });
};

// Pre-query middleware to exclude soft-deleted and expired
notificationSchema.pre(/^find/, function () {
    if (!this._conditions.hasOwnProperty('isDeleted')) {
        this.where({ isDeleted: false });
    }
    this.where({ expiresAt: { $gt: new Date() } });
});

// TTL index for auto-deletion after expiry (MongoDB will delete these)
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;