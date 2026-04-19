import { Request, Response, NextFunction } from 'express';
import { marketplaceService } from '../services/marketplace.service';
import { AppError } from '../types/errors.types';

class RequestController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await marketplaceService.createRequest(req.user!.id, req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requests = await marketplaceService.listRequests(req.user!);
      res.status(200).json({ count: requests.length, requests });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = parseInt(req.params.id, 10);
      if (isNaN(requestId)) {
        throw new AppError(400, 'Invalid request ID');
      }

      const request = await marketplaceService.getRequestById(req.user!, requestId);
      res.status(200).json(request);
    } catch (error) {
      next(error);
    }
  }

  async listProposals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = parseInt(req.params.id, 10);
      if (isNaN(requestId)) {
        throw new AppError(400, 'Invalid request ID');
      }

      const proposals = await marketplaceService.listRequestProposals(req.user!, requestId);
      res.status(200).json({ count: proposals.length, proposals });
    } catch (error) {
      next(error);
    }
  }
}

export const requestController = new RequestController();
