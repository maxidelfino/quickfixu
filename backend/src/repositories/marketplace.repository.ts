import prisma from '../config/database';

const requestInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
    },
  },
  categories: {
    include: {
      category: true,
    },
  },
  media: true,
  proposals: true,
} as const;

const proposalInclude = {
  request: {
    select: {
      id: true,
      userId: true,
      title: true,
      status: true,
    },
  },
  professional: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          rating: true,
          ratingCount: true,
        },
      },
    },
  },
  appointment: true,
} as const;

const appointmentInclude = {
  request: {
    select: {
      id: true,
      userId: true,
      title: true,
      status: true,
    },
  },
  proposal: {
    include: {
      professional: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  },
} as const;

interface CreateRequestInput {
  userId: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  expiresAt: Date;
  categoryIds: number[];
  media: Array<{ mediaType: 'image' | 'video'; mediaUrl: string }>;
}

interface CreateProposalInput {
  requestId: number;
  professionalId: number;
  priceReference: number;
  scopeNotes: string;
  proposedDate: Date | null;
  proposedTime: Date | null;
  expiresAt: Date;
}

class MarketplaceRepository {
  async createRequest(input: CreateRequestInput) {
    return prisma.$transaction(async (tx: any) => {
      const createdRequest = await tx.request.create({
        data: {
          userId: input.userId,
          title: input.title,
          description: input.description,
          latitude: input.latitude,
          longitude: input.longitude,
          expiresAt: input.expiresAt,
          status: 'published',
        },
      });

      await tx.requestCategory.createMany({
        data: input.categoryIds.map((categoryId) => ({
          requestId: createdRequest.id,
          categoryId,
        })),
      });

      await Promise.all(
        input.media.map((item) =>
          tx.requestMedia.create({
            data: {
              requestId: createdRequest.id,
              mediaType: item.mediaType,
              mediaUrl: item.mediaUrl,
            },
          })
        )
      );

      return tx.request.findUnique({
        where: { id: createdRequest.id },
        include: requestInclude,
      });
    });
  }

  async listRequestsForClient(userId: number) {
    return prisma.request.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRequestsForProfessional() {
    return prisma.request.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ['published', 'receiving_proposals'],
        },
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequestById(id: number) {
    return prisma.request.findUnique({
      where: { id },
      include: requestInclude,
    });
  }

  async getProfessionalByUserId(userId: number) {
    return prisma.professional.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            rating: true,
            ratingCount: true,
          },
        },
      },
    } as any);
  }

  async createProposal(input: CreateProposalInput) {
    return prisma.$transaction(async (tx: any) => {
      const createdProposal = await tx.proposal.create({
        data: {
          requestId: input.requestId,
          professionalId: input.professionalId,
          priceReference: input.priceReference,
          scopeNotes: input.scopeNotes,
          proposedDate: input.proposedDate,
          proposedTime: input.proposedTime,
          expiresAt: input.expiresAt,
          status: 'sent',
        },
      });

      await tx.request.update({
        where: { id: input.requestId },
        data: { status: 'receiving_proposals' },
      });

      return tx.proposal.findUnique({
        where: { id: createdProposal.id },
        include: proposalInclude,
      });
    });
  }

  async listProposalsByRequest(requestId: number, professionalId?: number) {
    return prisma.proposal.findMany({
      where: {
        requestId,
        ...(professionalId ? { professionalId } : {}),
      },
      include: proposalInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProposalById(id: number) {
    return prisma.proposal.findUnique({
      where: { id },
      include: proposalInclude,
    });
  }

  async acceptProposal(proposalId: number, requestId: number, proposedDate: Date | null, proposedTime: Date | null) {
    return prisma.$transaction(async (tx: any) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: { status: 'accepted' },
      });

      await tx.proposal.updateMany({
        where: {
          requestId,
          id: { not: proposalId },
          status: { in: ['sent', 'viewed'] },
        },
        data: { status: 'rejected' },
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: 'in_coordination' },
      });

      return tx.appointment.create({
        data: {
          proposalId,
          requestId,
          status: 'coordinating',
          scheduledDate: proposedDate,
          scheduledTime: proposedTime,
        },
        include: appointmentInclude,
      });
    });
  }

  async getAppointmentById(id: number) {
    return prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
  }

  async updateAppointmentCompletion(appointmentId: number, data: Record<string, unknown>, completeRequest: boolean, requestId: number) {
    return prisma.$transaction(async (tx: any) => {
      const appointment = await tx.appointment.update({
        where: { id: appointmentId },
        data,
        include: appointmentInclude,
      });

      if (completeRequest) {
        await tx.request.update({
          where: { id: requestId },
          data: { status: 'completed' },
        });
      }

      return appointment;
    });
  }
}

export const marketplaceRepository = new MarketplaceRepository();
