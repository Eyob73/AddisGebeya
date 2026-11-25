import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";

async function runE2ETests() {
  console.info("===================================================================");
  console.info("=== ADDISGEBEYA END-TO-END AUTH & SECURITY VERIFICATION SUITE  ===");
  console.info("===================================================================");

  const app = createApp();
  const server = app.listen(5099);
  const baseUrl = "http://localhost:5099/api/v1";

  const testEmail = `tester.${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";
  const newPassword = "NewPassword1234!";

  let customerAccessToken = "";
  let customerRefreshToken = "";
  let adminAccessToken = "";
  let customerId = "";
  let customerOrderId = "";

  try {
    // 1. Health & Database Connectivity Check
    console.info("\n[Test 1] Health & DB Connectivity Check...");
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    if (!health.success || health.data?.database?.status !== "connected") {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }
    console.info("✓ Health check OK. Database connected.");

    // 2. Customer Registration
    console.info("\n[Test 2] Customer Registration (Valid details)...");
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Runner",
        email: testEmail,
        phone: "+251911998877",
        password: testPassword,
        preferredSize: 43,
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
      }),
    });
    const regData = await regRes.json();
    if (regRes.status !== 201 || !regData.success || !regData.data.accessToken) {
      throw new Error(`Registration failed: ${regRes.status} ${JSON.stringify(regData)}`);
    }
    customerAccessToken = regData.data.accessToken;
    customerRefreshToken = regData.data.refreshToken;
    customerId = regData.data.user.id;
    if (regData.data.user.role !== "customer") {
      throw new Error(`Expected role 'customer', got '${regData.data.user.role}'`);
    }
    console.info(`✓ Registered customer ${regData.data.user.email} with ID ${customerId}`);

    // 3. Privilege Escalation Prevention on Register
    console.info("\n[Test 3] Privilege Escalation Prevention (Public cannot register as ADMIN)...");
    const hackerEmail = `hacker.${Date.now()}@example.com`;
    const escalateRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Hacker Attempt",
        email: hackerEmail,
        phone: "+251911000000",
        password: testPassword,
        role: "admin", // Malicious attempt to escalate role
        roleOverride: "admin",
      }),
    });
    const escalateData = await escalateRes.json();
    if (escalateData.data.user.role !== "customer") {
      throw new Error(`CRITICAL SECURITY FAILURE: User escalated to ${escalateData.data.user.role}!`);
    }
    console.info("✓ Privilege escalation blocked: assigned role is 'customer'");

    // 4. Duplicate Email Registration Prevention
    console.info("\n[Test 4] Duplicate Email Uniqueness Enforcement...");
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate User",
        email: testEmail,
        phone: "+251911998877",
        password: testPassword,
      }),
    });
    if (dupRes.status !== 409) {
      throw new Error(`Expected status 409 for duplicate email, got ${dupRes.status}`);
    }
    console.info("✓ Duplicate email correctly rejected with HTTP 409 Conflict");

    // 5. Login Credential Verification (Valid)
    console.info("\n[Test 5] Customer Login (Valid credentials)...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.success || !loginData.data.accessToken) {
      throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginData)}`);
    }
    customerAccessToken = loginData.data.accessToken;
    customerRefreshToken = loginData.data.refreshToken;
    const cookieHeader = loginRes.headers.get("set-cookie");
    console.info("✓ Login succeeded with access token. Set-Cookie present:", Boolean(cookieHeader));

    // 6. Login Credential Verification (Invalid password)
    console.info("\n[Test 6] Login Verification (Wrong password)...");
    const wrongPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "WrongPassword999!" }),
    });
    if (wrongPassRes.status !== 401) {
      throw new Error(`Expected 401 for wrong password, got ${wrongPassRes.status}`);
    }
    console.info("✓ Wrong password rejected with HTTP 401 Unauthorized");

    // 7. Login Verification (Non-existent email)
    console.info("\n[Test 7] Login Verification (Non-existent email)...");
    const noUserRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ghost.user.404@example.com", password: testPassword }),
    });
    if (noUserRes.status !== 401) {
      throw new Error(`Expected 401 for non-existent email, got ${noUserRes.status}`);
    }
    console.info("✓ Non-existent email rejected with HTTP 401 Unauthorized");

    // 8. Authenticated User Profile (GET /auth/me)
    console.info("\n[Test 8] Fetch Authenticated Profile (GET /auth/me)...");
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerAccessToken}` },
    });
    const meData = await meRes.json();
    if (meRes.status !== 200 || meData.data.email !== testEmail) {
      throw new Error(`GET /auth/me failed: ${meRes.status} ${JSON.stringify(meData)}`);
    }
    console.info(`✓ Profile retrieved: ${meData.data.name} (${meData.data.role})`);

    // 9. Profile Update (PATCH /auth/profile)
    console.info("\n[Test 9] Update Profile (PATCH /auth/profile)...");
    const updateRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerAccessToken}`,
      },
      body: JSON.stringify({ preferredSize: 45, subCity: "Yeka (CMC / Megenagna)" }),
    });
    const updateData = await updateRes.json();
    if (updateRes.status !== 200 || updateData.data.preferredSize !== 45) {
      throw new Error(`Update profile failed: ${updateRes.status} ${JSON.stringify(updateData)}`);
    }
    console.info(`✓ Profile updated: EU ${updateData.data.preferredSize}, SubCity ${updateData.data.subCity}`);

    // 10. Change Password (POST /auth/change-password)
    console.info("\n[Test 10] Change Password Flow...");
    const changePassRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerAccessToken}`,
      },
      body: JSON.stringify({ currentPassword: testPassword, newPassword }),
    });
    const changePassData = await changePassRes.json();
    if (changePassRes.status !== 200 || !changePassData.success) {
      throw new Error(`Change password failed: ${changePassRes.status} ${JSON.stringify(changePassData)}`);
    }

    // Verify login with new password succeeds and old password fails
    const oldLoginCheck = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    if (oldLoginCheck.status !== 401) {
      throw new Error("Old password still works after password change!");
    }
    const newLoginCheck = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    if (newLoginCheck.status !== 200) {
      throw new Error("New password failed to authenticate!");
    }
    const newLoginData = await newLoginCheck.json();
    customerAccessToken = newLoginData.data.accessToken;
    customerRefreshToken = newLoginData.data.refreshToken;
    console.info("✓ Password changed and verified with bcrypt.");

    // 11. Refresh Token Rotation
    console.info("\n[Test 11] Refresh Token Rotation...");
    const refreshRes = await fetch(`${baseUrl}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: customerRefreshToken }),
    });
    const refreshData = await refreshRes.json();
    if (refreshRes.status !== 200 || !refreshData.data.accessToken) {
      throw new Error(`Refresh token rotation failed: ${refreshRes.status} ${JSON.stringify(refreshData)}`);
    }
    const rotatedAccessToken = refreshData.data.accessToken;
    const rotatedRefreshToken = refreshData.data.refreshToken;
    console.info("✓ Token rotation succeeded. Received new access token & refresh token pair.");

    // 12. Token Reuse Detection
    console.info("\n[Test 12] Refresh Token Reuse Detection (Re-submitting rotated token)...");
    const reuseRes = await fetch(`${baseUrl}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: customerRefreshToken }), // Presenting the already rotated token
    });
    if (reuseRes.status !== 401) {
      throw new Error(`Expected 401 for reused refresh token, got ${reuseRes.status}`);
    }
    // Now even rotatedRefreshToken should be invalidated because reuse detected!
    const familyCheck = await fetch(`${baseUrl}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rotatedRefreshToken }),
    });
    if (familyCheck.status !== 401) {
      throw new Error("Token family was not revoked after reuse detection!");
    }
    console.info("✓ Reused refresh token detected! Entire token family revoked.");

    // Relogin customer to obtain fresh session for remaining tests
    const freshLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    const freshAuth = await freshLogin.json();
    customerAccessToken = freshAuth.data.accessToken;
    customerRefreshToken = freshAuth.data.refreshToken;

    // 13. Logout Session Revocation
    console.info("\n[Test 13] Logout Session Revocation...");
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: customerRefreshToken }),
    });
    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${logoutRes.status}`);
    }
    const revokedRefreshCheck = await fetch(`${baseUrl}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: customerRefreshToken }),
    });
    if (revokedRefreshCheck.status !== 401) {
      throw new Error("Refresh token still usable after logout!");
    }
    console.info("✓ Logout revoked refresh token in database.");

    // Relogin customer for authorization testing
    const finalCustLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    customerAccessToken = (await finalCustLogin.json()).data.accessToken;

    // Login Admin
    console.info("\n[Admin Login] Logging in store admin (admin@addisgebeya.com)...");
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@addisgebeya.com", password: "AdminPass123!" }),
    });
    const adminAuth = await adminLoginRes.json();
    adminAccessToken = adminAuth.data.accessToken;
    console.info(`✓ Admin authenticated. Role: ${adminAuth.data.user.role}`);

    // 14. Public Endpoints Access
    console.info("\n[Test 14] Public Endpoints Access (No Auth Required)...");
    const pubProdRes = await fetch(`${baseUrl}/products`);
    const pubCatRes = await fetch(`${baseUrl}/categories`);
    if (pubProdRes.status !== 200 || pubCatRes.status !== 200) {
      throw new Error("Public endpoints failed to serve unauthenticated requests");
    }
    console.info("✓ Products and Categories accessible publicly.");

    // 15. Protected Endpoints Reject Unauthenticated Access (401)
    console.info("\n[Test 15] Protected Endpoints Reject Unauthenticated Requests (401)...");
    const unauthOrdersRes = await fetch(`${baseUrl}/orders`);
    const unauthAdminRes = await fetch(`${baseUrl}/admin/dashboard`);
    if (unauthOrdersRes.status !== 401 || unauthAdminRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated requests, got ${unauthOrdersRes.status} and ${unauthAdminRes.status}`);
    }
    console.info("✓ Unauthenticated requests to protected endpoints return HTTP 401 Unauthorized.");

    // 16. Customer Access to Admin Endpoints Blocked (403 Forbidden)
    console.info("\n[Test 16] Customer Access to Admin Endpoints (403 Forbidden)...");
    const custAdminCheck = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${customerAccessToken}` },
    });
    const custCustomersCheck = await fetch(`${baseUrl}/admin/customers`, {
      headers: { Authorization: `Bearer ${customerAccessToken}` },
    });
    if (custAdminCheck.status !== 403 || custCustomersCheck.status !== 403) {
      throw new Error(`Expected 403 Forbidden for customer on admin routes, got ${custAdminCheck.status} and ${custCustomersCheck.status}`);
    }
    console.info("✓ Customer strictly blocked from Admin Dashboard and Customer Management with HTTP 403 Forbidden.");

    // 17. Admin Access to Admin Endpoints Allowed (200 OK)
    console.info("\n[Test 17] Admin Access to Admin Endpoints (200 OK)...");
    const adminDashRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const adminCustRes = await fetch(`${baseUrl}/admin/customers`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    if (adminDashRes.status !== 200 || adminCustRes.status !== 200) {
      throw new Error(`Admin failed to access admin endpoints: ${adminDashRes.status}`);
    }
    console.info("✓ Admin successfully accessed admin endpoints.");

    // 18. Customer Order Ownership Isolation
    console.info("\n[Test 18] Customer Order Ownership Isolation...");
    // Customer places an order on an in-stock colorway and size
    const prodList = (await (await fetch(`${baseUrl}/products`)).json()).data as Array<any>;
    const firstProduct =
      prodList.find((p) =>
        p.colorways?.some((cw: any) =>
          Object.values(cw.stockBySize || {}).some((qty: any) => Number(qty) >= 1),
        ),
      ) ?? prodList[0];
    const targetCw =
      firstProduct.colorways.find((cw: any) =>
        Object.values(cw.stockBySize || {}).some((qty: any) => Number(qty) >= 1),
      ) ?? firstProduct.colorways[0];
    const inStockEntry = Object.entries(targetCw.stockBySize || {}).find(
      ([, qty]) => Number(qty) >= 1,
    );
    const orderSize = inStockEntry ? Number(inStockEntry[0]) : 43;
    const placeOrderRes = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerAccessToken}`,
      },
      body: JSON.stringify({
        customerName: "Test Runner",
        customerEmail: testEmail,
        customerPhone: "+251911998877",
        city: "Addis Ababa",
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
        landmark: "Edna Mall Area",
        deliverySpeed: "vip",
        paymentMethod: "telebirr",
        paymentReference: "TB-AUTH-TEST",
        items: [
          {
            productId: firstProduct.id,
            colorwayId: targetCw.id,
            productName: firstProduct.name,
            sku: firstProduct.sku,
            colorwayName: targetCw.name,
            size: orderSize,
            quantity: 1,
            unitPriceETB: firstProduct.priceETB,
            image: targetCw.images[0],
          },
        ],
      }),
    });
    const orderJson = await placeOrderRes.json();
    customerOrderId = orderJson.data.id;
    console.info(`✓ Customer placed order #${customerOrderId}`);

    // Customer can view their own order
    const ownOrderRes = await fetch(`${baseUrl}/orders/${customerOrderId}`, {
      headers: { Authorization: `Bearer ${customerAccessToken}` },
    });
    if (ownOrderRes.status !== 200) {
      throw new Error(`Customer could not view their own order! Status: ${ownOrderRes.status}`);
    }
    console.info("✓ Customer can view their own order (200 OK).");

    // Another customer (abebe.t@gmail.com) logs in and tries to access this order
    const abebeLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "abebe.t@gmail.com", password: "CustomerPass123!" }),
    });
    const abebeToken = (await abebeLogin.json()).data.accessToken;

    const crossCustomerRes = await fetch(`${baseUrl}/orders/${customerOrderId}`, {
      headers: { Authorization: `Bearer ${abebeToken}` },
    });
    if (crossCustomerRes.status !== 403) {
      throw new Error(`CRITICAL SECURITY FAILURE: Customer could view another customer's order! Status: ${crossCustomerRes.status}`);
    }
    console.info("✓ Cross-customer order access blocked with HTTP 403 Forbidden!");

    // Admin CAN view this order
    const adminOrderRes = await fetch(`${baseUrl}/orders/${customerOrderId}`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    if (adminOrderRes.status !== 200) {
      throw new Error(`Admin could not view order: ${adminOrderRes.status}`);
    }
    console.info("✓ Admin can view customer order (200 OK).");

    // 19. Homepage Right-Side Hero Edit Access Control & Persistence
    console.info("\n[Test 19] Homepage right-side hero RBAC & persistence...");
    const initialSettingsRes = await fetch(`${baseUrl}/settings`);
    const initialSettingsJson = await initialSettingsRes.json();
    if (initialSettingsRes.status !== 200 || !initialSettingsJson.data) {
      throw new Error(`Failed to fetch initial settings: ${initialSettingsRes.status}`);
    }
    const origHero = {
      heroImageUrl: initialSettingsJson.data.heroImageUrl ?? null,
      heroBadgeText: initialSettingsJson.data.heroBadgeText,
      heroCardSubtitle: initialSettingsJson.data.heroCardSubtitle,
      heroCardTitle: initialSettingsJson.data.heroCardTitle,
      heroCardPriceText: initialSettingsJson.data.heroCardPriceText,
      heroCardHref: initialSettingsJson.data.heroCardHref,
    };

    const unauthSettingsPatch = await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heroCardTitle: "Hacked" }),
    });
    const unauthHeroUpload = await fetch(`${baseUrl}/settings/hero-image`, { method: "POST" });
    if (unauthSettingsPatch.status !== 401 || unauthHeroUpload.status !== 401) {
      throw new Error(
        `Expected 401 for unauthenticated hero edit/upload, got ${unauthSettingsPatch.status}/${unauthHeroUpload.status}`,
      );
    }

    const custSettingsPatch = await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${abebeToken}` },
      body: JSON.stringify({ heroCardTitle: "Customer Tamper" }),
    });
    const custHeroUpload = await fetch(`${baseUrl}/settings/hero-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${abebeToken}` },
    });
    if (custSettingsPatch.status !== 403 || custHeroUpload.status !== 403) {
      throw new Error(
        `Expected 403 for non-admin hero edit/upload, got ${custSettingsPatch.status}/${custHeroUpload.status}`,
      );
    }

    const unsafeUrlRes = await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
      body: JSON.stringify({ heroImageUrl: "javascript:alert(1)" }),
    });
    if (unsafeUrlRes.status !== 400) {
      throw new Error(`Expected 400 for unsafe heroImageUrl protocol, got ${unsafeUrlRes.status}`);
    }

    const nextHero = {
      heroImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      heroBadgeText: "Limited Addis Edition",
      heroCardSubtitle: "Bole Exclusive",
      heroCardTitle: "Entoto Marathon Carbon",
      heroCardPriceText: "6,400 ETB",
      heroCardHref: "/shop",
    };
    const adminHeroSaveRes = await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
      body: JSON.stringify(nextHero),
    });
    const adminHeroSaveJson = await adminHeroSaveRes.json();
    if (
      adminHeroSaveRes.status !== 200 ||
      adminHeroSaveJson.data?.heroCardTitle !== nextHero.heroCardTitle ||
      adminHeroSaveJson.data?.heroImageUrl !== nextHero.heroImageUrl
    ) {
      throw new Error(`Admin hero save failed: ${JSON.stringify(adminHeroSaveJson)}`);
    }

    const verifyHeroGetRes = await fetch(`${baseUrl}/settings`);
    const verifyHeroGetJson = await verifyHeroGetRes.json();
    if (
      verifyHeroGetJson.data?.heroBadgeText !== nextHero.heroBadgeText ||
      verifyHeroGetJson.data?.heroCardPriceText !== nextHero.heroCardPriceText
    ) {
      throw new Error(`Hero settings did not persist: ${JSON.stringify(verifyHeroGetJson)}`);
    }

    await fetch(`${baseUrl}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
      body: JSON.stringify(origHero),
    });
    console.info("✓ Homepage hero admin-only RBAC, protocol validation & persistence verified.");

    console.info("\n===================================================================");
    console.info("=== ALL 19 AUTH, RBAC & HOMEPAGE HERO SECURITY TESTS PASSED!    ===");
    console.info("===================================================================");
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runE2ETests().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
