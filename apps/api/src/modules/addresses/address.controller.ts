import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { AppError } from "../../utils/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { addressService } from "./address.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

export const addressController = {
  listAddresses: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const addresses = await addressService.listUserAddresses(req.user.id);
    sendSuccess(res, addresses, "Addresses retrieved successfully");
  }),

  createAddress: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const created = await addressService.createAddress(req.user.id, req.body);
    sendSuccess(res, created, "Address created successfully", 201);
  }),

  getAddressById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const addressId = strParam(req.params.id);
    const address = await addressService.getAddressById(req.user.id, addressId);
    sendSuccess(res, address, "Address retrieved successfully");
  }),

  updateAddress: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const addressId = strParam(req.params.id);
    const updated = await addressService.updateAddress(req.user.id, addressId, req.body);
    sendSuccess(res, updated, "Address updated successfully");
  }),

  deleteAddress: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const addressId = strParam(req.params.id);
    const result = await addressService.deleteAddress(req.user.id, addressId);
    sendSuccess(res, result, "Address deleted successfully");
  }),

  setDefaultAddress: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const addressId = strParam(req.params.id);
    const updated = await addressService.setDefaultAddress(req.user.id, addressId);
    sendSuccess(res, updated, "Default address set successfully");
  }),
};

