import SubscriptionPlan, { TenantSubscription } from '../../../../types/Subscription';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SubscriptionValidatorRest extends SchemaValidator {
  private static instance: SubscriptionValidatorRest | null = null;

  private subscriptionPlanCreate: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscription-plan-create.json`, 'utf8')
  );
  private subscriptionPlanUpdate: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscription-plan-update.json`, 'utf8')
  );
  private subscriptionPlanGet: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscription-plan-get.json`, 'utf8')
  );
  private subscriptionPlanDelete: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscription-plan-delete.json`, 'utf8')
  );
  private subscriptionPlansGet: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscription-plans-get.json`, 'utf8')
  );
  private subscriptionCreate: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscription-create.json`, 'utf8')
  );
  private subscriptionGet: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscription-get.json`, 'utf8')
  );
  private subscriptionsGet: Schema = JSON.parse(
    fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/subscription/subscriptions-get.json`, 'utf8')
  );

  private constructor() {
    super('SubscriptionValidatorRest');
  }

  public static getInstance(): SubscriptionValidatorRest {
    if (!SubscriptionValidatorRest.instance) {
      SubscriptionValidatorRest.instance = new SubscriptionValidatorRest();
    }
    return SubscriptionValidatorRest.instance;
  }

  public validateSubscriptionPlanCreateReq(data: Record<string, unknown>): SubscriptionPlan {
    return this.validate(this.subscriptionPlanCreate, data);
  }

  public validateSubscriptionPlanUpdateReq(data: Record<string, unknown>): SubscriptionPlan {
    return this.validate(this.subscriptionPlanUpdate, data);
  }

  public validateSubscriptionPlanGetReq(data: Record<string, unknown>): { ID: string; ProjectFields?: string } {
    return this.validate(this.subscriptionPlanGet, data);
  }

  public validateSubscriptionPlanDeleteReq(data: Record<string, unknown>): { ID: string } {
    return this.validate(this.subscriptionPlanDelete, data);
  }

  public validateSubscriptionPlansGetReq(data: Record<string, unknown>): {
    Search?: string; OnlyActive?: boolean; Limit: number; Skip?: number; SortFields?: string; ProjectFields?: string;
  } {
    return this.validate(this.subscriptionPlansGet, data);
  }

  public validateSubscriptionCreateReq(data: Record<string, unknown>): Partial<TenantSubscription> {
    return this.validate(this.subscriptionCreate, data);
  }

  public validateSubscriptionGetReq(data: Record<string, unknown>): { ID: string; ProjectFields?: string } {
    return this.validate(this.subscriptionGet, data);
  }

  public validateSubscriptionsGetReq(data: Record<string, unknown>): {
    Search?: string; TenantID?: string; Status?: string; Limit: number; Skip?: number; SortFields?: string; ProjectFields?: string;
  } {
    return this.validate(this.subscriptionsGet, data);
  }
}
