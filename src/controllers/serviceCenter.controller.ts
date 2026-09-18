import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  ServiceCenterService,
  CreateServiceCenterInput,
  UpdateServiceCenterInput,
} from "../services/serviceCenter.service";
import { DocumentService } from "../services/document.service";
import { StorageService } from "../services/storage.service";
import { ReviewService } from "../services/review.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

/** Value stored in `Document.entityType` for everything this controller attaches. */
const ENTITY_TYPE = "service_center" as const;

export class ServiceCenterController {
  constructor(
    private readonly serviceCenterService: ServiceCenterService,
    private readonly documentService: DocumentService,
    private readonly storageService: StorageService,
    private readonly reviewService: ReviewService,
  ) {}

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      tenantId: req.query.tenantId as string,
      city: req.query.city as string,
      status: req.query.status as string,
    };

    const result = await this.serviceCenterService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Service centers retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getNearbyCenters(req: Request, res: Response) {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const maxDistance = req.query.maxDistance
      ? parseFloat(req.query.maxDistance as string)
      : undefined;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const error = createErrorResponse(
        "lat and lng query parameters are required",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const centers = await this.serviceCenterService.findNearby(
      lng,
      lat,
      maxDistance,
    );

    const response = createSuccessResponse(
      centers,
      "Nearby centers retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const center = await this.serviceCenterService.findById(id);

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      center,
      "Service center retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async create(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;

    const input: CreateServiceCenterInput = {
      tenantId: data.tenantId,
      name: data.name,
      slug: data.slug,
      businessRegistrationNumber: data.businessRegistrationNumber,
      email: data.email,
      phone: data.phone,
      website: data.website,
      address: data.address
        ? {
            street: data.address.street,
            city: data.address.city,
            state: data.address.state,
            country: data.address.country,
            postalCode: data.address.postalCode,
            coordinates: data.address.coordinates
              ? { type: "Point", coordinates: data.address.coordinates }
              : undefined,
          }
        : undefined,
      subscription: data.subscription
        ? {
            planId: data.subscription.planId,
            trialEndsAt: data.subscription.trialEndsAt
              ? new Date(data.subscription.trialEndsAt)
              : undefined,
          }
        : undefined,
      settings: data.settings,
      servicesOffered: data.servicesOffered,
      createdBy: data.createdBy,
    };

    try {
      const center = await this.serviceCenterService.create(input);

      const response = createSuccessResponse(
        center,
        "Service center created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (
        error.message ===
        "Service center with this registration number already exists"
      ) {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.CONFLICT,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message === "Subscription plan not found") {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async update(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const input: UpdateServiceCenterInput = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      website: data.website,
      address: data.address
        ? {
            street: data.address.street,
            city: data.address.city,
            state: data.address.state,
            country: data.address.country,
            postalCode: data.address.postalCode,
            coordinates: data.address.coordinates
              ? { type: "Point", coordinates: data.address.coordinates }
              : undefined,
          }
        : undefined,
      settings: data.settings,
      servicesOffered: data.servicesOffered,
      subscription: data.subscription
        ? {
            status: data.subscription.status,
            expiresAt: data.subscription.expiresAt
              ? new Date(data.subscription.expiresAt)
              : undefined,
          }
        : undefined,
    };

    const center = await this.serviceCenterService.update(id, input);

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      center,
      "Service center updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const center = await this.serviceCenterService.delete(id);

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: center._id,
        deleted: true,
        deletedAt: center.deletedAt,
      },
      "Service center deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterVehicles(req: Request, res: Response) {
    const { id } = req.params;

    const vehicles = await this.serviceCenterService.getVehicles(id);

    const response = createSuccessResponse(
      vehicles,
      "Center vehicles retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterStaff(req: Request, res: Response) {
    const { id } = req.params;

    const staff = await this.serviceCenterService.getStaff(id);

    const response = createSuccessResponse(
      staff,
      "Center staff retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterServices(req: Request, res: Response) {
    const { id } = req.params;

    const center = await this.serviceCenterService.findById(id);

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      center.servicesOffered,
      "Services retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async addService(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    try {
      const center = await this.serviceCenterService.addService(id, {
        name: data.name,
        category: data.category,
        duration: data.duration,
        basePrice: data.basePrice,
      });

      const response = createSuccessResponse(
        center.servicesOffered,
        "Service added successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Service center not found") {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async updateService(req: ValidatedRequest<any>, res: Response) {
    const { id, serviceId } = req.params;

    const service = await this.serviceCenterService.updateService(
      id,
      serviceId,
      req.validated,
    );

    if (service === null) {
      const error = createErrorResponse("Service center not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }
    if (service === undefined) {
      const error = createErrorResponse("Service not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(service, "Service updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async deleteService(req: Request, res: Response) {
    const { id, serviceId } = req.params;

    const center = await this.serviceCenterService.findById(id);

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const serviceEntry = center.servicesOffered.id(serviceId);

    if (!serviceEntry) {
      const error = createErrorResponse(
        "Service not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const updated = await this.serviceCenterService.removeService(
      id,
      serviceEntry.name,
    );

    const response = createSuccessResponse(
      {
        id: serviceId,
        deleted: true,
        servicesOffered: updated.servicesOffered,
      },
      "Service deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterStats(req: Request, res: Response) {
    const { id } = req.params;

    const center = await this.serviceCenterService.findById(id);

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      center.stats,
      "Stats retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterReviews(req: Request, res: Response) {
    const { id } = req.params;

    const center = await this.serviceCenterService.findById(id);
    if (!center) {
      const error = createErrorResponse("Service center not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const reviews = await this.reviewService.findByCenter(id);

    const response = createSuccessResponse(reviews, "Reviews retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async addReview(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;

    const review = await this.reviewService.upsertForCenter(id, req.user!.id, req.validated);
    if (!review) {
      const error = createErrorResponse("Service center not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      review,
      "Review submitted successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async verifyCenter(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { isVerified, notes } = req.validated;

    const verification = await this.serviceCenterService.setVerification(
      id,
      isVerified,
      req.user?.id,
      notes,
    );

    if (!verification) {
      const error = createErrorResponse("Service center not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      verification,
      isVerified ? "Service center verified successfully" : "Service center verification removed",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async uploadDocument(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      const error = createErrorResponse("No file was uploaded", HttpStatus.BAD_REQUEST);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const center = await this.serviceCenterService.findById(id);
    if (!center) {
      const error = createErrorResponse("Service center not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const data = req.validated;
    const stored = await this.storageService.saveFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      ENTITY_TYPE,
    );

    const document = await this.documentService.create({
      accountId: data.accountId ?? req.user?.id,
      originalName: stored.originalName,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      size: stored.size,
      extension: stored.extension,
      storageProvider: stored.storageProvider,
      url: stored.url,
      path: stored.path,
      entityType: ENTITY_TYPE,
      entityId: id,
      documentType: data.documentType,
      description: data.description,
      tags: data.tags,
      isPublic: data.isPublic,
      allowedRoles: data.allowedRoles,
      allowedAccounts: data.allowedAccounts,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      metadata: data.metadata,
    });

    const response = createSuccessResponse(
      document,
      "Document uploaded successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getDocuments(req: Request, res: Response) {
    const { id } = req.params;

    const documents = await this.documentService.findByEntity(ENTITY_TYPE, id, {
      type: req.query.type as string,
    });

    const response = createSuccessResponse(documents, "Documents retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getSettings(req: Request, res: Response) {
    const { id } = req.params;

    const center = await this.serviceCenterService.findById(id);

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      center.settings,
      "Settings retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateSettings(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const center = await this.serviceCenterService.update(id, {
      settings: data.settings,
    });

    if (!center) {
      const error = createErrorResponse(
        "Service center not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      center.settings,
      "Settings updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
