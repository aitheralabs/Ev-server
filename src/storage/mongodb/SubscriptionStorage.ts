import SubscriptionPlan, { SubscriptionStatus, TenantSubscription } from '../../types/Subscription';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SubscriptionStorage';

export default class SubscriptionStorage {

  // ============ SUBSCRIPTION PLANS ============

  public static async getSubscriptionPlan(id: string, projectFields?: string[]): Promise<SubscriptionPlan> {
    const plansMDB = await SubscriptionStorage.getSubscriptionPlans({
      planIDs: [id],
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return plansMDB.count === 1 ? plansMDB.result[0] : null;
  }

  public static async getSubscriptionPlanBySlug(slug: string, projectFields?: string[]): Promise<SubscriptionPlan> {
    const plansMDB = await SubscriptionStorage.getSubscriptionPlans({
      slug,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return plansMDB.count === 1 ? plansMDB.result[0] : null;
  }

  public static async saveSubscriptionPlan(planToSave: Partial<SubscriptionPlan>): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Build document
    const planMDB: any = {
      _id: planToSave.id ? DatabaseUtils.convertToObjectID(planToSave.id) : new ObjectId(),
      name: planToSave.name,
      slug: planToSave.slug,
      description: planToSave.description || '',
      monthlyPrice: planToSave.monthlyPrice,
      annualPrice: planToSave.annualPrice,
      currency: planToSave.currency,
      stripePriceIdMonthly: planToSave.stripePriceIdMonthly || '',
      stripePriceIdAnnual: planToSave.stripePriceIdAnnual || '',
      limits: planToSave.limits,
      platformCommissionPercent: planToSave.platformCommissionPercent,
      trialDays: planToSave.trialDays,
      active: planToSave.active,
      sortOrder: planToSave.sortOrder || 0,
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(planMDB, planToSave);
    // Upsert
    await global.database.getCollection<SubscriptionPlan>(Constants.DEFAULT_TENANT_ID, 'subscriptionplans')
      .findOneAndUpdate(
        { _id: planMDB._id },
        { $set: planMDB },
        { upsert: true, returnDocument: 'after' }
      );
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveSubscriptionPlan', startTime, planMDB);
    return planMDB._id.toString();
  }

  public static async getSubscriptionPlans(
      params: { planIDs?: string[]; slug?: string; search?: string; onlyActive?: boolean },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SubscriptionPlan>> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'slug': { $regex: params.search, $options: 'i' } },
        { 'description': { $regex: params.search, $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.planIDs)) {
      filters._id = {
        $in: params.planIDs.map((planID) => DatabaseUtils.convertToObjectID(planID))
      };
    }
    if (params.slug) {
      filters.slug = params.slug;
    }
    if (params.onlyActive) {
      filters.active = true;
    }
    // Create Aggregation
    const aggregation = [];
    if (filters) {
      aggregation.push({ $match: filters });
    }
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const plansCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'subscriptionplans')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getSubscriptionPlans', startTime, aggregation, plansCountMDB);
      return {
        count: (plansCountMDB.length > 0 ? plansCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { sortOrder: 1, name: 1 };
    }
    aggregation.push({ $sort: dbParams.sort });
    aggregation.push({ $skip: dbParams.skip });
    aggregation.push({ $limit: dbParams.limit });
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT_ID, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const plansMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'subscriptionplans')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as SubscriptionPlan[];
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getSubscriptionPlans', startTime, aggregation, plansMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(plansCountMDB[0]),
      result: plansMDB
    };
  }

  public static async deleteSubscriptionPlan(id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'subscriptionplans')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteSubscriptionPlan', startTime, { id });
  }

  // ============ TENANT SUBSCRIPTIONS ============

