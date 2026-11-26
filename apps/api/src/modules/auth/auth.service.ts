import { HTTP_STATUS, resolveUploadedAvatarUrl } from "@addisgebeya/shared";
import type { AuthProviderName, GoogleOAuthIntent } from "@addisgebeya/types";
import { AuthProvider, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { cloudinaryService } from "../media/cloudinary.service.js";
import { notificationService } from "../notifications/notification.service.js";
import type { VerifiedGoogleIdentity } from "./google-oauth.strategy.js";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  preferredSize?: number;
  subCity?: string;
  landmark?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface UserAuthShape {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  passwordHash: string | null;
  role: Role;
  preferredSize: number | null;
  subCity: string | null;
  avatarUrl: string | null;
  oauthAccounts?: Array<{ provider: AuthProvider }>;
  addresses?: Array<{ subCity: string }>;
}

function getAuthProvidersForUser(user: Pick<UserAuthShape, "passwordHash" | "oauthAccounts">): AuthProviderName[] {
  const providers: AuthProviderName[] = [];
  if (user.passwordHash) {
    providers.push("password");
  }
  if (user.oauthAccounts?.some((account) => account.provider === AuthProvider.GOOGLE)) {
    providers.push("google");
  }
  return providers;
}

function formatBasicAuthUser(user: UserAuthShape) {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    phone: user.phoneNumber ?? "",
    role: user.role.toLowerCase() as "customer" | "admin",
    preferredSize: user.preferredSize ?? 42,
    subCity: user.subCity ?? user.addresses?.[0]?.subCity ?? "",
    avatarUrl: resolveUploadedAvatarUrl(user.avatarUrl),
    hasPassword: Boolean(user.passwordHash),
    authProviders: getAuthProvidersForUser(user),
  };
}

export class AuthService {
  private async issueSessionTokens(
    user: { id: string; role: Role },
    db: Pick<Prisma.TransactionClient, "refreshToken"> = prisma,
  ) {
    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();

    if (!input.name || input.name.trim().length < 2) {
      throw new AppError({
        message: "Full name must be at least 2 characters long",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_NAME",
      });
    }

    if (!input.password || input.password.length < 6) {
      throw new AppError({
        message: "Password must be at least 6 characters long",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "WEAK_PASSWORD",
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError({
        message: "An account with this email address already exists",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "EMAIL_EXISTS",
      });
    }

    const passwordHash = await hashPassword(input.password);

    // SECURITY: Always assign CUSTOMER role for public registration. Never allow admin self-grant!
    const { user, accessToken, refreshToken } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          fullName: input.name.trim(),
          email,
          phoneNumber: input.phone || "+251911000000",
          passwordHash,
          role: Role.CUSTOMER,
          preferredSize: input.preferredSize ?? 42,
          subCity: input.subCity ?? "Bole (Rwanda / Edna / Japan / Atlas)",
          cart: { create: {} },
          wishlist: { create: {} },
          addresses: input.subCity
            ? {
                create: {
                  fullName: input.name.trim(),
                  phoneNumber: input.phone || "+251911000000",
                  region: "Addis Ababa",
                  city: "Addis Ababa",
                  subCity: input.subCity,
                  landmark: input.landmark,
                  isDefault: true,
                },
              }
            : undefined,
        },
        include: {
          oauthAccounts: { select: { provider: true } },
        },
      });

      const tokens = await this.issueSessionTokens(createdUser, tx);

