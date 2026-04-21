import { Permission } from "../models/Permission";
import mongoose from "mongoose";

export interface CreatePermissionInput {
  key: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  scope?: string;
  category?: string;
  requiredPlan?: string;
}

export interface UpdatePermissionInput {
  name?: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export interface PermissionFilters {
  page?: number;
  limit?: number;
  resource?: string;
  action?: string;
  scope?: string;
  isActive?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class PermissionService {
  async findAll(filters?: PermissionFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters?.resource) query.resource = filters.resource;
    if (filters?.action) query.action = filters.action;
    if (filters?.scope) query.scope = filters.scope;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;

    const [permissions, total] = await Promise.all([
      Permission.find(query)
        .select("-isActive")
        .skip(skip)
        .limit(limit)
        .sort({ resource: 1, action: 1 }),
      Permission.countDocuments(query),
    ]);

    return {
      data: permissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Permission.findById(id).select("-isActive");
  }

  async findByKey(key: string): Promise<any | null> {
    return Permission.findOne({ key });
  }

  async findByKeys(keys: string[]): Promise<any[]> {
    return Permission.find({ key: { $in: keys } });
  }

  async findByResource(resource: string): Promise<any[]> {
    return Permission.find({ resource, isActive: true }).sort({ action: 1 });
  }

  async create(input: CreatePermissionInput): Promise<any> {
    const existing = await Permission.findOne({ key: input.key });
    if (existing) {
      throw new Error("Permission key already exists");
    }

    const permission = await Permission.create({
      key: input.key,
      name: input.name,
      description: input.description,
      resource: input.resource,
      action: input.action,
      scope: input.scope || "own",
      category: input.category,
      requiredPlan: input.requiredPlan || "free",
      isActive: true,
    });

    return permission;
  }

  async update(
    id: string,
    updates: UpdatePermissionInput,
  ): Promise<any | null> {
    const permission = await Permission.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    return permission;
  }

  async delete(id: string): Promise<any | null> {
    const permission = await Permission.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );
    return permission;
  }

  async seedDefaults(): Promise<void> {
    await Permission.seedDefaults();
  }

  async getActivePermissions(): Promise<any[]> {
    return Permission.find({ isActive: true }).sort({ resource: 1, action: 1 });
  }
}

export const permissionService = new PermissionService();