  public static async getTenantSubscription(id: string, projectFields?: string[]): Promise<TenantSubscription> {
    const subsMDB = await SubscriptionStorage.getTenantSubscriptions({
      subscriptionIDs: [id],
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return subsMDB.count === 1 ? subsMDB.result[0] : null;
  }

  public static async getTenantSubscriptionByTenantID(tenantID: string, projectFields?: string[]): Promise<TenantSubscription> {
    const subsMDB = await SubscriptionStorage.getTenantSubscriptions({
      tenantID,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return subsMDB.count === 1 ? subsMDB.result[0] : null;
  }

  public static async saveTenantSubscription(subscriptionToSave: Partial<TenantSubscription>): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    const subMDB: any = {
      _id: subscriptionToSave.id ? DatabaseUtils.convertToObjectID(subscriptionToSave.id) : new ObjectId(),
      tenantID: subscriptionToSave.tenantID,
      planID: subscriptionToSave.planID,
      stripeCustomerID: subscriptionToSave.stripeCustomerID || '',
      stripeSubscriptionID: subscriptionToSave.stripeSubscriptionID || '',
      status: subscriptionToSave.status,
      billingCycle: subscriptionToSave.billingCycle,
      trialStartDate: subscriptionToSave.trialStartDate,
      trialEndDate: subscriptionToSave.trialEndDate,
      currentPeriodStart: subscriptionToSave.currentPeriodStart,
      currentPeriodEnd: subscriptionToSave.currentPeriodEnd,
      canceledAt: subscriptionToSave.canceledAt || null,
      usage: subscriptionToSave.usage || {
        chargingStations: 0,
        users: 0,
        sites: 0,
        transactionsThisMonth: 0,
        energyKwhThisMonth: 0,
      },
    };
    DatabaseUtils.addLastChangedCreatedProps(subMDB, subscriptionToSave);
    await global.database.getCollection<TenantSubscription>(Constants.DEFAULT_TENANT_ID, 'subscriptions')
      .findOneAndUpdate(
        { _id: subMDB._id },
        { $set: subMDB },
        { upsert: true, returnDocument: 'after' }
      );
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveTenantSubscription', startTime, subMDB);
    return subMDB._id.toString();
  }

  public static async getTenantSubscriptions(
      params: { subscriptionIDs?: string[]; tenantID?: string; status?: SubscriptionStatus; search?: string },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<TenantSubscription>> {
    const startTime = Logging.traceDatabaseRequestStart();
    dbParams = Utils.cloneObject(dbParams);
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    const filters: FilterParams = {};
    if (!Utils.isEmptyArray(params.subscriptionIDs)) {
      filters._id = {
        $in: params.subscriptionIDs.map((subID) => DatabaseUtils.convertToObjectID(subID))
      };
    }
    if (params.tenantID) {
      filters.tenantID = params.tenantID;
    }
    if (params.status) {
      filters.status = params.status;
    }
    if (params.search) {
      filters.$or = [
        { 'tenantID': { $regex: params.search, $options: 'i' } }
      ];
    }
    const aggregation = [];
    if (filters) {
      aggregation.push({ $match: filters });
    }
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    const subsCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'subscriptions')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getTenantSubscriptions', startTime, aggregation, subsCountMDB);
      return {
        count: (subsCountMDB.length > 0 ? subsCountMDB[0].count : 0),
        result: []
      };
    }
    aggregation.pop();
    if (!dbParams.sort) {
      dbParams.sort = { createdOn: -1 };
    }
    aggregation.push({ $sort: dbParams.sort });
    aggregation.push({ $skip: dbParams.skip });
    aggregation.push({ $limit: dbParams.limit });
    // Lookup plan details
    aggregation.push({
      $lookup: {
        from: `${Constants.DEFAULT_TENANT_ID}.subscriptionplans`,
        let: { planID: '$planID' },
        pipeline: [
          { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$planID'] } } },
          { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, slug: 1, limits: 1, monthlyPrice: 1, annualPrice: 1, currency: 1 } }
        ],
        as: 'plan'
      }
    });
    aggregation.push({
      $addFields: { plan: { $arrayElemAt: ['$plan', 0] } }
    });
    // Lookup tenant details
    aggregation.push({
      $lookup: {
        from: `${Constants.DEFAULT_TENANT_ID}.tenants`,
        let: { tenantID: '$tenantID' },
        pipeline: [
          { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$tenantID'] } } },
          { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, subdomain: 1, email: 1 } }
        ],
        as: 'tenant'
      }
    });
    aggregation.push({
      $addFields: { tenant: { $arrayElemAt: ['$tenant', 0] } }
    });
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT_ID, aggregation);
    DatabaseUtils.projectFields(aggregation, projectFields);
    const subsMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'subscriptions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as TenantSubscription[];
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getTenantSubscriptions', startTime, aggregation, subsMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(subsCountMDB[0]),
      result: subsMDB
    };
  }

  public static async deleteTenantSubscription(id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'subscriptions')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteTenantSubscription', startTime, { id });
  }

  public static async updateSubscriptionUsage(id: string, usage: Partial<TenantSubscription['usage']>): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'subscriptions')
      .findOneAndUpdate(
        { '_id': DatabaseUtils.convertToObjectID(id) },
        { $set: { usage, lastChangedOn: new Date() } }
      );
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'updateSubscriptionUsage', startTime, { id, usage });
  }
}
