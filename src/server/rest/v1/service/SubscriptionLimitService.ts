import AppError from '../../../../exception/AppError';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { SubscriptionStatus } from '../../../../types/Subscription';
import SubscriptionStorage from '../../../../storage/mongodb/SubscriptionStorage';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';

const MODULE_NAME = 'SubscriptionLimitService';

export default class SubscriptionLimitService {

  /**
   * Check if the tenant's subscription allows creating more of the given resource.
   * Returns silently if allowed, throws AppError if limit exceeded.
   * If no subscription exists for the tenant, allows the action (backwards compatibility).
   *
   * @param {string} tenantID Tenant ID
   * @param {string} resource Resource type
   * @param {string} methodName Method name
   */
  public static async checkSubscriptionLimit(
      tenantID: string,
      resource: 'chargingStations' | 'users' | 'sites',
      methodName: string
  ): Promise<void> {
    // Get tenant subscription
    const subscription = await SubscriptionStorage.getTenantSubscriptionByTenantID(tenantID);
    // No subscription = no limits (backwards compatible)
    if (!subscription) {
      return;
    }
    // Check subscription is active
    if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIALING) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Tenant subscription is '${subscription.status}'. Cannot create new resources.`,
        module: MODULE_NAME, method: methodName,
      });
    }
    // Get plan limits
    const plan = await SubscriptionStorage.getSubscriptionPlan(subscription.planID);
    if (!plan) {
      return;
    }
    // Get limit for resource
    let maxLimit: number;
    let currentCount: number;
    let resourceLabel: string;
    switch (resource) {
      case 'chargingStations':
        maxLimit = plan.limits.maxChargingStations;
        currentCount = subscription.usage?.chargingStations || 0;
        resourceLabel = 'charging stations';
        break;
      case 'users':
        maxLimit = plan.limits.maxUsers;
        currentCount = subscription.usage?.users || 0;
        resourceLabel = 'users';
        break;
      case 'sites':
        maxLimit = plan.limits.maxSites;
        currentCount = subscription.usage?.sites || 0;
        resourceLabel = 'sites';
        break;
    }
    // -1 means unlimited
    if (maxLimit === -1) {
      return;
    }
    // Check limit
    if (currentCount >= maxLimit) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Subscription limit reached: maximum ${maxLimit} ${resourceLabel} allowed on the '${plan.name}' plan. Please upgrade your subscription.`,
        module: MODULE_NAME, method: methodName,
      });
    }
  }

  /**
   * Recalculate and update usage counters for a tenant's subscription.
   * Call this after creating or deleting resources.
   *
   * @param {string} tenantID Tenant ID
   */
  public static async refreshUsageCounters(tenantID: string): Promise<void> {
    const subscription = await SubscriptionStorage.getTenantSubscriptionByTenantID(tenantID);
    if (!subscription) {
      return;
    }
    try {
      // Count actual resources in the tenant's database
      const tenant = await TenantStorage.getTenant(tenantID);
      if (!tenant) {
        return;
      }
      const usage = { ...subscription.usage };

      const chargingStationsCount = await ChargingStationStorage.getChargingStations(tenant, {}, Constants.DB_PARAMS_COUNT_ONLY);
      usage.chargingStations = chargingStationsCount.count;

      const usersCount = await UserStorage.getUsers(tenant, {}, Constants.DB_PARAMS_COUNT_ONLY);
      usage.users = usersCount.count;

      const sitesCount = await SiteStorage.getSites(tenant, {}, Constants.DB_PARAMS_COUNT_ONLY);
      usage.sites = sitesCount.count;

      // Update the subscription with fresh counts
      await SubscriptionStorage.updateSubscriptionUsage(subscription.id, usage);
    } catch (error) {
      await Logging.logError({
        tenantID, module: MODULE_NAME, method: 'refreshUsageCounters',
        message: `Failed to refresh usage counters: ${(error as Error).message}`,
        action: ServerAction.SUBSCRIPTION_UPDATE,
        detailedMessages: { error: (error as Error).stack }
      });
    }
  }
}
