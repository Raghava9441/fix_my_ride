import { Account, IAccount } from "../models/Account";
import { Role } from "../models/Role";
import mongoose from "mongoose";

export interface CreateAccountInput {
    email: string;
    phone?: string;
    password: string;
    primaryRole: string;
    tenantId?: string;
}

export interface UpdateAccountInput {
    email?: string;
    phone?: string;
    primaryRole?: string;
    status?: string;
    preferences?: {
        language?: string;
        timezone?: string;
        currency?: string;
    };
}

export interface AccountFilters {
    page?: number;
    limit?: number;
    status?: string;
    tenantId?: string;
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

export class AccountService {
    async findAll(filters?: AccountFilters): Promise<PaginatedResult<IAccount>> {
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const skip = (page - 1) * limit;

        const query: any = { isDeleted: false };

        if (filters?.tenantId) {
            query.tenantId = filters.tenantId;
        }

        if (filters?.status) {
            query.status = filters.status;
        }

        const [accounts, total] = await Promise.all([
            Account.find(query)
                .populate("ownerProfile")
                .populate("staffProfile")
                .select(
                    "-passwordHash -mfaSecret -mfaBackupCodes -emailVerificationToken -passwordResetToken",
                )
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Account.countDocuments(query),
        ]);

        return {
            data: accounts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findById(id: string): Promise<IAccount | null> {
        return Account.findOne({ _id: id, isDeleted: false })
            .populate("ownerProfile")
            .populate("staffProfile")
            .select("-passwordHash -mfaSecret -mfaBackupCodes");
    }

    async create(input: CreateAccountInput): Promise<IAccount> {
        const account = await Account.create({
            email: input.email.toLowerCase(),
            phone: input.phone,
            passwordHash: input.password,
            primaryRole: input.primaryRole,
            roles: [input.primaryRole],
            tenantId: input.tenantId
                ? new mongoose.Types.ObjectId(input.tenantId)
                : undefined,
            status: "pending_verification",
            mfaEnabled: false,
            emailVerified: false,
            phoneVerified: false,
            failedLoginAttempts: 0,
            preferences: {
                language: "en",
                timezone: "UTC",
                currency: "USD",
                notificationPreferences: {
                    email: { marketing: false, transactional: true, security: true },
                    sms: { enabled: true, marketing: false },
                    push: { enabled: false, deviceTokens: [] },
                },
            },
        });

        const verificationToken = account.generateEmailVerificationToken();
        await account.save();

        return account;
    }

    async update(
        id: string,
        updates: UpdateAccountInput,
    ): Promise<IAccount | null> {
        const updateObj: any = { ...updates };

        if (updates.preferences) {
            updateObj.preferences = updates.preferences;
            delete updateObj.preferences;
        }

        const account = await Account.findByIdAndUpdate(
            id,
            { $set: updateObj },
            { new: true, runValidators: true },
        ).select("-passwordHash -mfaSecret");

        return account;
    }

    async softDelete(id: string): Promise<IAccount | null> {
        const account = await Account.findById(id);
        if (!account) {
            return null;
        }

        await account.softDelete();
        return account;
    }

    async updateStatus(
        id: string,
        status: string,
        suspensionReason?: string,
    ): Promise<IAccount | null> {
        const updateObj: any = { status };
        if (suspensionReason) {
            updateObj.suspensionReason = suspensionReason;
        }

        const account = await Account.findByIdAndUpdate(id, updateObj, {
            new: true,
        });
        return account;
    }

    async assignRole(
        accountId: string,
        roleId: string,
        profileId?: string,
    ): Promise<IAccount | null> {
        const account = await Account.findById(accountId);
        if (!account) {
            return null;
        }

        const role = await Role.findById(roleId);
        if (!role) {
            throw new Error("Role not found");
        }

        const profileObjectId = profileId
            ? new mongoose.Types.ObjectId(profileId)
            : undefined;

        await account.addRole(role.name, profileObjectId);
        return account;
    }

    async removeRole(
        accountId: string,
        roleName: string,
    ): Promise<IAccount | null> {
        const account = await Account.findById(accountId);
        if (!account) {
            return null;
        }

        account.roles = account.roles.filter((role: string) => role !== roleName);

        if (account.ownerProfileId?.toString() === roleName) {
            account.ownerProfileId = undefined;
        }
        if (account.staffProfileId?.toString() === roleName) {
            account.staffProfileId = undefined;
        }

        await account.save();
        return account;
    }

    async getPermissions(accountId: string): Promise<any[]> {
        const account = await Account.findById(accountId)
            .populate("roleId")
            .select("roles primaryRole");

        if (!account) {
            throw new Error("Account not found");
        }

        const permissions = await Promise.all(
            account.roles.map(async (roleName: string) => {
                const role = await Role.findOne({ name: roleName }).populate(
                    "permissions",
                );
                return role?.permissions || [];
            }),
        );

        const flatPermissions = permissions.flat();
        const uniquePermissions = Array.from(
            new Map(flatPermissions.map((p: any) => [p._id.toString(), p])).values(),
        );

        return uniquePermissions.map((p: any) => ({
            id: p._id,
            name: p.name,
            description: p.description,
            key: p.key,
        }));
    }

    async switchRole(
        accountId: string,
        roleId: string,
    ): Promise<IAccount | null> {
        const account = await Account.findById(accountId);
        if (!account) {
            return null;
        }

        const hasRole = account.roles.includes(roleId);
        if (!hasRole) {
            throw new Error("Role not assigned to this account");
        }

        return account;
    }

    async findByEmail(email: string): Promise<IAccount | null> {
        return Account.findOne({ email: email.toLowerCase(), isDeleted: false });
    }

    async findActive(filter = {}): Promise<IAccount[]> {
        return Account.findActive(filter);
    }
}

export const accountService = new AccountService();
