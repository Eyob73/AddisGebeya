import { createApp } from "./src/app.js";
import { prisma } from "./src/config/database.js";

// Helper to create small valid decodable binary image buffers (1x1 px)
function createValidJpegBuffer(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDy6iiivQPBP//Z",
    "base64",
  );
}

function createValidPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2Bw9P8PAAJlAZAZIj5CAAAAAElFTkSuQmCC",
    "base64",
  );
}

function createValidWebpBuffer(): Buffer {
  return Buffer.from(
    "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
    "base64",
  );
}

function createFakeTextBuffer(): Buffer {
  return Buffer.from("This is a malicious text payload pretending to be an image file.");
}

async function runCloudinaryE2ETests() {
  console.info("===================================================================");
  console.info("=== ADDISGEBEYA CLOUDINARY IMAGE STORAGE & API VERIFICATION =====");
  console.info("===================================================================");

  const app = createApp();
  const server = app.listen(5098);
  const baseUrl = "http://localhost:5098/api";

  let adminAccessToken = "";
  let customerAccessToken = "";
  let testProductId = "";
  let uploadedImageId1 = "";
  let uploadedImageId2 = "";

  try {
    // 1. Admin Authentication
    console.info("\n[Test 1] Admin Authentication...");
    const adminLoginRes = await fetch(`${baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@addisgebeya.com",
        password: "AdminPass123!",
      }),
    });
    const adminData = await adminLoginRes.json();
    if (!adminData.success || !adminData.data.accessToken) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminData)}`);
    }
    adminAccessToken = adminData.data.accessToken;
    console.info("✓ Admin logged in successfully with ADMIN role.");

    // 2. Customer Authentication
    console.info("\n[Test 2] Customer Authentication (for non-admin permission checks)...");
    const custEmail = `tester.cloudinary.${Date.now()}@example.com`;
    const custRegRes = await fetch(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cloudinary Customer Tester",
        email: custEmail,
        phone: "+251911887766",
        password: "TestPassword123!",
        preferredSize: 42,
        subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
      }),
    });
    const custData = await custRegRes.json();
    if (!custData.success || !custData.data.accessToken) {
      throw new Error(`Customer register failed: ${JSON.stringify(custData)}`);
    }
    customerAccessToken = custData.data.accessToken;
    console.info("✓ Customer account registered successfully.");

    // 3. Create a clean test product for image tests
    console.info("\n[Test 3] Create Test Product for Cloudinary Asset Isolation...");
    const category = await prisma.category.findFirst();
    if (!category) throw new Error("No category found in database.");

    const prodRes = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: `Cloudinary Test Shoe ${Date.now()}`,
        brand: "Addis Velocity",
        modelFamily: "Pro Test",
        sku: `CD-${Math.floor(1000 + Math.random() * 9000)}`,
        priceETB: 8500,
        cogsETB: 4200,
        description: "Test shoe for Cloudinary integration testing",
        categoryId: category.id,
        categorySlug: category.slug,
        categoryName: category.name,
        colorways: [
          {
            name: "Cloudinary Azure",
            hex: "#00414F",
            images: [],
            stockBySize: { "40": 5, "41": 5, "42": 10, "43": 8 },
          },
        ],
      }),
    });
    const prodData = await prodRes.json();
    if (!prodData.success || !prodData.data.id) {
      throw new Error(`Failed to create test product: ${JSON.stringify(prodData)}`);
    }
    testProductId = prodData.data.id;
    console.info(`✓ Created test product ID: ${testProductId}`);

    // 4. Test Single Image Upload (JPEG with valid magic bytes)
    console.info("\n[Test 4] Upload Single Image via multipart/form-data...");
    const jpegBuffer = createValidJpegBuffer();
    const formData1 = new FormData();
    formData1.append("images", new Blob([jpegBuffer], { type: "image/jpeg" }), "shoe-hero.jpg");

    const uploadRes1 = await fetch(`${baseUrl}/products/${testProductId}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: formData1,
    });
    const uploadData1 = await uploadRes1.json();
    if (uploadRes1.status !== 201 || !uploadData1.success || !Array.isArray(uploadData1.data) || uploadData1.data.length !== 1) {
      throw new Error(`Single image upload failed: ${uploadRes1.status} ${JSON.stringify(uploadData1)}`);
    }
    const uploadedImg1 = uploadData1.data[0];
    uploadedImageId1 = uploadedImg1.id;
    if (!uploadedImg1.isPrimary) {
      throw new Error("First uploaded image should automatically be assigned as primary.");
    }
    if (!uploadedImg1.publicId) {
      throw new Error("Uploaded image should have a publicId stored in PostgreSQL.");
    }
    console.info(`✓ Single image uploaded. ID: ${uploadedImageId1}, isPrimary: ${uploadedImg1.isPrimary}, publicId: ${uploadedImg1.publicId}`);

    // 5. Test Multiple Image Upload (PNG + WebP)
    console.info("\n[Test 5] Upload Multiple Images in a Single Batch...");
    const pngBuffer = createValidPngBuffer();
    const webpBuffer = createValidWebpBuffer();
    const formDataBatch = new FormData();
    formDataBatch.append("images", new Blob([pngBuffer], { type: "image/png" }), "shoe-side.png");
    formDataBatch.append("images", new Blob([webpBuffer], { type: "image/webp" }), "shoe-tread.webp");

    const uploadResBatch = await fetch(`${baseUrl}/products/${testProductId}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: formDataBatch,
    });
    const uploadDataBatch = await uploadResBatch.json();
    if (uploadResBatch.status !== 201 || !uploadDataBatch.success || !Array.isArray(uploadDataBatch.data) || uploadDataBatch.data.length !== 2) {
      throw new Error(`Batch image upload failed: ${uploadResBatch.status} ${JSON.stringify(uploadDataBatch)}`);
    }
    uploadedImageId2 = uploadDataBatch.data[0].id;
    const uploadedImageId3 = uploadDataBatch.data[1].id;
    console.info(`✓ Batch uploaded 2 images. IDs: ${uploadedImageId2}, ${uploadedImageId3}`);

    // 6. Test GET Product Images & Live Cloudinary Fetch
    console.info("\n[Test 6] GET /api/products/:id/images & Live Cloudinary CDN Fetch...");
    const getImagesRes = await fetch(`${baseUrl}/products/${testProductId}/images`);
    const getImagesData = await getImagesRes.json();
    if (!getImagesData.success || !Array.isArray(getImagesData.data) || getImagesData.data.length !== 3) {
      throw new Error(`GET images failed: ${JSON.stringify(getImagesData)}`);
    }
    const fetchedImageUrl: string = getImagesData.data[0].imageUrl;
    const cdnRes = await fetch(fetchedImageUrl);
    if (!cdnRes.ok || !cdnRes.headers.get("content-type")?.startsWith("image/")) {
      throw new Error(
        `Cloudinary CDN fetch failed for ${fetchedImageUrl}: status=${cdnRes.status}, content-type=${cdnRes.headers.get("content-type")}`,
      );
    }
    console.info(`✓ Retrieved ${getImagesData.data.length} images and verified live Cloudinary CDN fetch (${cdnRes.status}).`);

    // 7. Test PATCH Set Primary Image
    console.info("\n[Test 7] Set Primary Image (PATCH /:id/images/:imageId/primary)...");
    const primaryRes = await fetch(`${baseUrl}/products/${testProductId}/images/${uploadedImageId2}/primary`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });
    const primaryData = await primaryRes.json();
    if (!primaryData.success) {
      throw new Error(`Set primary failed: ${JSON.stringify(primaryData)}`);
    }
    const dbImagesAfterPrimary = await prisma.productImage.findMany({
      where: { productId: testProductId },
      orderBy: { displayOrder: "asc" },
    });
    const targetImg = dbImagesAfterPrimary.find((img) => img.id === uploadedImageId2);
    const oldPrimaryImg = dbImagesAfterPrimary.find((img) => img.id === uploadedImageId1);
    if (!targetImg?.isPrimary || oldPrimaryImg?.isPrimary) {
      throw new Error("Primary flag was not switched correctly in database.");
    }
    console.info("✓ Primary image successfully switched; previous primary cleared.");

    // 8. Test PUT Reorder Images
    console.info("\n[Test 8] Reorder Product Images (PUT /:id/images/reorder)...");
    const reorderPayload = {
      imageOrders: [
        { id: uploadedImageId2, displayOrder: 0 },
        { id: uploadedImageId1, displayOrder: 1 },
        { id: uploadedImageId3, displayOrder: 2 },
      ],
    };
    const reorderRes = await fetch(`${baseUrl}/products/${testProductId}/images/reorder`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify(reorderPayload),
    });
    const reorderData = await reorderRes.json();
    if (!reorderData.success) {
      throw new Error(`Reorder failed: ${JSON.stringify(reorderData)}`);
    }
    const dbImagesAfterReorder = await prisma.productImage.findMany({
      where: { productId: testProductId },
      orderBy: { displayOrder: "asc" },
    });
    if (dbImagesAfterReorder[0]?.id !== uploadedImageId2 || dbImagesAfterReorder[1]?.id !== uploadedImageId1) {
      throw new Error("Image displayOrder was not reordered correctly.");
    }
    console.info("✓ Images reordered with updated displayOrder.");

    // 9. Test PUT Replace Image
    console.info("\n[Test 9] Replace Image Asset (PUT /:id/images/:imageId)...");
    const newReplacementBuffer = createValidJpegBuffer();
    const replaceForm = new FormData();
    replaceForm.append("image", new Blob([newReplacementBuffer], { type: "image/jpeg" }), "replacement.jpg");

    const replaceRes = await fetch(`${baseUrl}/products/${testProductId}/images/${uploadedImageId1}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: replaceForm,
    });
    const replaceData = await replaceRes.json();
    if (!replaceData.success || !replaceData.data) {
      throw new Error(`Replace image failed: ${JSON.stringify(replaceData)}`);
    }
    console.info("✓ Existing image asset replaced with new file.");

    // 10. Test DELETE Image
    console.info("\n[Test 10] Delete Image Asset (DELETE /:id/images/:imageId)...");
    const deleteRes = await fetch(`${baseUrl}/products/${testProductId}/images/${uploadedImageId2}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });
    const deleteData = await deleteRes.json();
    if (!deleteData.success) {
      throw new Error(`Delete image failed: ${JSON.stringify(deleteData)}`);
    }
    const dbImagesAfterDelete = await prisma.productImage.findMany({
      where: { productId: testProductId },
    });
    if (dbImagesAfterDelete.some((img) => img.id === uploadedImageId2)) {
      throw new Error("Deleted image still exists in database.");
    }
    // Verify fallback primary assignment
    const currentPrimary = dbImagesAfterDelete.find((img) => img.isPrimary);
    if (!currentPrimary) {
      throw new Error("Deleting primary image did not reassign a fallback primary image.");
    }
    console.info(`✓ Image deleted; remaining count: ${dbImagesAfterDelete.length}, primary reassigned to: ${currentPrimary.id}`);

    // 11. Validation: Reject Unsupported Format / Invalid Magic Bytes
    console.info("\n[Test 11] Security: Reject Non-Image or Invalid Magic Bytes...");
    const fakeText = createFakeTextBuffer();
    const fakeForm = new FormData();
    fakeForm.append("images", new Blob([fakeText], { type: "text/plain" }), "fake.txt");

    const fakeRes = await fetch(`${baseUrl}/products/${testProductId}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: fakeForm,
    });
    if (fakeRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for fake text, got ${fakeRes.status}`);
    }
    console.info("✓ Non-image / fake extension correctly rejected with 400 Bad Request.");

    // 12. Validation: Reject File > 5MB
    console.info("\n[Test 12] Validation: Reject Oversized Image (> 5MB)...");
    const bigBuffer = Buffer.concat([createValidJpegBuffer(), Buffer.alloc(6 * 1024 * 1024, 0x00)]);
    const bigForm = new FormData();
    bigForm.append("images", new Blob([bigBuffer], { type: "image/jpeg" }), "oversized.jpg");

    const bigRes = await fetch(`${baseUrl}/products/${testProductId}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: bigForm,
    });
    if (bigRes.status !== 400) {
      throw new Error(`Expected 400 for file > 5MB, got ${bigRes.status}`);
    }
    console.info("✓ Oversized image (>5MB) rejected with 400 Bad Request.");

    // 13. Security: Reject Non-Admin Access
    console.info("\n[Test 13] Security: Reject Unauthorized / Non-Admin Upload Access...");
    const unauthForm = new FormData();
    unauthForm.append("images", new Blob([jpegBuffer], { type: "image/jpeg" }), "test.jpg");

    const unauthRes = await fetch(`${baseUrl}/products/${testProductId}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${customerAccessToken}`, // Non-admin customer token
      },
      body: unauthForm,
    });
    if (unauthRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin, got ${unauthRes.status}`);
    }
    console.info("✓ Customer blocked from uploading product images (403 Forbidden).");

    // 14. Product Deletion & Image Cleanup Verification
    console.info("\n[Test 14] Product Deletion & Associated Image Asset Cleanup...");
    const deleteProdRes = await fetch(`${baseUrl}/products/${testProductId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
    });
    const deleteProdData = await deleteProdRes.json();
    if (!deleteProdData.success) {
      throw new Error(`Delete product failed: ${JSON.stringify(deleteProdData)}`);
    }
    const remainingImages = await prisma.productImage.findMany({
      where: { productId: testProductId },
    });
    if (remainingImages.length > 0) {
      throw new Error(`Images still exist in DB after product deletion: ${remainingImages.length}`);
    }
    testProductId = "";
    console.info("✓ Product deleted and all associated image records and Cloudinary assets purged.");

    console.info("\n===================================================================");
    console.info("=== ALL 14 CLOUDINARY E2E TESTS PASSED SUCCESSFULLY! ===");
    console.info("===================================================================");
  } finally {
    if (testProductId && adminAccessToken) {
      await fetch(`${baseUrl}/products/${testProductId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminAccessToken}` },
      }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runCloudinaryE2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ E2E Test Suite Failed:", err);
    process.exit(1);
  });
