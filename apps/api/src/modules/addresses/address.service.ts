import { HTTP_STATUS } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

export interface AddressInput {
  label?: string;
  fullName: string;
  phoneNumber: string;
  region?: string;
  city?: string;
  subCity: string;
  woreda?: string;
  streetAddress?: string;
  landmark?: string;
  riderNotes?: string;
  isDefault?: boolean;
}

export class AddressService {
  async listUserAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAddress(userId: string, input: AddressInput) {
    if (!input.fullName || !input.phoneNumber || !input.subCity) {
      throw new AppError({
        message: "Full name, phone number, and sub-city are required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_ADDRESS_INPUT",
      });
    }

    // If marked default or first address, unset previous defaults
    const existingCount = await prisma.address.count({ where: { userId } });
    const shouldBeDefault = input.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: {
        userId,
        label: input.label?.trim() || "Home",
        fullName: input.fullName.trim(),
        phoneNumber: input.phoneNumber.trim(),
        region: input.region ?? "Addis Ababa",
        city: input.city ?? "Addis Ababa",
        subCity: input.subCity.trim(),
        woreda: input.woreda?.trim() || null,
        streetAddress: input.streetAddress?.trim() || null,
        landmark: input.landmark?.trim() || null,
        riderNotes: input.riderNotes?.trim() || null,
        isDefault: shouldBeDefault,
      },
    });
  }

  async getAddressById(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new AppError({
        message: "Address not found or unauthorized",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ADDRESS_NOT_FOUND",
      });
    }

    return address;
  }

  async updateAddress(userId: string, addressId: string, input: Partial<AddressInput>) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new AppError({
        message: "Address not found or unauthorized",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ADDRESS_NOT_FOUND",
      });
    }

    if (input.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id: addressId },
      data: {
        label: input.label?.trim() ?? undefined,
        fullName: input.fullName?.trim() ?? undefined,
        phoneNumber: input.phoneNumber?.trim() ?? undefined,
        region: input.region ?? undefined,
        city: input.city ?? undefined,
        subCity: input.subCity?.trim() ?? undefined,
        woreda: input.woreda?.trim() ?? undefined,
        streetAddress: input.streetAddress?.trim() ?? undefined,
        landmark: input.landmark?.trim() ?? undefined,
        riderNotes: input.riderNotes?.trim() ?? undefined,
        isDefault: input.isDefault ?? undefined,
      },
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new AppError({
        message: "Address not found or unauthorized",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ADDRESS_NOT_FOUND",
      });
    }

    await prisma.address.delete({ where: { id: addressId } });

    // If deleted address was default, promote the newest address
    if (address.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { deleted: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new AppError({
        message: "Address not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ADDRESS_NOT_FOUND",
      });
    }

    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    return prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }
}

export const addressService = new AddressService();

