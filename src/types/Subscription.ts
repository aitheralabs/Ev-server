import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface SubscriptionPlan extends CreatedUpdatedProps {
  id: string;
  name: string;
  slug: string;
  description?: string;
  // Pricing
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  stripePriceIdMonthly?: string;
  stripePriceIdAnnual?: string;
  // Limits
  limits: SubscriptionPlanLimits;
  // Revenue share
  platformCommissionPercent: number;
  // Trial
  trialDays: number;
  // Status
  active: boolean;
  sortOrder?: number;
}

export interface SubscriptionPlanLimits {
  maxChargingStations: number;
  maxUsers: number;
  maxSites: number;
  maxTransactionsPerMonth: number;
  maxEnergyKwhPerMonth: number;
  // Feature access
  ocpiEnabled: boolean;
  oicpEnabled: boolean;
  smartChargingEnabled: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  customBranding: boolean;
  prioritySupport: boolean;
}

export interface TenantSubscription extends CreatedUpdatedProps {
  id: string;
  tenantID: string;
  planID: string;
  // Stripe
  stripeCustomerID?: string;
  stripeSubscriptionID?: string;
  // Status
  status: SubscriptionStatus;
  billingCycle: SubscriptionBillingCycle;
  // Dates
  trialStartDate?: Date;
  trialEndDate?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  canceledAt?: Date;
  // Usage snapshot (current billing period)
  usage: SubscriptionUsage;
}

export interface SubscriptionUsage {
  chargingStations: number;
  users: number;
  sites: number;
  transactionsThisMonth: number;
  energyKwhThisMonth: number;
}

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  SUSPENDED = 'suspended',
}

export enum SubscriptionBillingCycle {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}
