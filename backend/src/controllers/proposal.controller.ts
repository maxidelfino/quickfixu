import { Request, Response, NextFunction } from 'express';
import { marketplaceService } from '../services/marketplace.service';
import { AppError } from '../types/errors.types';

class ProposalController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposal = await marketplaceService.createProposal(req.user!.id, req.body);
      res.status(201).json(proposal);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposalId = parseInt(req.params.id, 10);
      if (isNaN(proposalId)) {
        throw new AppError(400, 'Invalid proposal ID');
      }

      const proposal = await marketplaceService.getProposalById(req.user!, proposalId);
      res.status(200).json(proposal);
    } catch (error) {
      next(error);
    }
  }

  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposalId = parseInt(req.params.id, 10);
      if (isNaN(proposalId)) {
        throw new AppError(400, 'Invalid proposal ID');
      }

      const appointment = await marketplaceService.acceptProposal(req.user!.id, proposalId);
      res.status(201).json(appointment);
    } catch (error) {
      next(error);
    }
  }
}

export const proposalController = new ProposalController();
