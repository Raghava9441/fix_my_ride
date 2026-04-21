import { Request, Response } from "express";
import {
  AccountService,
  CreateAccountInput,
  UpdateAccountInput,
} from "../services/account.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      tenantId: req.query.tenantId as string,
    };

    const result = await this.accountService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Accounts retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const account = await this.accountService.findById(id);

    if (!account) {
      const error = createErrorResponse(
        "Account not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      account,
      "Account retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async create(req: Request, res: Response) {
    const data = req.validated;

    const existingAccount = await this.accountService.findByEmail(data.email);
    if (existingAccount) {
      const error = createErrorResponse(
        "Email already registered",
        HttpStatus.CONFLICT,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const input: CreateAccountInput = {
      email: data.email,
      phone: data.phone,
      password: data.password,
      primaryRole: data.primaryRole,
      tenantId: data.tenantId,
    };

    const account = await this.accountService.create(input);

    const response = createSuccessResponse(
      {
        id: account._id,
        email: account.email,
        role: account.primaryRole,
        status: account.status,
      },
      "Account created successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const account = await this.accountService.update(
      id,
      data as UpdateAccountInput,
    );

    if (!account) {
      const error = createErrorResponse(
        "Account not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      account,
      "Account updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const account = await this.accountService.softDelete(id);

    if (!account) {
      const error = createErrorResponse(
        "Account not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: account._id,
        deleted: true,
        deletedAt: account.deletedAt,
      },
      "Account deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status, suspensionReason } = req.validated;

    const account = await this.accountService.updateStatus(
      id,
      status,
      suspensionReason,
    );

    if (!account) {
      const error = createErrorResponse(
        "Account not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: account._id,
        status: account.status,
      },
      "Account status updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async assignRole(req: Request, res: Response) {
    const { id } = req.params;
    const { roleId, profileId } = req.validated;

    try {
      const account = await this.accountService.assignRole(
        id,
        roleId,
        profileId,
      );

      if (!account) {
        const error = createErrorResponse(
          "Account not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(error.statusCode).json(error.toJSON());
      }

      const response = createSuccessResponse(
        {
          accountId: account._id,
          roleId: roleId,
        },
        "Role assigned successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Role not found") {
        const apiError = createErrorResponse(
          "Role not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async removeRole(req: Request, res: Response) {
    const { id, roleId } = req.params;

    const account = await this.accountService.removeRole(id, roleId);

    if (!account) {
      const error = createErrorResponse(
        "Account not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        accountId: account._id,
        roleId: roleId,
        removed: true,
      },
      "Role removed successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getPermissions(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const permissions = await this.accountService.getPermissions(id);

      const response = createSuccessResponse(
        permissions,
        "Permissions retrieved successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Account not found") {
        const apiError = createErrorResponse(
          "Account not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async switchRole(req: Request, res: Response) {
    const { accountId, roleId } = req.validated;

    try {
      const account = await this.accountService.switchRole(accountId, roleId);

      if (!account) {
        const error = createErrorResponse(
          "Account not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(error.statusCode).json(error.toJSON());
      }

      const response = createSuccessResponse(
        {
          accountId: account._id,
          newRoleId: roleId,
        },
        "Role switched successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Role not assigned to this account") {
        const apiError = createErrorResponse(
          "Role not assigned to this account",
          HttpStatus.FORBIDDEN,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }
}
