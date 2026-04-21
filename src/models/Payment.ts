// models/Payment.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  accountId: mongoose.Types.ObjectId;
  serviceCenterId?: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  
  // Payment Details
  type: 'subscription' | 'invoice' | 'one_time' | 'refund';
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed' | 'cancelled';
  
  // Amount
  amount: number;
  currency: string;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  
  // Provider
  provider: 'stripe' | 'paypal' | 'razorpay' | 'bank_transfer' | 'cash';
  providerPaymentId?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  
  // Related Records
  invoiceId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  serviceRecordIds?: mongoose.Types.ObjectId[];
  
  // Metadata
  description?: string;
  metadata: Record<string, any>;
  
  // Billing Details
  billingEmail: string;
  billingName?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  
  // Refund Info
  refundAmount?: number;
  refundReason?: string;
  refundAt?: Date;
  
  // Timestamps
  paidAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  
  isDeleted: boolean;
}

const paymentSchema = new Schema<IPayment>({
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  serviceCenterId: {
    type: Schema.Types.ObjectId,
    ref: 'ServiceCenter',
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  
  type: {
    type: String,
    enum: ['subscription', 'invoice', 'one_time', 'refund'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'disputed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  provider: {
    type: String,
    enum: ['stripe', 'paypal', 'razorpay', 'bank_transfer', 'cash'],
    required: true
  },
  providerPaymentId: String,
  providerCustomerId: String,
  providerSubscriptionId: String,
  
  invoiceId: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  serviceRecordIds: [{
    type: Schema.Types.ObjectId,
    ref: 'ServiceRecord'
  }],
  
  description: String,
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  
  billingEmail: {
    type: String,
    required: true
  },
  billingName: String,
  billingAddress: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  
  refundAmount: Number,
  refundReason: String,
  refundAt: Date,
  
  paidAt: Date,
  failedAt: Date,
  failureReason: String,
  
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ accountId: 1, createdAt: -1 });
paymentSchema.index({ serviceCenterId: 1, status: 1 });
paymentSchema.index({ providerPaymentId: 1 }, { sparse: true });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);