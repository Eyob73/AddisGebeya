export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AddisGebeya E-Commerce API",
    version: "1.0.0",
    description:
      "Enterprise RESTful backend API for AddisGebeya - Ethiopia's authentic footwear marketplace. Features complete authentication, catalog management, inventory tracking, cart & wishlist persistence, checkout with live pricing, Ethiopian payment gateways (Telebirr, Chapa, CBE Birr, Cash on Delivery), and administrative dashboard analytics.",
    contact: {
      name: "AddisGebeya Engineering HQ",
      email: "contact@addisgebeyashoes.et",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Primary v1 API gateway",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Standard JWT Bearer authorization header. Example: 'Bearer <token>'",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Request completed successfully" },
          data: { type: "object" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          role: { type: "string", enum: ["customer", "admin"] },
          preferredSize: { type: "integer", example: 42 },
          subCity: { type: "string", example: "Bole" },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          sku: { type: "string" },
          brand: { type: "string" },
          categorySlug: { type: "string" },
          priceETB: { type: "number", example: 5850 },
          compareAtPriceETB: { type: "number", example: 6900 },
          status: { type: "string", enum: ["active", "draft", "archived"] },
          colorways: { type: "array", items: { type: "object" } },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          orderNumber: { type: "string", example: "AG-9482" },
          customerName: { type: "string" },
          subtotalETB: { type: "number" },
          deliveryFeeETB: { type: "number" },
          discountETB: { type: "number" },
          totalETB: { type: "number" },
          paymentMethod: { type: "string", enum: ["telebirr", "cbeBirr", "chapa", "cod", "bank_transfer"] },
          paymentStatus: {
            type: "string",
            enum: ["Pending", "VerificationPending", "Paid", "Failed", "ReviewRequired", "Refunded"],
          },
          status: {
            type: "string",
            enum: ["PendingPayment", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"],
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "System health & database connectivity check",
        tags: ["System"],
        responses: {
          "200": { description: "System operational" },
        },
      },
    },
    "/auth/register": {
      post: {
        summary: "Register customer account",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "201": { description: "User registered" },
          "409": { description: "Email already exists" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Sign in with email and password",
        tags: ["Authentication"],
        responses: {
          "200": { description: "Authenticated successfully with tokens" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/refresh-token": {
      post: {
        summary: "Rotate refresh token & issue new access token",
        tags: ["Authentication"],
        responses: {
          "200": { description: "Tokens rotated" },
        },
      },
    },
    "/auth/me": {
      get: {
        summary: "Get authenticated profile and saved addresses",
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "User profile" },
        },
      },
    },
    "/products": {
      get: {
        summary: "List, filter, sort & paginate footwear models",
        tags: ["Catalog"],
        responses: {
          "200": { description: "List of shoe products" },
        },
      },
      post: {
        summary: "Create footwear model (Admin only)",
        tags: ["Catalog"],
        security: [{ bearerAuth: [] }],
        responses: {
          "201": { description: "Product created" },
        },
      },
    },
    "/products/{slug}": {
      get: {
        summary: "Get footwear details by slug or ID",
        tags: ["Catalog"],
        responses: {
          "200": { description: "Product details" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/categories": {
      get: {
        summary: "List all footwear collections and categories",
        tags: ["Catalog"],
        responses: {
          "200": { description: "Categories list" },
        },
      },
    },
    "/cart": {
      get: {
        summary: "Retrieve active shopping cart with live pricing",
        tags: ["Cart"],
        responses: {
          "200": { description: "Cart contents" },
        },
      },
    },
    "/cart/items": {
      post: {
        summary: "Add product variant to cart",
        tags: ["Cart"],
        responses: {
          "200": { description: "Item added" },
        },
      },
    },
    "/wishlist": {
      get: {
        summary: "Retrieve customer wishlist",
        tags: ["Wishlist"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Wishlist items" },
        },
      },
    },
    "/orders": {
      get: {
        summary: "List user orders (or all orders for Admin)",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Orders list" },
        },
      },
      post: {
        summary: "Place and finalize new order with stock validation",
        tags: ["Orders"],
        responses: {
          "201": { description: "Order created" },
        },
      },
    },
    "/payments/initialize": {
      post: {
        summary: "Initialize Ethiopian payment (Telebirr, Chapa, CBE Birr, COD)",
        tags: ["Payments"],
        responses: {
          "200": { description: "Payment initialized with reference" },
        },
      },
    },
    "/payment/providers": {
      get: {
        summary: "Retrieve live Ethiopian bank and mobile money providers from Cheki",
        tags: ["Payments"],
        responses: {
          "200": { description: "Supported providers and receiving account instructions" },
        },
      },
    },
    "/payment/verify": {
      post: {
        summary: "Verify customer payment transaction against bank records via Cheki API",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Transaction verified and order confirmed" },
          "409": { description: "Duplicate reference or verification already in progress" },
          "422": { description: "Verification failed or flagged for admin review" },
          "429": { description: "Rate limit exceeded" },
          "503": { description: "Verification gateway temporarily unavailable" },
        },
      },
    },
    "/payment/status/{orderId}": {
      get: {
        summary: "Retrieve live payment status and submitted receipts for an order",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Order payment status" },
        },
      },
    },
    "/payment/receipts/extract": {
      post: {
        summary: "Extract transaction reference and receipt metadata via OCR & QR preprocessing",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "OCR extraction summary for pre-submission customer confirmation" },
          "400": { description: "Invalid or missing receipt image file" },
        },
      },
    },
    "/payment/receipts": {
      post: {
        summary: "Upload or capture a payment receipt image and verify via Cheki provider API",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "201": { description: "Payment receipt submitted and verification state returned" },
          "400": { description: "Invalid or missing receipt image file" },
          "403": { description: "Order does not belong to authenticated customer" },
          "409": { description: "Duplicate transaction reference or payment already verified" },
        },
      },
    },
    "/payment/receipts/{receiptId}/verify": {
      post: {
        summary: "Retry or trigger provider API verification for an existing receipt",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Receipt verification outcome returned" },
          "409": { description: "Duplicate transaction reference" },
        },
      },
    },
    "/payment/receipts/order/{orderId}": {
      get: {
        summary: "List submitted payment receipts for an owned order",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Order payment receipts" },
        },
      },
    },
    "/payment/receipts/{receiptId}/access": {
      post: {
        summary: "Mint a short-lived signed access link for opening an original receipt in a new tab",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Time-limited signed receipt access URL" },
          "403": { description: "Forbidden" },
          "404": { description: "Receipt or stored file unavailable" },
        },
      },
    },
    "/payment/receipts/{receiptId}/file": {
      get: {
        summary: "Stream authorized payment receipt image or PDF file (Bearer or short-lived access token)",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Binary receipt image or PDF stream" },
          "403": { description: "Forbidden" },
          "404": { description: "Receipt file unavailable" },
        },
      },
    },
    "/admin/payments": {
      get: {
        summary: "List and filter payments with verification logs (Admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Paginated payment records" },
        },
      },
    },
    "/admin/payments/{paymentId}/review": {
      post: {
        summary: "Audited manual review decision for flagged/pending payment (Admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Manual review decision applied" },
        },
      },
    },
    "/admin/dashboard": {
      get: {
        summary: "Retrieve aggregate sales metrics and subcity statistics (Admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Dashboard analytics" },
        },
      },
    },
  },
};