      await notificationService.notifyAdmins(
        {
          title: `New Customer Registered — ${createdUser.fullName}`,
          message: `${createdUser.fullName} (${createdUser.subCity ?? "Addis Ababa"}) joined AddisGebeya on ${createdUser.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
          type: "admin_customer_registered",
          relatedEntityId: createdUser.id,
          relatedEntityType: "customer",
          metadata: {
            customerId: createdUser.id,
            customerName: createdUser.fullName,
            subCity: createdUser.subCity ?? null,
            registeredAt: createdUser.createdAt.toISOString(),
          },
          idempotencyKey: `admin-customer-registered:${createdUser.id}`,
        },
        tx,
      );

      return {
        user: createdUser,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    });

    void notificationService.flushOutbox();

    return {
      user: formatBasicAuthUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();

    if (!email || !input.password) {
      throw new AppError({
        message: "Email and password are required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "MISSING_CREDENTIALS",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        addresses: true,
        oauthAccounts: { select: { provider: true } },
      },
    });

    if (!user) {
      throw new AppError({
        message: "Invalid email or password",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "INVALID_CREDENTIALS",
      });
    }

    if (!user.isActive) {
      throw new AppError({
        message: "This account has been deactivated. Please contact support.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    if (!user.passwordHash) {
      throw new AppError({
        message: "This account uses Google Sign-In. Please continue with Google or set a password.",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "INVALID_CREDENTIALS",
      });
    }

    const isMatch = await verifyPassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError({
        message: "Invalid email or password",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "INVALID_CREDENTIALS",
      });
    }

    const { accessToken, refreshToken } = await this.issueSessionTokens(user);

    return {
      user: formatBasicAuthUser(user),
      accessToken,
      refreshToken,
    };
  }

  async authenticateWithGoogle(
    identity: VerifiedGoogleIdentity,
    _intent: GoogleOAuthIntent = "login",
  ) {
    const email = identity.email.trim().toLowerCase();
    const googleId = identity.googleId.trim();

    if (!googleId || !email) {
      throw new AppError({
        message: "Google authentication did not provide valid account details.",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "INVALID_GOOGLE_IDENTITY",
      });
    }

    if (!identity.emailVerified) {
      throw new AppError({
        message: "Your Google email address must be verified before continuing.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const sanitizedGoogleAvatar = resolveUploadedAvatarUrl(identity.avatarUrl);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingOAuth = await tx.oAuthAccount.findUnique({
          where: {
            provider_providerAccountId: {
              provider: AuthProvider.GOOGLE,
              providerAccountId: googleId,
            },
          },
          include: {
            user: {
              include: {
                addresses: true,
                oauthAccounts: { select: { provider: true } },
              },
            },
          },
        });

        let targetUser: UserAuthShape;
        let isNewUser = false;
        let linkedExistingAccount = false;

        if (existingOAuth) {
          if (!existingOAuth.user.isActive) {
            throw new AppError({
              message: "This account has been deactivated. Please contact support.",
              statusCode: HTTP_STATUS.FORBIDDEN,
              code: "ACCOUNT_DEACTIVATED",
            });
          }

          await tx.oAuthAccount.update({
            where: { id: existingOAuth.id },
            data: {
              providerEmail: email,
              providerName: identity.fullName,
              providerAvatarUrl: sanitizedGoogleAvatar ?? existingOAuth.providerAvatarUrl,
              emailVerified: true,
            },
          });

          const shouldUpdateAvatar =
            Boolean(sanitizedGoogleAvatar) &&
            (!existingOAuth.user.avatarUrl ||
              existingOAuth.user.avatarUrl === existingOAuth.providerAvatarUrl);

          const updatedUser = await tx.user.update({
            where: { id: existingOAuth.user.id },
            data: {
              emailVerifiedAt: existingOAuth.user.emailVerifiedAt ?? new Date(),
              ...(shouldUpdateAvatar ? { avatarUrl: sanitizedGoogleAvatar } : {}),
            },
            include: {
              addresses: true,
              oauthAccounts: { select: { provider: true } },
            },
          });

          targetUser = updatedUser;
        } else {
          const existingByEmail = await tx.user.findUnique({
            where: { email },
            include: {
              addresses: true,
              oauthAccounts: true,
            },
          });

          if (existingByEmail) {
            if (!existingByEmail.isActive) {
              throw new AppError({
                message: "This account has been deactivated. Please contact support.",
                statusCode: HTTP_STATUS.FORBIDDEN,
                code: "ACCOUNT_DEACTIVATED",
              });
            }

            const existingGoogleAccount = existingByEmail.oauthAccounts.find(
              (account) => account.provider === AuthProvider.GOOGLE,
            );
            if (existingGoogleAccount && existingGoogleAccount.providerAccountId !== googleId) {
              throw new AppError({
                message: "This email address is already linked to another Google account.",
                statusCode: HTTP_STATUS.CONFLICT,
                code: "OAUTH_ACCOUNT_CONFLICT",
              });
            }

            if (!existingGoogleAccount) {
              await tx.oAuthAccount.create({
                data: {
                  userId: existingByEmail.id,
                  provider: AuthProvider.GOOGLE,
                  providerAccountId: googleId,
                  providerEmail: email,
                  providerName: identity.fullName,
                  providerAvatarUrl: sanitizedGoogleAvatar ?? null,
                  emailVerified: true,
                },
              });
              linkedExistingAccount = true;
            }

            const updatedLinkedUser = await tx.user.update({
              where: { id: existingByEmail.id },
              data: {
                emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
                ...(!existingByEmail.avatarUrl && sanitizedGoogleAvatar
                  ? { avatarUrl: sanitizedGoogleAvatar }
                  : {}),
              },
              include: {
                addresses: true,
                oauthAccounts: { select: { provider: true } },
              },
            });

            targetUser = updatedLinkedUser;
          } else {
            // SECURITY: Always assign CUSTOMER role for OAuth registrations.
            const createdUser = await tx.user.create({
              data: {
                fullName: identity.fullName,
                email,
                passwordHash: null,
                role: Role.CUSTOMER,
                isActive: true,
                emailVerifiedAt: new Date(),
                preferredSize: 42,
                avatarUrl: sanitizedGoogleAvatar ?? null,
                cart: { create: {} },
                wishlist: { create: {} },
                oauthAccounts: {
                  create: {
                    provider: AuthProvider.GOOGLE,
                    providerAccountId: googleId,
                    providerEmail: email,
                    providerName: identity.fullName,
                    providerAvatarUrl: sanitizedGoogleAvatar ?? null,
                    emailVerified: true,
                  },
                },
              },
              include: {
                addresses: true,
                oauthAccounts: { select: { provider: true } },
              },
            });

            await notificationService.notifyAdmins(
              {
                title: `New Customer Registered — ${createdUser.fullName}`,
                message: `${createdUser.fullName} registered via Google OAuth on ${createdUser.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
                type: "admin_customer_registered",
                relatedEntityId: createdUser.id,
                relatedEntityType: "customer",
                metadata: {
                  customerId: createdUser.id,
                  customerName: createdUser.fullName,
                  authProvider: "google",
                  registeredAt: createdUser.createdAt.toISOString(),
                },
                idempotencyKey: `admin-customer-registered:${createdUser.id}`,
              },
              tx,
            );

            targetUser = createdUser;
            isNewUser = true;
          }
        }

        const tokens = await this.issueSessionTokens(targetUser, tx);

        return {
          user: formatBasicAuthUser(targetUser),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isNewUser,
          linkedExistingAccount,
        };
      });

      if (result.isNewUser) {
        void notificationService.flushOutbox();
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError({
          message: "An account conflict occurred during Google authentication. Please try again.",
          statusCode: HTTP_STATUS.CONFLICT,
          code: "OAUTH_ACCOUNT_CONFLICT",
        });
      }
      throw error;
    }
  }

  async refreshToken(refreshTokenStr: string) {
    if (!refreshTokenStr) {
      throw new AppError({
        message: "Refresh token is required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "MISSING_REFRESH_TOKEN",
      });
    }

    try {
      verifyRefreshToken(refreshTokenStr);
    } catch {
      throw new AppError({
        message: "Invalid or expired refresh token signature",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    const tokenHash = hashToken(refreshTokenStr);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            addresses: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
            oauthAccounts: { select: { provider: true } },
          },
        },
      },
    });

    // SECURITY: Detect and revoke reused refresh tokens!
    if (storedToken && storedToken.revokedAt !== null) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      throw new AppError({
        message: "Refresh token reuse detected. Access revoked. Please log in again.",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "TOKEN_REUSE_DETECTED",
      });
    }

    if (!storedToken) {
      throw new AppError({
        message: "Refresh token not found or revoked",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "TOKEN_NOT_FOUND",
      });
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw new AppError({
        message: "Refresh token has expired. Please log in again.",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "EXPIRED_REFRESH_TOKEN",
      });
    }

    if (!storedToken.user || !storedToken.user.isActive) {
      throw new AppError({
        message: "User account is inactive or not found",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    // ROTATION: Revoke old token and issue new token pair
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await this.issueSessionTokens(storedToken.user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: formatBasicAuthUser(storedToken.user),
    };
  }

  async logout(refreshTokenStr?: string, userId?: string) {
    if (refreshTokenStr) {
      const tokenHash = hashToken(refreshTokenStr);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { loggedOut: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword) {
      throw new AppError({
        message: "New password is required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "MISSING_PASSWORD_FIELDS",
      });
    }

    if (newPassword.length < 8) {
      throw new AppError({
        message: "New password must be at least 8 characters long",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "WEAK_PASSWORD",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError({
        message: "User not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "USER_NOT_FOUND",
      });
    }

    const hadPassword = Boolean(user.passwordHash);
    if (user.passwordHash) {
      if (!currentPassword) {
        throw new AppError({
          message: "Current password and new password are required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "MISSING_PASSWORD_FIELDS",
        });
      }

      const isMatch = await verifyPassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new AppError({
          message: "Current password is incorrect",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "INVALID_CURRENT_PASSWORD",
        });
      }

      // Prevent reuse of current password
      const isSameAsCurrent = await verifyPassword(newPassword, user.passwordHash);
      if (isSameAsCurrent) {
        throw new AppError({
          message: "New password cannot be the same as your current password",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "PASSWORD_REUSED",
        });
      }
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all existing refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await this.issueSessionTokens(user);

    return {
      changed: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      message: hadPassword
        ? "Password changed successfully. Other active sessions have been revoked."
        : "Password created successfully. You can now sign in with email and password or Google.",
    };
  }

  async logoutAll(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: "Logged out from all devices successfully." };
  }

  async deactivateAccount(userId: string, passwordConfirm: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError({
        message: "User not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "USER_NOT_FOUND",
      });
    }

    if (user.role === Role.ADMIN) {
      throw new AppError({
        message: "Administrator accounts cannot be deactivated through the customer portal",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "ADMIN_DEACTIVATION_FORBIDDEN",
      });
    }

    if (!passwordConfirm) {
      throw new AppError({
        message: user.passwordHash
          ? "Password confirmation is required to deactivate account"
          : "Confirmation is required to deactivate account",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "PASSWORD_REQUIRED",
      });
    }

    if (user.passwordHash) {
      const isMatch = await verifyPassword(passwordConfirm, user.passwordHash);
      if (!isMatch) {
        throw new AppError({
          message: "Incorrect password. Account deactivation cancelled.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "INVALID_PASSWORD",
        });
      }
    } else if (passwordConfirm.trim().toUpperCase() !== "DEACTIVATE") {
      throw new AppError({
        message: 'Type "DEACTIVATE" to confirm deactivation of your Google-linked account.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_PASSWORD",
      });
    }

    // Soft-deactivate user account and revoke all tokens
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { deactivated: true, message: "Your account has been deactivated. All active sessions revoked." };
  }

  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    // Always return success message to avoid email enumeration
    return {
      message: `If an account with ${email} exists, password reset instructions have been dispatched.`,
      userFound: Boolean(user),
    };
  }

  async resetPassword(email: string, newPassword: string) {
    const normalized = email.trim().toLowerCase();
    if (!newPassword || newPassword.length < 8) {
      throw new AppError({
        message: "New password must be at least 8 characters long",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "WEAK_PASSWORD",
      });
    }

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user) {
      throw new AppError({
        message: "Account not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "USER_NOT_FOUND",
      });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { reset: true };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        oauthAccounts: {
          select: { provider: true },
        },
      },
    });

    if (!user) {
      throw new AppError({
        message: "User not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "USER_NOT_FOUND",
      });
    }

    const totalOrders = await prisma.order.count({ where: { userId } });
    const recentOrders = await prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        totalETB: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        items: {
          select: {
            productName: true,
            size: true,
            quantity: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const defaultAddress = user.addresses.find((a) => a.isDefault) ?? user.addresses[0] ?? null;
    const nameParts = user.fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    return {
      ...formatBasicAuthUser(user),
      firstName,
      lastName,
      subCity: user.subCity ?? defaultAddress?.subCity ?? "",
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      addresses: user.addresses,
      defaultAddress,
      totalOrders,
      recentOrders: recentOrders.map((o) => ({
        id: o.orderNumber ?? o.id,
        totalETB: Number(o.totalETB),
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        firstItem: o.items[0] ?? null,
      })),
    };
  }

  async updateProfile(
    userId: string,
    patch: {
      name?: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      phoneNumber?: string;
      preferredSize?: number;
      subCity?: string;
      avatarUrl?: string | null;
      dateOfBirth?: string | null;
    },
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError({
        message: "User not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "USER_NOT_FOUND",
      });
    }

    let nextFullName: string | undefined = undefined;
    if (patch.name?.trim()) {
      nextFullName = patch.name.trim();
    } else if (patch.fullName?.trim()) {
      nextFullName = patch.fullName.trim();
    } else if (patch.firstName || patch.lastName) {
      const f = patch.firstName?.trim() || "";
      const l = patch.lastName?.trim() || "";
      nextFullName = `${f} ${l}`.trim() || user.fullName;
    }

    let nextEmail: string | undefined = undefined;
    if (patch.email && patch.email.trim().toLowerCase() !== user.email) {
      const normalizedEmail = patch.email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing && existing.id !== userId) {
        throw new AppError({
          message: "Email address is already in use by another account",
          statusCode: HTTP_STATUS.CONFLICT,
          code: "EMAIL_ALREADY_EXISTS",
        });
      }
      nextEmail = normalizedEmail;
    }

    let nextDob: Date | null | undefined = undefined;
    if (patch.dateOfBirth !== undefined) {
      if (patch.dateOfBirth === null || patch.dateOfBirth === "") {
        nextDob = null;
      } else {
        const parsed = new Date(patch.dateOfBirth);
        if (!isNaN(parsed.getTime())) {
          nextDob = parsed;
        }
      }
    }

    const nextPhone = patch.phone?.trim() ?? patch.phoneNumber?.trim();
    let nextAvatarUrl: string | null | undefined = undefined;
    if (patch.avatarUrl === null || patch.avatarUrl === "") {
      nextAvatarUrl = null;
    } else if (patch.avatarUrl !== undefined) {
      const sanitized = resolveUploadedAvatarUrl(patch.avatarUrl);
      if (!sanitized) {
        throw new AppError({
          message: "Default, mock, placeholder, or generated avatar URLs cannot be saved.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "INVALID_AVATAR",
        });
      }
      nextAvatarUrl = sanitized;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: nextFullName,
        email: nextEmail,
        phoneNumber: nextPhone,
        preferredSize: patch.preferredSize,
        subCity: patch.subCity?.trim(),
        avatarUrl: nextAvatarUrl,
        dateOfBirth: nextDob,
      },
      include: {
        oauthAccounts: { select: { provider: true } },
      },
    });

    const nameParts = updated.fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    return {
      ...formatBasicAuthUser(updated),
      firstName,
      lastName,
      dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.toISOString().slice(0, 10) : null,
      emailVerifiedAt: updated.emailVerifiedAt ? updated.emailVerifiedAt.toISOString() : null,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async uploadAvatar(
    userId: string,
    input:
      | string
      | {
          avatarUrl?: string;
          file?: { buffer: Buffer; originalname: string };
        },
  ) {
    let resolvedUrl = typeof input === "string" ? input.trim() : (input?.avatarUrl ?? "").trim();

    if (typeof input === "object" && input?.file) {
      const uploaded = await cloudinaryService.uploadSingle(input.file.buffer, {
        folder: "addisgebeya/profiles",
        filenamePrefix: `avatar_${userId.slice(0, 8)}`,
        tags: ["addisgebeya", "avatar"],
      });
      resolvedUrl = uploaded.secureUrl;
    } else if (resolvedUrl) {
      resolvedUrl = resolveUploadedAvatarUrl(resolvedUrl) ?? "";
    }

    if (!resolvedUrl) {
      throw new AppError({
        message: "A real uploaded avatar image or valid image URL is required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_AVATAR",
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: resolvedUrl },
    });

    return {
      id: updated.id,
      avatarUrl: resolveUploadedAvatarUrl(updated.avatarUrl),
      message: "Profile avatar updated successfully",
    };
  }
}

export const authService = new AuthService();
