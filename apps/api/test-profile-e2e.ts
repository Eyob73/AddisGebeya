import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";

async function runProfileVerification() {
  console.info("===================================================================");
  console.info("=== ADDISGEBEYA PROFILE & ACCOUNT MANAGEMENT TEST SUITE (17/17) ===");
  console.info("===================================================================");

  const app = createApp();
  const server = app.listen(5097);
  const baseUrl = "http://localhost:5097/api/v1";

  const originalPassword = "InitialPassword123!";
  const updatedPassword = "StrongNewPassword2026!";
  const testEmail = `profile.test.${Date.now()}@example.com`;
  const otherEmail = `existing.user.${Date.now()}@example.com`;

  let accessToken = "";
  let oldRefreshToken = "";
  let userId = "";
  let addressId = "";
  let secondAddressId = "";

  try {
    // 0. Setup: Register primary test customer and secondary user for collision tests
    console.info("\n[Setup] Registering primary test user and collision user...");
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sara Bekele",
        email: testEmail,
        phone: "+251911123456",
        password: originalPassword,
        preferredSize: 39,
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
      }),
    });
    const regJson = await regRes.json();
    if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
    accessToken = regJson.data.accessToken;
    oldRefreshToken = regJson.data.refreshToken;
    userId = regJson.data.user.id;

    // Register second user
    const regOther = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Other User",
        email: otherEmail,
        phone: "+251922000000",
        password: originalPassword,
      }),
    });
    const otherJson = await regOther.json();
    const otherToken = otherJson.data.accessToken;
    console.info(`✓ Registered primary customer (${testEmail}) and secondary user (${otherEmail})`);

    // Scenario 1: Customer views their profile (GET /auth/me)
    console.info("\n[Scenario 1] Customer views their profile...");
    const profileRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileJson = await profileRes.json();
    if (profileRes.status !== 200 || profileJson.data.email !== testEmail || !profileJson.data.name) {
      throw new Error(`Profile retrieval failed: ${JSON.stringify(profileJson)}`);
    }
    if (profileJson.data.avatarUrl !== undefined) {
      throw new Error(`Expected new user to have no default avatarUrl, got: ${profileJson.data.avatarUrl}`);
    }
    console.info(`✓ Profile retrieved (blank avatar by default): ${profileJson.data.name}, Email: ${profileJson.data.email}, Preferred Fit: EU ${profileJson.data.preferredSize}`);

    // Scenario 2: Customer updates their name
    console.info("\n[Scenario 2] Customer updates their name...");
    const updateNameRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: "Sara Bekele Assefa" }),
    });
    const updateNameJson = await updateNameRes.json();
    if (updateNameRes.status !== 200 || updateNameJson.data.name !== "Sara Bekele Assefa") {
      throw new Error(`Name update failed: ${JSON.stringify(updateNameJson)}`);
    }
    console.info(`✓ Name updated to: "${updateNameJson.data.name}"`);

    // Scenario 3: Customer updates their phone number
    console.info("\n[Scenario 3] Customer updates their phone number...");
    const updatePhoneRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ phone: "+251933778899" }),
    });
    const updatePhoneJson = await updatePhoneRes.json();
    if (updatePhoneRes.status !== 200 || updatePhoneJson.data.phone !== "+251933778899") {
      throw new Error(`Phone update failed: ${JSON.stringify(updatePhoneJson)}`);
    }
    console.info(`✓ Phone number updated to: "${updatePhoneJson.data.phone}"`);

    // Scenario 4: Customer changes their email with uniqueness validation
    console.info("\n[Scenario 4] Customer changes email with uniqueness check...");
    // 4a. Attempt to take an existing email (should fail with HTTP 409 Conflict)
    const dupEmailRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email: otherEmail }),
    });
    if (dupEmailRes.status !== 409) {
      throw new Error(`Expected 409 Conflict on duplicate email update, got ${dupEmailRes.status}`);
    }
    console.info("✓ Duplicate email collision correctly rejected with HTTP 409 Conflict.");

    // 4b. Update to a fresh valid email
    const newEmail = `sara.updated.${Date.now()}@example.com`;
    const validEmailRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email: newEmail }),
    });
    const validEmailJson = await validEmailRes.json();
    if (validEmailRes.status !== 200 || validEmailJson.data.email !== newEmail) {
      throw new Error(`Valid email update failed: ${JSON.stringify(validEmailJson)}`);
    }
    console.info(`✓ Email successfully updated to unique address: "${validEmailJson.data.email}"`);

    // Scenario 5: Customer uploads/sets a profile picture (rejects mock/generated URLs, supports removal)
    console.info("\n[Scenario 5] Customer uploads profile avatar & rejects generated/mock URLs...");
    const mockRes = await fetch(`${baseUrl}/auth/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=addis",
      }),
    });
    if (mockRes.status !== 400) {
      throw new Error(`Expected 400 INVALID_AVATAR for generated avatar URL, got ${mockRes.status}`);
    }

    const avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb";
    const avatarRes = await fetch(`${baseUrl}/auth/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ avatarUrl }),
    });
    const avatarJson = await avatarRes.json();
    if (avatarRes.status !== 200 || avatarJson.data.avatarUrl !== avatarUrl) {
      throw new Error(`Avatar upload failed: ${JSON.stringify(avatarJson)}`);
    }

    const clearRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ avatarUrl: null }),
    });
    const clearJson = await clearRes.json();
    if (clearRes.status !== 200 || clearJson.data.avatarUrl !== undefined) {
      throw new Error(`Expected cleared avatarUrl=undefined, got: ${JSON.stringify(clearJson)}`);
    }

    const reUploadRes = await fetch(`${baseUrl}/auth/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ avatarUrl }),
    });
    const reUploadJson = await reUploadRes.json();
    if (reUploadRes.status !== 200 || reUploadJson.data.avatarUrl !== avatarUrl) {
      throw new Error(`Avatar re-upload failed: ${JSON.stringify(reUploadJson)}`);
    }

    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@addisgebeya.com",
        password: "AdminPass123!",
      }),
    });
    const adminLoginJson = await adminLoginRes.json();
    if (adminLoginRes.status !== 200 || !adminLoginJson.data?.accessToken) {
      throw new Error(`Admin login failed for CRM avatar check: ${JSON.stringify(adminLoginJson)}`);
    }
    if (adminLoginJson.data?.user?.avatarUrl !== undefined) {
      throw new Error(`Expected admin user to have no mock avatarUrl, got: ${adminLoginJson.data?.user?.avatarUrl}`);
    }
    const adminCustRes = await fetch(`${baseUrl}/admin/customers`, {
      headers: { Authorization: `Bearer ${adminLoginJson.data.accessToken}` },
    });
    const adminCustJson = await adminCustRes.json();
    const customers = (adminCustJson.data ?? []) as Array<{ email: string; avatarUrl?: string }>;
    const saraRow = customers.find((c) => c.email === newEmail);
    const otherRow = customers.find((c) => c.email === otherEmail);
    if (!saraRow || saraRow.avatarUrl !== avatarUrl) {
      throw new Error(`Expected uploaded avatar on Sara in admin CRM, got: ${JSON.stringify(saraRow)}`);
    }
    if (!otherRow || otherRow.avatarUrl !== undefined) {
      throw new Error(`Expected blank avatar (undefined) for unuploaded user in admin CRM, got: ${JSON.stringify(otherRow)}`);
    }
    console.info(`✓ Profile avatar verified (rejected generated avatar, cleared cleanly, uploaded "${reUploadJson.data.avatarUrl}", admin CRM consistent)`);

    // Scenario 6: Customer changes their password
    console.info("\n[Scenario 6] Customer changes password with verification...");
    const changePassRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: originalPassword,
        newPassword: updatedPassword,
      }),
    });
    const changePassJson = await changePassRes.json();
    if (changePassRes.status !== 200 || !changePassJson.data.changed) {
      throw new Error(`Change password failed: ${JSON.stringify(changePassJson)}`);
    }
    // Update accessToken with fresh rotated token
    if (changePassJson.data.accessToken) {
      accessToken = changePassJson.data.accessToken;
    }
    console.info("✓ Password changed successfully and new tokens issued.");

    // Scenario 7: Incorrect current password is rejected
    console.info("\n[Scenario 7] Incorrect current password rejection...");
    const wrongPassRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: "CompletelyWrongPassword123!",
        newPassword: "AnotherNewPassword123!",
      }),
    });
    if (wrongPassRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for wrong current password, got ${wrongPassRes.status}`);
    }
    console.info("✓ Incorrect current password rejected with HTTP 400.");

    // Scenario 8: Invalid password requirements rejected (too short, reuse of current)
    console.info("\n[Scenario 8] Invalid password rejection (too short, reuse)...");
    const shortPassRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: updatedPassword,
        newPassword: "short",
      }),
    });
    if (shortPassRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for short password, got ${shortPassRes.status}`);
    }

    const reusePassRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: updatedPassword,
        newPassword: updatedPassword, // Reusing existing password
      }),
    });
    if (reusePassRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for password reuse, got ${reusePassRes.status}`);
    }
    console.info("✓ Short passwords and password reuse rejected with HTTP 400.");

    // Scenario 9: Customer adds a delivery address
    console.info("\n[Scenario 9] Customer adds a delivery address...");
    const addAddrRes = await fetch(`${baseUrl}/addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        label: "Home",
        fullName: "Sara Bekele Assefa",
        phoneNumber: "+251933778899",
        region: "Addis Ababa",
        city: "Addis Ababa",
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
        woreda: "Woreda 03",
        streetAddress: "Cameroon St, Near Edna Mall",
        landmark: "Next to Morning Star Mall",
        riderNotes: "Call when at the front barrier",
        isDefault: true,
      }),
    });
    const addAddrJson = await addAddrRes.json();
    if (addAddrRes.status !== 201 || !addAddrJson.data.id) {
      throw new Error(`Address creation failed: ${JSON.stringify(addAddrJson)}`);
    }
    addressId = addAddrJson.data.id;
    console.info(`✓ Added delivery address #${addressId} (${addAddrJson.data.label}: ${addAddrJson.data.streetAddress})`);

    // Scenario 10: Customer edits an address
    console.info("\n[Scenario 10] Customer edits an address...");
    const editAddrRes = await fetch(`${baseUrl}/addresses/${addressId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        label: "Residential Villa",
        landmark: "Opposite Harmony Hotel Entrance",
      }),
    });
    const editAddrJson = await editAddrRes.json();
    if (editAddrRes.status !== 200 || editAddrJson.data.label !== "Residential Villa" || editAddrJson.data.landmark !== "Opposite Harmony Hotel Entrance") {
      throw new Error(`Address edit failed: ${JSON.stringify(editAddrJson)}`);
    }
    console.info(`✓ Address updated: Label="${editAddrJson.data.label}", Landmark="${editAddrJson.data.landmark}"`);

    // Scenario 11 & 12: Customer adds second address and sets as default, then deletes first address
    console.info("\n[Scenario 11 & 12] Multiple addresses, setting default, and deleting...");
    const addSecondRes = await fetch(`${baseUrl}/addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        label: "Office",
        fullName: "Sara Bekele",
        phoneNumber: "+251933778899",
        region: "Addis Ababa",
        city: "Addis Ababa",
        subCity: "Kirkos (Kazanchis / Meskel Sq)",
        streetAddress: "Bloom Tech Tower 6th Floor",
        isDefault: false,
      }),
    });
    const secondAddrJson = await addSecondRes.json();
    secondAddressId = secondAddrJson.data.id;
    console.info(`✓ Added second address #${secondAddressId} (${secondAddrJson.data.label})`);

    // Set second address as default
    const setDefaultRes = await fetch(`${baseUrl}/addresses/${secondAddressId}/default`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const setDefaultJson = await setDefaultRes.json();
    if (setDefaultRes.status !== 200 || !setDefaultJson.data.isDefault) {
      throw new Error(`Set default failed: ${JSON.stringify(setDefaultJson)}`);
    }
    console.info(`✓ Set address #${secondAddressId} as default.`);

    // Delete the first address
    const deleteAddrRes = await fetch(`${baseUrl}/addresses/${addressId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (deleteAddrRes.status !== 200) {
      throw new Error(`Delete address failed: ${deleteAddrRes.status}`);
    }
    console.info(`✓ Address #${addressId} successfully deleted.`);

    // Scenario 13: Customer views their order history
    console.info("\n[Scenario 13] Customer views their order history...");
    // Place a sample order first using an available product, colorway, and size
    const allProds = (await (await fetch(`${baseUrl}/products`)).json()).data as Array<any>;
    const product =
      allProds.find((p) =>
        p.colorways?.some((cw: any) =>
          Object.values(cw.stockBySize || {}).some((qty: any) => Number(qty) >= 1),
        ),
      ) ?? allProds[0];
    const targetColorway =
      product.colorways.find((cw: any) =>
        Object.values(cw.stockBySize || {}).some((qty: any) => Number(qty) >= 1),
      ) ?? product.colorways[0];
    const availableEntry = Object.entries(targetColorway.stockBySize || {}).find(
      ([, qty]) => Number(qty) >= 1,
    );
    const targetSize = availableEntry ? Number(availableEntry[0]) : 39;
    const placeOrder = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        customerName: "Sara Bekele Assefa",
        customerEmail: newEmail,
        customerPhone: "+251933778899",
        city: "Addis Ababa",
        subCity: "Kirkos (Kazanchis / Meskel Sq)",
        landmark: "Bloom Tech Tower",
        paymentMethod: "telebirr",
        items: [
          {
            productId: product.id,
            colorwayId: targetColorway.id,
            productName: product.name,
            sku: product.sku,
            colorwayName: targetColorway.name,
            size: targetSize,
            quantity: 1,
            unitPriceETB: product.priceETB,
            image: targetColorway.images[0],
          },
        ],
      }),
    });
    const orderPlacedJson = await placeOrder.json();
    const orderId = orderPlacedJson.data.id;

    const listOrdersRes = await fetch(`${baseUrl}/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listOrdersJson = await listOrdersRes.json();
    if (listOrdersRes.status !== 200 || !listOrdersJson.data.some((o: any) => o.id === orderId)) {
      throw new Error("Customer orders list does not include placed order!");
    }
    console.info(`✓ Order history retrieved (${listOrdersJson.data.length} orders found, including #${orderId})`);

    // Scenario 14: Customer cannot access another customer's information
    console.info("\n[Scenario 14] Cross-customer access strictly blocked...");
    // Secondary user attempts to access Sara's order
    const crossOrderRes = await fetch(`${baseUrl}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    if (crossOrderRes.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for cross-customer access, got ${crossOrderRes.status}`);
    }

    // Secondary user attempts to delete Sara's address
    const crossAddrRes = await fetch(`${baseUrl}/addresses/${secondAddressId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    if (crossAddrRes.status !== 404 && crossAddrRes.status !== 403) {
      throw new Error(`Expected HTTP 404/403 for unauthorized address mutation, got ${crossAddrRes.status}`);
    }
    console.info("✓ Cross-customer access to orders and addresses strictly blocked with HTTP 403/404.");

    // Scenario 15: Unauthenticated users cannot access profile endpoints
    console.info("\n[Scenario 15] Unauthenticated access rejected (HTTP 401)...");
    const unauthProfileRes = await fetch(`${baseUrl}/auth/me`);
    const unauthAddressRes = await fetch(`${baseUrl}/addresses`);
    if (unauthProfileRes.status !== 401 || unauthAddressRes.status !== 401) {
      throw new Error("Unauthenticated requests were not rejected with 401!");
    }
    console.info("✓ Protected profile and address endpoints reject unauthenticated requests with HTTP 401.");

    // Scenario 16: Profile information persistence verification
    console.info("\n[Scenario 16] Profile persistence across re-login...");
    const loginFreshRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: updatedPassword }),
    });
    const loginFreshJson = await loginFreshRes.json();
    if (loginFreshRes.status !== 200) {
      throw new Error(`Re-login failed: ${JSON.stringify(loginFreshJson)}`);
    }
    const freshToken = loginFreshJson.data.accessToken;

    const verifyPersistenceRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    const freshProfile = await verifyPersistenceRes.json();
    if (
      freshProfile.data.name !== "Sara Bekele Assefa" ||
      freshProfile.data.email !== newEmail ||
      freshProfile.data.phone !== "+251933778899"
    ) {
      throw new Error(`Profile persistence check failed: ${JSON.stringify(freshProfile)}`);
    }
    console.info("✓ Profile changes verified persistent in PostgreSQL across full login cycle.");

    // Scenario 17: Password changes invalidate old refresh tokens
    console.info("\n[Scenario 17] Session invalidation verification (old refresh token revoked)...");
    const reuseOldTokenRes = await fetch(`${baseUrl}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    });
    if (reuseOldTokenRes.status !== 401) {
      throw new Error(`Expected HTTP 401 on revoked refresh token, got ${reuseOldTokenRes.status}`);
    }
    console.info("✓ Pre-password-change refresh token is completely revoked (HTTP 401).");

    console.info("\n===================================================================");
    console.info("=== ALL 17 PROFILE & ACCOUNT MANAGEMENT SCENARIOS PASSED (100%) ===");
    console.info("===================================================================");
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runProfileVerification().catch((err) => {
  console.error("Profile Verification Suite Failed:", err);
  process.exit(1);
});

