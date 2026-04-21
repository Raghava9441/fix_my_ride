import { Role } from "../models/Role";
import { Permission } from "../models/Permission";
import mongoose from "mongoose";

export interface CreateRoleInput {
  name: string;
  slug: string;
  description?: string;
  type?: "system" | "tenant" | "custom";
  tenantId?: string;
  serviceCenterId?: string;
  level?: number;
  permissions?: string[];
  inheritsFrom?: string[];
  color?: string;
  icon?: string;
  maxUsers?: number;
  isDefault?: boolean;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  level?: number;
  permissions?: string[];
  inheritsFrom?: string[];
  color?: string;
  icon?: string;
  maxUsers?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface RoleFilters {
  page?: number;
  limit?: number;
  type?: string;
  tenantId?: string;
  serviceCenterId?: string;
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

export class RoleService {
  async findAll(filters?: RoleFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters?.type) query.type = filters.type;
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.serviceCenterId)
      query.serviceCenterId = filters.serviceCenterId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;

    const [roles, total] = await Promise.all([
      Role.find(query)
        .populate("permissions", "key name description resource action scope")
        .populate("inheritsFrom", "name slug level")
        .skip(skip)
        .limit(limit)
        .sort({ level: 1, name: 1 }),
      Role.countDocuments(query),
    ]);

    return {
      data: roles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Role.findById(id)
      .populate("permissions", "key name description resource action scope")
      .populate("inheritsFrom", "name slug level");
  }

  async findBySlug(slug: string, tenantId?: string): Promise<any | null> {
    const query: any = { slug };
    if (tenantId) {
      query.$or = [{ tenantId }, { type: "system" }];
    }
    return Role.findOne(query).populate(
      "permissions",
      "key name description resource action scope",
    );
  }

  async findByTenant(tenantId: string): Promise<any[]> {
    return Role.find({
      $or: [{ tenantId }, { type: "system" }],
      isActive: true,
    }).populate("permissions", "key name");
  }

  async findByServiceCenter(serviceCenterId: string): Promise<any[]> {
    return Role.findForServiceCenter(serviceCenterId);
  }

  async create(input: CreateRoleInput): Promise<any> {
    const existing = await Role.findOne({
      slug: input.slug,
      ...(input.tenantId && { tenantId: input.tenantId }),
      ...(input.serviceCenterId && { serviceCenterId: input.serviceCenterId }),
      ...(!input.tenantId && !input.serviceCenterId && { type: "system" }),
    });

    if (existing) {
      throw new Error("Role with this slug already exists");
    }

    let permissionIds: mongoose.Types.ObjectId[] = [];
    if (input.permissions?.length) {
      const perms = await Permission.find({ key: { $in: input.permissions } });
      permissionIds = perms.map((p) => p._id);
    }

    let inheritsFromIds: mongoose.Types.ObjectId[] = [];
    if (input.inheritsFrom?.length) {
      const inheritedRoles = await Role.find({
        slug: { $in: input.inheritsFrom },
      });
      inheritsFromIds = inheritedRoles.map((r) => r._id);
    }

    const role = await Role.create({
      name: input.name,
      slug: input.slug.toLowerCase(),
      description: input.description,
      type: input.type || "custom",
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : undefined,
      serviceCenterId: input.serviceCenterId
        ? new mongoose.Types.ObjectId(input.serviceCenterId)
        : undefined,
      level: input.level || 100,
      permissions: permissionIds,
      inheritsFrom: inheritsFromIds,
      color: input.color || "#6B7280",
      icon: input.icon,
      maxUsers: input.maxUsers || 0,
      isActive: true,
      isDefault: input.isDefault || false,
    });

    return role;
  }

  async update(id: string, updates: UpdateRoleInput): Promise<any | null> {
    const updateObj: any = { ...updates };

    if (updates.permissions?.length) {
      const perms = await Permission.find({
        key: { $in: updates.permissions },
      });
      updateObj.permissions = perms.map((p) => p._id);
    }

    if (updates.inheritsFrom?.length) {
      const inheritedRoles = await Role.find({
        slug: { $in: updates.inheritsFrom },
      });
      updateObj.inheritsFrom = inheritedRoles.map((r) => r._id);
    }

    const role = await Role.findByIdAndUpdate(id, updateObj, {
      new: true,
      runValidators: true,
    });

    return role;
  }

  async delete(id: string): Promise<any | null> {
    const role = await Role.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );
    return role;
  }

  async addPermission(roleId: string, permissionKey: string): Promise<any> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    await role.addPermission(permissionKey);
    return role;
  }

  async removePermission(roleId: string, permissionKey: string): Promise<any> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    await role.removePermission(permissionKey);
    return role;
  }

  async getPermissions(roleId: string): Promise<string[]> {
    const role = await Role.findById(roleId).populate("permissions");
    if (!role) {
      throw new Error("Role not found");
    }

    return role.getAllPermissions();
  }

  async hasPermission(roleId: string, permissionKey: string): Promise<boolean> {
    const role = await Role.findById(roleId);
    if (!role) {
      return false;
    }

    return role.hasPermission(permissionKey);
  }

  async seedSystemRoles(): Promise<void> {
    await Role.seedSystemRoles();
  }

  async seedDefaults(): Promise<void> {
    await this.seedSystemRoles();
    await Permission.seedDefaults();
  }

  async getSystemRoles(): Promise<any[]> {
    return Role.getSystemRoles();
  }

  async setDefaultRole(roleId: string, tenantId?: string): Promise<any> {
    const query: any = { isDefault: true };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    await Role.updateMany(query, { $set: { isDefault: false } });

    const role = await Role.findByIdAndUpdate(
      roleId,
      { $set: { isDefault: true } },
      { new: true },
    );

    return role;
  }
}

export const roleService = new RoleService();
