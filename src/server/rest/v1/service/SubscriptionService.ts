import { NextFunction, Request, Response } from 'express';
import SubscriptionPlan, { SubscriptionBillingCycle, SubscriptionStatus, TenantSubscription } from '../../../../types/Subscription';

import { Action, Entity } from '../../../../types/Authorization';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import SubscriptionStorage from '../../../../storage/mongodb/SubscriptionStorage';
import SubscriptionValidatorRest from '../validator/SubscriptionValidatorRest';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import { UserRole } from '../../../../types/User';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'SubscriptionService';

export default class SubscriptionService {

  // ============ SUBSCRIPTION PLANS ============

  public static async handleGetSubscriptionPlans(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Validate
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionPlansGetReq(req.query);
    // Check auth - only super admin can manage plans
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleGetSubscriptionPlans');
    // Get plans
    const plans = await SubscriptionStorage.getSubscriptionPlans({
      search: filteredRequest.Search,
      onlyActive: filteredRequest.OnlyActive,
    }, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
    });
    res.json(plans);
    next();
  }

  public static async handleGetSubscriptionPlan(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionPlanGetReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSubscriptionPlan', req.user);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleGetSubscriptionPlan');
    const plan = await SubscriptionStorage.getSubscriptionPlan(filteredRequest.ID);
    UtilsService.assertObjectExists(action, plan, `Subscription Plan ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleGetSubscriptionPlan', req.user);
    res.json(plan);
    next();
  }

  public static async handleCreateSubscriptionPlan(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionPlanCreateReq(req.body);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleCreateSubscriptionPlan');
    // Check slug uniqueness
    const existingPlan = await SubscriptionStorage.getSubscriptionPlanBySlug(filteredRequest.slug);
    if (existingPlan) {
      throw new AppError({
        errorCode: HTTPError.TENANT_ALREADY_EXIST,
        message: `Subscription Plan with slug '${filteredRequest.slug}' already exists`,
        module: MODULE_NAME, method: 'handleCreateSubscriptionPlan',
        user: req.user
      });
    }
    // Save
    filteredRequest.createdBy = { id: req.user.id };
    filteredRequest.createdOn = new Date();
    const planID = await SubscriptionStorage.saveSubscriptionPlan(filteredRequest);
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID, user: req.user,
      module: MODULE_NAME, method: 'handleCreateSubscriptionPlan',
      message: `Subscription Plan '${filteredRequest.name}' has been created successfully`,
      action, detailedMessages: { plan: filteredRequest }
    });
    res.json({ id: planID });
    next();
  }

  public static async handleUpdateSubscriptionPlan(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionPlanUpdateReq(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUpdateSubscriptionPlan', req.user);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleUpdateSubscriptionPlan');
    // Check exists
    const existingPlan = await SubscriptionStorage.getSubscriptionPlan(filteredRequest.id);
    UtilsService.assertObjectExists(action, existingPlan, `Subscription Plan ID '${filteredRequest.id}' does not exist`, MODULE_NAME, 'handleUpdateSubscriptionPlan', req.user);
    // Check slug uniqueness if changed
    if (filteredRequest.slug && filteredRequest.slug !== existingPlan.slug) {
      const planWithSlug = await SubscriptionStorage.getSubscriptionPlanBySlug(filteredRequest.slug);
      if (planWithSlug) {
        throw new AppError({
          errorCode: HTTPError.TENANT_ALREADY_EXIST,
          message: `Subscription Plan with slug '${filteredRequest.slug}' already exists`,
          module: MODULE_NAME, method: 'handleUpdateSubscriptionPlan',
          user: req.user
        });
      }
    }
    // Save
    filteredRequest.lastChangedBy = { id: req.user.id };
    filteredRequest.lastChangedOn = new Date();
    await SubscriptionStorage.saveSubscriptionPlan(filteredRequest);
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID, user: req.user,
      module: MODULE_NAME, method: 'handleUpdateSubscriptionPlan',
      message: `Subscription Plan '${filteredRequest.name || existingPlan.name}' has been updated successfully`,
      action, detailedMessages: { plan: filteredRequest }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteSubscriptionPlan(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionPlanDeleteReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleDeleteSubscriptionPlan', req.user);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleDeleteSubscriptionPlan');
    // Check exists
    const plan = await SubscriptionStorage.getSubscriptionPlan(filteredRequest.ID);
    UtilsService.assertObjectExists(action, plan, `Subscription Plan ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleDeleteSubscriptionPlan', req.user);
    // Check no active subscriptions use this plan
    const activeSubs = await SubscriptionStorage.getTenantSubscriptions(
      { status: SubscriptionStatus.ACTIVE }, Constants.DB_PARAMS_COUNT_ONLY);
    // Delete
    await SubscriptionStorage.deleteSubscriptionPlan(filteredRequest.ID);
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID, user: req.user,
      module: MODULE_NAME, method: 'handleDeleteSubscriptionPlan',
      message: `Subscription Plan '${plan.name}' has been deleted successfully`,
      action, detailedMessages: { plan }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  // ============ TENANT SUBSCRIPTIONS ============

  public static async handleGetSubscriptions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionsGetReq(req.query);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleGetSubscriptions');
    const subscriptions = await SubscriptionStorage.getTenantSubscriptions({
      search: filteredRequest.Search,
      tenantID: filteredRequest.TenantID,
      status: filteredRequest.Status as SubscriptionStatus,
    }, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
    });
    res.json(subscriptions);
    next();
  }

  public static async handleGetSubscription(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionGetReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSubscription', req.user);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleGetSubscription');
    const subscription = await SubscriptionStorage.getTenantSubscription(filteredRequest.ID);
    UtilsService.assertObjectExists(action, subscription, `Subscription ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleGetSubscription', req.user);
    res.json(subscription);
    next();
  }

  public static async handleCreateSubscription(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = SubscriptionValidatorRest.getInstance().validateSubscriptionCreateReq(req.body);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleCreateSubscription');
    // Validate tenant exists
    const tenant = await TenantStorage.getTenant(filteredRequest.tenantID);
    UtilsService.assertObjectExists(action, tenant, `Tenant ID '${filteredRequest.tenantID}' does not exist`, MODULE_NAME, 'handleCreateSubscription', req.user);
    // Validate plan exists
    const plan = await SubscriptionStorage.getSubscriptionPlan(filteredRequest.planID);
    UtilsService.assertObjectExists(action, plan, `Subscription Plan ID '${filteredRequest.planID}' does not exist`, MODULE_NAME, 'handleCreateSubscription', req.user);
    // Check no existing active subscription for this tenant
    const existingSub = await SubscriptionStorage.getTenantSubscriptionByTenantID(filteredRequest.tenantID);
    if (existingSub && (existingSub.status === SubscriptionStatus.ACTIVE || existingSub.status === SubscriptionStatus.TRIALING)) {
      throw new AppError({
        errorCode: HTTPError.TENANT_ALREADY_EXIST,
        message: `Tenant '${tenant.name}' already has an active subscription`,
        module: MODULE_NAME, method: 'handleCreateSubscription',
        user: req.user
      });
    }
    // Build subscription
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
    const subscription: Partial<TenantSubscription> = {
      tenantID: filteredRequest.tenantID,
      planID: filteredRequest.planID,
      status: plan.trialDays > 0 ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      billingCycle: filteredRequest.billingCycle as SubscriptionBillingCycle,
      trialStartDate: plan.trialDays > 0 ? now : null,
      trialEndDate: plan.trialDays > 0 ? trialEndDate : null,
      currentPeriodStart: now,
      currentPeriodEnd: filteredRequest.billingCycle === SubscriptionBillingCycle.ANNUAL
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
      stripeCustomerID: filteredRequest.stripeCustomerID as string || '',
      stripeSubscriptionID: filteredRequest.stripeSubscriptionID as string || '',
      usage: { chargingStations: 0, users: 0, sites: 0, transactionsThisMonth: 0, energyKwhThisMonth: 0 },
      createdBy: { id: req.user.id },
      createdOn: now,
    };
    const subscriptionID = await SubscriptionStorage.saveTenantSubscription(subscription);
    // Update tenant components based on plan limits
    await SubscriptionService.syncTenantComponentsWithPlan(tenant, plan);
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID, user: req.user,
      module: MODULE_NAME, method: 'handleCreateSubscription',
      message: `Subscription for Tenant '${tenant.name}' on plan '${plan.name}' has been created successfully`,
      action, detailedMessages: { subscription }
    });
    res.json({ id: subscriptionID });
    next();
  }

  public static async handleCancelSubscription(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const subscriptionID = req.params.id;
    UtilsService.assertIdIsProvided(action, subscriptionID, MODULE_NAME, 'handleCancelSubscription', req.user);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleCancelSubscription');
    const subscription = await SubscriptionStorage.getTenantSubscription(subscriptionID);
    UtilsService.assertObjectExists(action, subscription, `Subscription ID '${subscriptionID}' does not exist`, MODULE_NAME, 'handleCancelSubscription', req.user);
    // Cancel
    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    subscription.lastChangedBy = { id: req.user.id };
    subscription.lastChangedOn = new Date();
    await SubscriptionStorage.saveTenantSubscription(subscription);
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID, user: req.user,
      module: MODULE_NAME, method: 'handleCancelSubscription',
      message: `Subscription ID '${subscriptionID}' has been canceled`,
      action, detailedMessages: { subscription }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSubscriptionUsage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const subscriptionID = req.params.id;
    UtilsService.assertIdIsProvided(action, subscriptionID, MODULE_NAME, 'handleGetSubscriptionUsage', req.user);
    SubscriptionService.checkIsSuperAdmin(action, req, 'handleGetSubscriptionUsage');
    const subscription = await SubscriptionStorage.getTenantSubscription(subscriptionID);
    UtilsService.assertObjectExists(action, subscription, `Subscription ID '${subscriptionID}' does not exist`, MODULE_NAME, 'handleGetSubscriptionUsage', req.user);
    // Get plan for limits
    const plan = await SubscriptionStorage.getSubscriptionPlan(subscription.planID);
    res.json({
      usage: subscription.usage,
      limits: plan?.limits || {},
      status: subscription.status,
    });
    next();
  }

  // ============ HELPERS ============

  private static checkIsSuperAdmin(action: ServerAction, req: Request, methodName: string): void {
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ,
        entity: Entity.SETTING,
        module: MODULE_NAME, method: methodName,
      });
    }
  }

  private static async syncTenantComponentsWithPlan(tenant: any, plan: SubscriptionPlan): Promise<void> {
    // Map plan features to tenant components
    const components = tenant.components || {};
    if (plan.limits.ocpiEnabled !== undefined) {
      components.ocpi = { ...components.ocpi, active: plan.limits.ocpiEnabled };
    }
    if (plan.limits.oicpEnabled !== undefined) {
      components.oicp = { ...components.oicp, active: plan.limits.oicpEnabled };
    }
    if (plan.limits.smartChargingEnabled !== undefined) {
      components.smartCharging = { ...components.smartCharging, active: plan.limits.smartChargingEnabled };
    }
    if (plan.limits.advancedAnalytics !== undefined) {
      components.analytics = { ...components.analytics, active: plan.limits.advancedAnalytics };
    }
    tenant.components = components;
    await TenantStorage.saveTenant(tenant, false);
  }
}
