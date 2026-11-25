import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";

async function runComprehensiveFlow() {
  console.info("===================================================================");
  console.info("=== ADDISGEBEYA FULL-STACK INTEGRATION & FLOW VERIFICATION      ===");
  console.info("===================================================================");

  const app = createApp();
  const server = app.listen(5098);
  const baseUrl = "http://localhost:5098/api/v1";

  const customerEmail = `shopper.${Date.now()}@example.com`;
  const customerPassword = "Password123!";
  let customerToken = "";
  let adminToken = "";
  let sampleProduct: any = null;
  let testOrderId = "";

  try {
    // Step 1: Health & OpenAPI Documentation
    console.info("\n[1] Checking OpenAPI Documentation endpoints...");
    const openApiRes = await fetch(`${baseUrl}/docs.json`);
    if (openApiRes.status !== 200) {
      throw new Error(`OpenAPI JSON failed: status ${openApiRes.status}`);
    }
    const openApiJson = await openApiRes.json();
    if (!openApiJson.openapi || !openApiJson.paths["/products"]) {
      throw new Error("OpenAPI specification incomplete!");
    }
    console.info(`✓ OpenAPI 3.0 specification available at /api/v1/docs.json (Title: ${openApiJson.info.title})`);

    // Step 2: Product & Category Catalog Queries
    console.info("\n[2] Verifying Category & Product Catalog Queries...");
    const catRes = await fetch(`${baseUrl}/categories`);
    const catData = await catRes.json();
    if (!catData.success || catData.data.length < 5) {
      throw new Error(`Expected at least 5 categories, got ${catData.data?.length}`);
    }
    console.info(`✓ Retrieved ${catData.data.length} categories from PostgreSQL database.`);

    const prodRes = await fetch(`${baseUrl}/products?categorySlug=running`);
    const prodData = await prodRes.json();
    if (!prodData.success || prodData.data.length === 0) {
      throw new Error("No running products returned!");
    }
    sampleProduct =
      prodData.data.find((p: any) =>
        p.colorways.some((cw: any) =>
          Object.values(cw.stockBySize).some((qty: any) => Number(qty) >= 2),
        ),
      ) ?? prodData.data[0];
    console.info(`✓ Retrieved ${prodData.data.length} running shoe models. Sample: ${sampleProduct.name} (${sampleProduct.sku})`);

    // Step 3: Customer Registration & Auth
    console.info("\n[3] Customer Registration & Profile Verification...");
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bethlehem Tadesse",
        email: customerEmail,
        phone: "+251922114477",
        password: customerPassword,
        preferredSize: 39,
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
      }),
    });
    const regData = await regRes.json();
    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${regRes.status}`);
    }
    customerToken = regData.data.accessToken;
    console.info(`✓ Customer registered: ${regData.data.user.name} (${regData.data.user.email})`);

    // Step 4: Admin Authentication
    console.info("\n[4] Admin Authentication...");
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@addisgebeya.com",
        password: "AdminPass123!",
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    if (adminLoginRes.status !== 200 || adminLoginData.data.user.role !== "admin") {
      throw new Error("Admin login failed!");
    }
    adminToken = adminLoginData.data.accessToken;
    console.info("✓ Admin logged in successfully with ADMIN role.");

    // Step 5: Persistent Wishlist Management
    console.info("\n[5] Testing Customer Wishlist Persistence...");
    const wishToggleRes = await fetch(`${baseUrl}/wishlist/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ productId: sampleProduct.id }),
    });
    const wishToggleData = await wishToggleRes.json();
    if (!wishToggleData.success || !wishToggleData.data.productIds.includes(sampleProduct.id)) {
      throw new Error("Wishlist toggle add failed!");
    }
    console.info(`✓ Added product ${sampleProduct.name} to persistent wishlist.`);

    const wishGetRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const wishGetData = await wishGetRes.json();
    if (!wishGetData.data.productIds.includes(sampleProduct.id)) {
      throw new Error("Wishlist retrieval did not include added item!");
    }
    console.info("✓ Wishlist retrieved with persisted item from database.");

    // Step 6: Persistent Shopping Cart Management
    console.info("\n[6] Testing Persistent Shopping Cart API...");
    const targetColorway =
      sampleProduct.colorways.find((cw: any) =>
        Object.values(cw.stockBySize).some((qty: any) => Number(qty) >= 2),
      ) ?? sampleProduct.colorways[0];
    const inStockEntry = Object.entries(targetColorway.stockBySize).find(
      ([_, qty]) => Number(qty) >= 2,
    );
    const targetSize = inStockEntry ? Number(inStockEntry[0]) : 42;

    const cartAddRes = await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: sampleProduct.id,
        colorwayId: targetColorway.id,
        size: targetSize,
        quantity: 2,
      }),
    });
    const cartAddData = await cartAddRes.json();
    if (cartAddRes.status !== 201 || !cartAddData.success) {
      throw new Error(`Cart add failed: ${JSON.stringify(cartAddData)}`);
    }
    console.info(`✓ Added 2 pairs of ${sampleProduct.name} (EU ${targetSize}) to cart. Subtotal: ${cartAddData.data.subtotalETB} ETB.`);

    // Step 7: Coupon Validation
    console.info("\n[7] Testing Coupon Validation with ADDISRUN...");
    const couponRes = await fetch(`${baseUrl}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "ADDISRUN",
        subtotalETB: cartAddData.data.subtotalETB,
      }),
    });
    const couponData = await couponRes.json();
    if (couponRes.status !== 200 || !couponData.data.ok) {
      throw new Error(`Coupon validation failed: ${JSON.stringify(couponData)}`);
    }
    console.info(`✓ Validated coupon ADDISRUN: ${couponData.data.value}% discount applied, discount amount: ${couponData.data.discountETB} ETB.`);

    // Step 8: Order Placement & Inventory Stock Decrement Transaction
    console.info("\n[8] Placing Order with Transactional Inventory Decrement...");
    const initialVariant = await prisma.productVariant.findFirst({
      where: { productId: sampleProduct.id, colorwayId: targetColorway.id, size: targetSize },
    });
    const initialStock = initialVariant?.stockQuantity ?? 10;

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        customerName: "Bethlehem Tadesse",
        customerEmail: customerEmail,
        customerPhone: "+251922114477",
        city: "Addis Ababa",
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
        landmark: "Near Morning Star Mall",
        deliverySpeed: "vip",
        paymentMethod: "telebirr",
        promoCode: "ADDISRUN",
        items: [
          {
            productId: sampleProduct.id,
            productName: sampleProduct.name,
            sku: sampleProduct.sku,
            colorwayName: targetColorway.name,
            size: targetSize,
            quantity: 2,
            unitPriceETB: sampleProduct.priceETB,
            image: targetColorway.images[0],
          },
        ],
      }),
    });
    const orderData = await orderRes.json();
    if (orderRes.status !== 201 || !orderData.success) {
      throw new Error(`Order placement failed: ${JSON.stringify(orderData)}`);
    }
    testOrderId = orderData.data.id;
    console.info(`✓ Placed order #${testOrderId}. Subtotal: ${orderData.data.subtotalETB} ETB, Discount: ${orderData.data.discountETB} ETB, Total: ${orderData.data.totalETB} ETB.`);

    // Verify stock decreased by 2
    const updatedVariant = await prisma.productVariant.findFirst({
      where: { productId: sampleProduct.id, colorwayId: targetColorway.id, size: targetSize },
    });
    const updatedStock = updatedVariant?.stockQuantity ?? 0;
    if (updatedStock !== initialStock - 2) {
      throw new Error(`Stock mismatch: initial was ${initialStock}, expected ${initialStock - 2}, got ${updatedStock}`);
    }
    console.info(`✓ Inventory atomicity verified: Stock decreased from ${initialStock} to ${updatedStock}.`);

    // Step 9: Ethiopian Payment Gateway Integration (Telebirr & CBE Birr)
    console.info("\n[9] Initializing Payment Gateway (Telebirr & CBE Birr)...");
    const payRes = await fetch(`${baseUrl}/payments/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        orderIdOrNumber: testOrderId,
        paymentMethod: "telebirr",
        phone: "+251922114477",
      }),
    });
    const payData = await payRes.json();
    if (payRes.status !== 200 || !payData.data.transactionReference.startsWith("TB-")) {
      throw new Error(`Payment initialization failed: ${JSON.stringify(payData)}`);
    }
    console.info(`✓ Payment initialized. Reference: ${payData.data.transactionReference}, Instructions: ${payData.data.instructions}`);

    // Step 10: Customer Delivery Address Management
    console.info("\n[10] Testing Customer Delivery Address CRUD...");
    const addrCreateRes = await fetch(`${baseUrl}/addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        fullName: "Bethlehem Tadesse (Office)",
        phoneNumber: "+251922114477",
        region: "Addis Ababa",
        city: "Addis Ababa",
        subCity: "Kirkos (Kazanchis / Meskel Sq)",
        streetAddress: "Bloom Tech Tower 5th Floor",
        isDefault: true,
      }),
    });
    const addrCreateData = await addrCreateRes.json();
    if (addrCreateRes.status !== 201) {
      throw new Error(`Address creation failed: ${JSON.stringify(addrCreateData)}`);
    }
    console.info(`✓ Created delivery address: ${addrCreateData.data.fullName} in ${addrCreateData.data.subCity}`);

    const addrListRes = await fetch(`${baseUrl}/addresses`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const addrListData = await addrListRes.json();
    if (addrListData.data.length === 0) {
      throw new Error("Address list is empty!");
    }
    console.info(`✓ Retrieved ${addrListData.data.length} saved customer delivery address(es).`);

    // Step 11: Admin Dashboard & Reports Integration
    console.info("\n[11] Testing Admin Dashboard Real Database Aggregations...");
    const dashRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dashData = await dashRes.json();
    if (dashRes.status !== 200 || !dashData.data.metrics) {
      throw new Error(`Admin dashboard query failed: ${JSON.stringify(dashData)}`);
    }
    const metrics = dashData.data.metrics;
    console.info(`✓ Admin Dashboard Metrics: Total Orders=${metrics.totalOrders}, Revenue=${metrics.totalRevenueETB} ETB, Products=${metrics.productsCount}, Active Customers=${metrics.activeCustomers}`);

    console.info("\n===================================================================");
    console.info("=== FULL-STACK FLOW VERIFICATION COMPLETED SUCCESSFULLY (100%)  ===");
    console.info("===================================================================");
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runComprehensiveFlow().catch((err) => {
  console.error("Comprehensive Flow Failed:", err);
  process.exit(1);
});
