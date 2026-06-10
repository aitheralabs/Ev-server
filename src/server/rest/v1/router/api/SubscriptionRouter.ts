import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../../../utils/RouterUtils';
import SubscriptionService from '../../service/SubscriptionService';
import sanitize from 'mongo-sanitize';

export default class SubscriptionRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSubscriptionPlans();
    this.buildRouteSubscriptionPlan();
    this.buildRouteCreateSubscriptionPlan();
    this.buildRouteUpdateSubscriptionPlan();
    this.buildRouteDeleteSubscriptionPlan();
    this.buildRouteSubscriptions();
    this.buildRouteSubscription();
    this.buildRouteCreateSubscription();
    this.buildRouteCancelSubscription();
    this.buildRouteSubscriptionUsage();
    return this.router;
  }

  // ============ PLANS ============

  private buildRouteSubscriptionPlans(): void {
    this.router.get(`/${RESTServerRoute.REST_SUBSCRIPTION_PLANS}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleGetSubscriptionPlans.bind(this),
          ServerAction.SUBSCRIPTION_PLANS, req, res, next);
      });
  }

  private buildRouteSubscriptionPlan(): void {
    this.router.get(`/${RESTServerRoute.REST_SUBSCRIPTION_PLAN}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.query.ID = sanitize(req.params.id);
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleGetSubscriptionPlan.bind(this),
          ServerAction.SUBSCRIPTION_PLAN, req, res, next);
      });
  }

  private buildRouteCreateSubscriptionPlan(): void {
    this.router.post(`/${RESTServerRoute.REST_SUBSCRIPTION_PLANS}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleCreateSubscriptionPlan.bind(this),
          ServerAction.SUBSCRIPTION_PLAN_CREATE, req, res, next);
      });
  }

  private buildRouteUpdateSubscriptionPlan(): void {
    this.router.put(`/${RESTServerRoute.REST_SUBSCRIPTION_PLAN}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.body.id = req.params.id;
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleUpdateSubscriptionPlan.bind(this),
          ServerAction.SUBSCRIPTION_PLAN_UPDATE, req, res, next);
      });
  }

  private buildRouteDeleteSubscriptionPlan(): void {
    this.router.delete(`/${RESTServerRoute.REST_SUBSCRIPTION_PLAN}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.query.ID = req.params.id;
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleDeleteSubscriptionPlan.bind(this),
          ServerAction.SUBSCRIPTION_PLAN_DELETE, req, res, next);
      });
  }

  // ============ SUBSCRIPTIONS ============

  private buildRouteSubscriptions(): void {
    this.router.get(`/${RESTServerRoute.REST_SUBSCRIPTIONS}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleGetSubscriptions.bind(this),
          ServerAction.SUBSCRIPTIONS, req, res, next);
      });
  }

  private buildRouteSubscription(): void {
    this.router.get(`/${RESTServerRoute.REST_SUBSCRIPTION}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.query.ID = sanitize(req.params.id);
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleGetSubscription.bind(this),
          ServerAction.SUBSCRIPTION, req, res, next);
      });
  }

  private buildRouteCreateSubscription(): void {
    this.router.post(`/${RESTServerRoute.REST_SUBSCRIPTIONS}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleCreateSubscription.bind(this),
          ServerAction.SUBSCRIPTION_CREATE, req, res, next);
      });
  }

  private buildRouteCancelSubscription(): void {
    this.router.put(`/${RESTServerRoute.REST_SUBSCRIPTION_CANCEL}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleCancelSubscription.bind(this),
          ServerAction.SUBSCRIPTION_CANCEL, req, res, next);
      });
  }

  private buildRouteSubscriptionUsage(): void {
    this.router.get(`/${RESTServerRoute.REST_SUBSCRIPTION_USAGE}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          SubscriptionService.handleGetSubscriptionUsage.bind(this),
          ServerAction.SUBSCRIPTION_USAGE, req, res, next);
      });
  }
}
