import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";
import { ensurePaymentProviderConfigsSeeded } from "../src/modules/payments/payment-providers.seed.js";

const prisma = new PrismaClient();

const EU_SIZES = [38, 39, 40, 41, 42, 43, 44, 45, 46];

const CATEGORIES_DATA = [
  {
    id: "cat-men",
    slug: "men",
    name: "Men's Shoes",
    eyebrow: "Performance & Everyday",
    subtitle: "Engineered for strength, architectural balance & movement.",
    description:
      "Explore our complete men's collection spanning marathon runners, court sneakers, Chelsea boots, and handcrafted Ethiopian leather dress shoes.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB_s3s-EA_cV7VbPIE1xS7kjWRQbaBlrUv3OtYZAyvV1yY-k8Ynm_h3e9RO74Q8IHlvmtbDbT3UH7VFINTevPRAHdLav7rYiodx6t80022AR0sm8eLiE4Ob9HIPjsDReMZfIEjSMeILGzUEPj-Tb6K1_kncoNlhsGHEOXIdljjBOGKNasngtDsmeQFabJbohThuIZXTM12IdkbT6k9Ra0qvsAePMJVg-XDzN3JneQ",
    isFeatured: true,
    isActive: true,
    displayOrder: 1,
  },
  {
    id: "cat-women",
    slug: "women",
    name: "Women's Shoes",
    eyebrow: "Form Meets Function",
    subtitle: "Elegance meets responsive everyday agility and soft support.",
    description:
      "Refined silhouettes tailored for Bole boulevards, morning runs, and effortless daily rotation.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAZpx4N8hBzX7B61rUtbPipBRKy_VuYg43L-dHvFsXq5Vb3NPaXPF6sY8IblNBJyaO25UEqRS2SLa7-NVKokrtPLO-zZSDrA1kfOTnGFItwJWBMCwAYkeRQOSJYHdZCz6zCb0fiKvhc_geNqYnhQedynq92-vFsw8jZdo7_aIESHfPiHjzDUWlbGQvM8zyzEvwFywEX7oiGSXsqlwQECgf9GMSYYdYPmwUZoz0T0A",
    isFeatured: true,
    isActive: true,
    displayOrder: 2,
  },
  {
    id: "cat-sneakers",
    slug: "sneakers",
    name: "Sneakers & Streetwear",
    eyebrow: "Archive & Drops",
    subtitle: "Culture, collector silhouettes, and high-energy city rotation.",
    description:
      "Limited-batch lifestyle sneakers, vintage court silhouettes, and bold color-blocked streetwear drops.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD4krED_tvwadITZ1lSxd4IdFwThqwttRM0QIhMGyFz9BQ9UtHqrnuI1s9p2Si_pyV4n5IiTT6epghDaPrBtb2JaFBTkjKXCKQjYTWnLygz-JWhq4ZsRqd9EQEF_I9w0Zd6GobO_e2yBJuNy_EHARQWyyEqkn9NvBJVih6Pef5dyM0ILzWUvCBzzoiPDFdzM6PcBjoA8YOoz55rIMrLWNNkuc0_wn_G5KERLGsS5w",
    isFeatured: true,
    isActive: true,
    displayOrder: 3,
  },
  {
    id: "cat-running",
    slug: "running",
    name: "Running & Performance",
    eyebrow: "Highland Tested",
    subtitle: "Marathon-tested carbon and responsive nitrogen foam plates.",
    description:
      "Built for Addis Ababa's 2,400m altitude and Entoto hill training with supercritical nitrogen foam and carbon propulsion.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAAo13WPgUQLPP8YIk69nILCUWVOS-QTGBUzet1XRFWLXy13rVuhwVoe8w2PI8sbMHn05j5s0JfrogoGvU7OmqW0YZugRBVBrL4NDl1YFOUjnqASf6wGv3URZis5YABGKg6o5wmL-sTh0zZSvissG_pMVr13Q2q6VshNmnCrasb1XT8CbI-Y23gq_SKrWVVkddgGcYP5KKBQjDKpltYz8FLWKavDfPQdRgnluOuMg",
    isFeatured: true,
    isActive: true,
    displayOrder: 4,
  },
  {
    id: "cat-casual",
    slug: "casual-loafers",
    name: "Casual Loafers",
    eyebrow: "Effortless Poise",
    subtitle: "Refined daily comfort designed for relaxed lounge and transit.",
    description:
      "Handcrafted suede loafers, slip-on sneakers, and recovery slides built for 12-hour Addis comfort.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAwmjWKPOyN5wN2RYANprnNfGGbZTjWfwMaFni85o5oahT_zeR3zvlhN1Di-Gdkm17aqkpTTFXwVGX8J0-ycb0cGUqQkNShWd9t8Rwd2xmJrA_O1Oo7VLjVri5A6Qo5h7KivhGfPCIPXWjzEe4fF58UH8SrFzYFo7cIsA1l-JnfIAOW0qnkP9pUImy17a1nyqjCOnR8QoI4mep_3nyzOTaYTfNUIEe4-cC8p2yb6Q",
    isFeatured: true,
    isActive: true,
    displayOrder: 5,
  },
  {
    id: "cat-formal",
    slug: "formal-leather",
    name: "Formal Leather",
    eyebrow: "Artisan Welted",
    subtitle: "Handcrafted executive dress pairs made with full-grain hides.",
    description:
      "Goodyear-welted Oxfords, Derbies, and suede Chelsea boots crafted with Ethiopian full-grain cowhide.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBMhVdRZgE10tnFPvdqSXScsUsAoNMqUU7kCrMwKCABc8Kt7Ki1YbBA6jpLUqRUfhBqVcTUItqpPlC4dBcau9YF6uhYlsznu416EwolQr0WQnLzQr_j-QdYF-naZlHI2wcP511UcFh2_5VBbV6sde4SJTpSlt_TS8dbEK8uOLPa3wIQw2wCW2eQZ1hCJJM-9sWYaKD3ZR6uS6f35txFO4h9e5uaOLafRE8Wsoj7Ig",
    isFeatured: true,
    isActive: true,
    displayOrder: 6,
  },
  {
    id: "cat-boots",
    slug: "boots",
    name: "Boots & Trail",
    eyebrow: "All-Terrain",
    subtitle: "Weatherproof suede boots and rugged Entoto trail footwear.",
    description:
      "Designed for rainy Kiremt weather, highland gravel, and refined evening styling.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAIrILeJFbPxGgX5PhbtBc72Ap4OvlGEN0pZ0_O8F59gN3p45WWSJUrmqZB-Zw_ehiKXOoI023hjO3s2Zj-UNt6clX7U7ds7C4VKWRS6VeOSG-t-0_-6wae2D1WM0zu-pibLq-pr1myxyXoSQabwO437ag-TvXXFgvsvkvZuc_5WgverW6vgv-bL2Unmy7Zo8NoehiKiaH_0XWyxYSFhbiZozz_eisahfzphUyYPw",
    isFeatured: false,
    isActive: true,
    displayOrder: 7,
  },
  {
    id: "cat-sandals",
    slug: "sandals",
    name: "Sandals & Slides",
    eyebrow: "Recovery Comfort",
    subtitle: "Anatomical molded recovery slides for post-run relief.",
    description: "Everyday contoured slides with anti-slip outsoles and soft arch cushioning.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDUJSY62HOs4GQzbjJSJVAxOS_ZlCBOSnvjMGjQfc0_MqXtUgtfNz63TKYZxOlWap3Wh0k54z5m0Wuxje8l3hi9uyTt9pAxXh23lJFrdMiPZwT_WfLdgJjZcHD9e01n5jFLDCBcjHZlyZXbG_OfvfE3kj2XoYE0adOWJJgTlQvLD23lwLl3snmy_uNEokQ-A0S45KUOcdVUUDMiv1LS9k0nCq7GBO07LrtukO-DrA",
    isFeatured: false,
    isActive: true,
    displayOrder: 8,
  },
  {
    id: "cat-court",
    slug: "court",
    name: "Court & Tennis",
    eyebrow: "Low Profile Agility",
    subtitle: "Precision clay and hard-court grip engineered for quick lateral cuts.",
    description:
      "Reinforced toe drag protection and non-marking herringbone outsoles for Addis tennis and squash courts.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBBDvIcAZs_SRRtPiH1MTJRm7HXiR9aow2XQVgq_GK43lmFyFsLh48W6FBI2uLDbV8_vX3lotwSbJwD9V3kJvSpRhqvyBJynwcnHR5JDRyamqloVAvI8ZiDnDIkCLk2ulNAHDeGVSF6VfcmvxWsYlcbGeSQGJlNwJ7hdQ90fgTwKOH75nhLFRTxf20nic-MgCU2qWXsbYkt9T-KjzthnyDsgV0RHF82CxIsEZespA",
    isFeatured: true,
    isActive: true,
    displayOrder: 9,
  },
  {
    id: "cat-ethiopian-leather",
    slug: "ethiopian-leather",
    name: "Artisan Ethiopian Leather",
    eyebrow: "Locally Sourced Hides",
    subtitle: "Century-old tanning heritage crafted by Addis leather artisans.",
    description:
      "Vegetable-tanned Ethiopian highland sheepskin and cowhide crafted into heirloom footwear.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAwmjWKPOyN5wN2RYANprnNfGGbZTjWfwMaFni85o5oahT_zeR3zvlhN1Di-Gdkm17aqkpTTFXwVGX8J0-ycb0cGUqQkNShWd9t8Rwd2xmJrA_O1Oo7VLjVri5A6Qo5h7KivhGfPCIPXWjzEe4fF58UH8SrFzYFo7cIsA1l-JnfIAOW0qnkP9pUImy17a1nyqjCOnR8QoI4mep_3nyzOTaYTfNUIEe4-cC8p2yb6Q",
    isFeatured: true,
    isActive: true,
    displayOrder: 10,
  },
];

async function seedDatabase(): Promise<void> {
  console.info("[seed] Starting AddisGebeya database seed...");

  // 1. Store Settings
  console.info("[seed] Seeding store settings...");
  await prisma.storeSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "AddisGebeya Footwear",
      tagline: "Engineered for Addis Ababa. Built for Ethiopia.",
      showroomAddress: "Bole, Addis Ababa, Ethiopia",
      phone: "+251 911 234 567",
      whatsapp: "+251 911 234 567",
      telegramHandle: "@AddisGebeyaHQ",
      email: "contact@addisgebeyashoes.et",
      showroomHours: "Mon - Sat: 8:30 AM - 8:00 PM | Sun: 10:00 AM - 6:00 PM",
      freeDeliveryThresholdETB: 0,
      standardAddisDeliveryFeeETB: 0,
      vipTwoHourDeliveryFeeETB: 450,
      regionalCargoFeeETB: 650,
      vatPercent: 15,
      paymentMethods: {
        telebirr: true,
        cbeBirr: true,
        bankTransfer: true,
        cod: true,
      },
      announcementBarText:
        "🎉 Free Addis Ababa Delivery on All Footwear Orders • Same-Day Dispatch",
      dispatchRibbonText: "Real-time showroom inventory • Bole Central Hub Dispatch",
    },
  });

  // 2. Users & Addresses
  console.info("[seed] Seeding users and roles...");
  const adminPasswordHash = await hashPassword("AdminPass123!");
  const customerPasswordHash = await hashPassword("CustomerPass123!");

  await prisma.user.upsert({
    where: { email: "admin@addisgebeya.com" },
    update: { role: Role.ADMIN },
    create: {
      fullName: "Admin AddisGebeya",
      email: "admin@addisgebeya.com",
      phoneNumber: "+251 911 234 567",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      preferredSize: 42,
      subCity: "Bole Medhanialem HQ",
    },
  });

  await prisma.user.upsert({
    where: { email: "kidus@addisgebeyashoes.et" },
    update: { role: Role.ADMIN },
    create: {
      fullName: "Kidus Assefa",
      email: "kidus@addisgebeyashoes.et",
      phoneNumber: "+251 911 234 567",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      preferredSize: 42,
      subCity: "Bole Medhanialem HQ",
    },
  });

  const customersData = [
    {
      fullName: "Abebe Tadesse",
      email: "abebe.t@gmail.com",
      phoneNumber: "+251 911 234 567",
      subCity: "Bole (Rwanda / Edna / Japan / Atlas)",
      landmark: "Near Edna Mall, Atlas Hotel Street",
      preferredSize: 42,
    },
    {
      fullName: "Selamawit Bekele",
      email: "selam.b@gmail.com",
      phoneNumber: "+251 922 334 455",
      subCity: "Kirkos (Kazanchis / Meskel Flower)",
      landmark: "Opposite Intercontinental Hotel",
      preferredSize: 39,
    },
    {
      fullName: "Dawit Haile",
      email: "dawit.h@gmail.com",
      phoneNumber: "+251 933 445 566",
      subCity: "Yeka (Megenagna / Signal)",
      landmark: "Behind Marathon Building",
      preferredSize: 43,
    },
    {
      fullName: "Meron Yohannes",
      email: "meron.y@gmail.com",
      phoneNumber: "+251 944 556 677",
      subCity: "Lideta (Mexico / Balcha)",
      landmark: "Near Mexico Square, Genete Hotel area",
      preferredSize: 40,
    },
    {
      fullName: "Eyob Mekonnen",
      email: "eyob.m@gmail.com",
      phoneNumber: "+251 955 667 788",
      subCity: "Nifas Silk-Lafto (Bisrate Gabriel)",
      landmark: "Near Laphto Mall",
      preferredSize: 44,
    },
  ];

  const seededCustomers = [];
  for (const c of customersData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        fullName: c.fullName,
        email: c.email,
        phoneNumber: c.phoneNumber,
        passwordHash: customerPasswordHash,
        role: Role.CUSTOMER,
        preferredSize: c.preferredSize,
        subCity: c.subCity,
      },
    });

    // Create default address
    await prisma.address.deleteMany({ where: { userId: user.id } });
    await prisma.address.create({
      data: {
        userId: user.id,
        fullName: c.fullName,
        phoneNumber: c.phoneNumber,
        region: "Addis Ababa",
        city: "Addis Ababa",
        subCity: c.subCity,
        landmark: c.landmark,
        isDefault: true,
      },
    });

    seededCustomers.push(user);
  }

  // 3. Categories
  console.info("[seed] Seeding categories...");
  for (const cat of CATEGORIES_DATA) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        eyebrow: cat.eyebrow,
        subtitle: cat.subtitle,
        description: cat.description,
        imageUrl: cat.imageUrl,
        isFeatured: cat.isFeatured,
        isActive: cat.isActive,
        displayOrder: cat.displayOrder,
      },
      create: cat,
    });
  }

  // 4. Products & Variants (50+ Products total)
  console.info("[seed] Seeding products, colorways, and size variants...");

  // Flagship products from mock-footwear.ts
  const FLAGSHIP_PRODUCTS = [
    {
      id: "prod-velocity-nitro",
      slug: "addis-velocity-pro-nitro",
      sku: "AG-VN2-ETH-402",
      name: "Addis Velocity Pro Nitro 2.0",
      brand: "Addis Performance Lab",
      categorySlug: "running",
      gender: "Unisex",
      tagline: "Carbon-fiber plate & ultra-responsive supercritical nitrogen foam",
      description:
        "Conceived in Addis Ababa and calibrated for the grueling gradients of Mount Entoto, the Addis Velocity Pro Nitro 2.0 redefines daily performance running. Our proprietary NitroPro foam utilizes supercritical nitrogen injection to deliver an explosive 84% energy return.",
      priceETB: 5850,
      compareAtPriceETB: 6900,
      cogsETB: 2450,
      rating: 4.9,
      reviewCount: 142,
      badges: ["Nitro Drop 02", "-15%"],
      featuredTrending: true,
      featuredNewDrop: true,
      isOnSale: true,
      specs: {
        upperMesh: "Jacquard Air-Flow",
        cushioning: "NitroPro Foam v2",
        outsoleGrip: "Entoto Road Grip",
        weightGrams: 238,
        heelDropMm: 8,
        fitAdvice: "Fits true to size. Order your regular running shoe size.",
        materials: [
          "78% Recycled Poly Yarn",
          "Jacquard Breathable Mesh",
          "Nitrogen-infused EVA Foam",
          "Entoto Rubber Lugs",
        ],
      },
      colorways: [
        {
          name: "Highland Forest Teal / Sunset Clay",
          hex: "#0E5A6B",
          secondaryHex: "#B13A0A",
          soleHex: "#F7F7F4",
          images: [
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAnX2Ac09Qjbv2Q6v87-MUoBmOkIOWFc23JeLu4nVp53yHvWTT4dUCtpqV9M-PYpv-Y6JjDy67sXay4HwAsbCqXvfISYR20LotiQmX-ttGjZt4oGkzcWMx3bJUFYOxIp4YzBs63IOfgUSIIzzVUwZhwmq1C36lANxk0IcWdnASse1Pt6VwUbvVce0UGbGGJ52gVso8-loWMNNPAEjC97ci5RY8--BjzYiRJ4sDBrg",
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBvtyOvNLbjsOqDDy27m6NVTEfZejNus0VORcRNaKAdbiMoSvLgvshfA-G6Q6_DRWz5ZWmma045O8zaYns8_XlnaXab4sRTZbczcNv7PbL90IkV7YcX7HMxl_IrYAgv50zyDkOw8Lw375FVScDhqgl6NRlMa8UHu6Ip0E52_xg9oSCpUczOyz6zN9queZvVHQ1AV_B7s0ckQOoDVFyUzJrkEmaPHGvFTk0dDqGQog",
          ],
        },
        {
          name: "Entoto Obsidian Night / Volt Glow",
          hex: "#11202B",
          secondaryHex: "#00B4D8",
          soleHex: "#1E293B",
          images: [
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAha9Y6qDVYGNz0BnxRDt30-qv4sLWxyw6payqHBTAF83BIJn4CrJdAsEJYN8-npgc3XyJYIuXl4g9OzDfh_yUSLxcrgXXrjAlsmaCee8ATO_997w5KejonYS1x2cB5Tt0UqlcBKCUjD2tNqmiQChZmv6tkBiTvBRQl25hNBlNi53IL3Kgq3mfzT1siKeqFZA5GdsTdHtzgtjqlPGSMnF8x6Dq6BCoQgt6kmSs__w",
          ],
        },
      ],
    },
    {
      id: "prod-velocity-hybrid",
      slug: "velocity-one-hybrid",
      sku: "AG-RUN-01",
      name: "Velocity One Hybrid",
      brand: "Velocity Series",
      categorySlug: "running",
      gender: "Unisex",
      tagline: "Multi-layered breathable mesh with aerodynamic air bubble cushion",
      description:
        "Built for daily road miles and city commutes, Velocity One Hybrid combines responsive air-bubble cushioning with deep teal reflective branding and an agile heel bevel.",
      priceETB: 4650,
      compareAtPriceETB: 5400,
      cogsETB: 2100,
      rating: 4.9,
      reviewCount: 142,
      badges: ["Best Seller", "-14%"],
      featuredTrending: true,
      featuredNewDrop: false,
      isOnSale: true,
      specs: {
        upperMesh: "Aerodynamic Mesh",
        cushioning: "Cushioned Air Bubble Midsole",
        outsoleGrip: "High-traction rubber",
        weightGrams: 275,
        heelDropMm: 9,
        fitAdvice: "True to size.",
        materials: ["Mesh", "Phylon Midsole", "Rubber Outsole"],
      },
      colorways: [
        {
          name: "Teal Forest / Cyber Yellow",
          hex: "#0E5A6B",
          secondaryHex: "#FACC15",
          images: [
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAnX2Ac09Qjbv2Q6v87-MUoBmOkIOWFc23JeLu4nVp53yHvWTT4dUCtpqV9M-PYpv-Y6JjDy67sXay4HwAsbCqXvfISYR20LotiQmX-ttGjZt4oGkzcWMx3bJUFYOxIp4YzBs63IOfgUSIIzzVUwZhwmq1C36lANxk0IcWdnASse1Pt6VwUbvVce0UGbGGJ52gVso8-loWMNNPAEjC97ci5RY8--BjzYiRJ4sDBrg",
          ],
        },
      ],
    },
    {
      id: "prod-bole-court",
      slug: "bole-court-vintage-sneaker",
      sku: "AG-CRT-ETH-108",
      name: "Bole Court Vintage Sneaker",
      brand: "Bole Heritage Series",
      categorySlug: "sneakers",
      gender: "Unisex",
      tagline: "1980s Addis court silhouette with tumbled Ethiopian cowhide",
      description:
        "Paying homage to Addis Ababa's mid-century tennis and badminton clubs, the Bole Court Vintage combines butter-soft Ethiopian full-grain calf leather with vintage gum soles.",
      priceETB: 4200,
      compareAtPriceETB: 4800,
      cogsETB: 1800,
      rating: 4.8,
      reviewCount: 96,
      badges: ["Heritage Classic", "Sale -12%"],
      featuredTrending: true,
      featuredNewDrop: false,
      isOnSale: true,
      specs: {
        upperMesh: "Tumbled Ethiopian Cowhide",
        cushioning: "Dual-Density Molded Insole",
        outsoleGrip: "Herringbone Gum Rubber",
        weightGrams: 310,
        heelDropMm: 6,
        fitAdvice: "True to size.",
        materials: ["Full-grain leather", "Natural gum rubber"],
      },
      colorways: [
        {
          name: "Chalk White / Burnt Orange",
          hex: "#FFFFFF",
          secondaryHex: "#C25E00",
          images: [
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBBDvIcAZs_SRRtPiH1MTJRm7HXiR9aow2XQVgq_GK43lmFyFsLh48W6FBI2uLDbV8_vX3lotwSbJwD9V3kJvSpRhqvyBJynwcnHR5JDRyamqloVAvI8ZiDnDIkCLk2ulNAHDeGVSF6VfcmvxWsYlcbGeSQGJlNwJ7hdQ90fgTwKOH75nhLFRTxf20nic-MgCU2qWXsbYkt9T-KjzthnyDsgV0RHF82CxIsEZespA",
          ],
        },
      ],
    },
    {
      id: "prod-entoto-trail",
      slug: "entoto-apex-trail-runner",
      sku: "AG-TRL-ETH-301",
      name: "Entoto Apex Trail Runner",
      brand: "Addis Performance Lab",
      categorySlug: "boots",
      gender: "Men",
      tagline: "Vibram Megagrip lugs and puncture-resistant rock plate",
      description:
        "Tackle the steep eucalyptus forest single-tracks of Mount Entoto. Features deep 5mm multi-directional lugs, quick-lace water-repellent shroud, and ultra-high energy return midsoles.",
      priceETB: 6400,
      compareAtPriceETB: 7200,
      cogsETB: 2900,
      rating: 4.95,
      reviewCount: 68,
      badges: ["Trail Tested", "Weatherproof"],
      featuredTrending: true,
      featuredNewDrop: true,
      isOnSale: false,
      specs: {
        upperMesh: "Ripstop Cordura",
        cushioning: "High-rebound EVA",
        outsoleGrip: "5mm Aggressive Lugs",
        weightGrams: 295,
        heelDropMm: 10,
        fitAdvice: "True to size.",
        materials: ["Cordura", "Reinforced TPU", "High-traction rubber"],
      },
      colorways: [
        {
          name: "Highland Pine / Terracotta",
          hex: "#2D5A27",
          secondaryHex: "#CC4E2A",
          images: [
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAIrILeJFbPxGgX5PhbtBc72Ap4OvlGEN0pZ0_O8F59gN3p45WWSJUrmqZB-Zw_ehiKXOoI023hjO3s2Zj-UNt6clX7U7ds7C4VKWRS6VeOSG-t-0_-6wae2D1WM0zu-pibLq-pr1myxyXoSQabwO437ag-TvXXFgvsvkvZuc_5WgverW6vgv-bL2Unmy7Zo8NoehiKiaH_0XWyxYSFhbiZozz_eisahfzphUyYPw",
          ],
        },
      ],
    },
    {
      id: "prod-chelsea-boot",
      slug: "addis-artisan-suede-chelsea",
      sku: "AG-CHL-ETH-205",
      name: "Addis Artisan Suede Chelsea Boot",
      brand: "Addis Atelier Leather",
      categorySlug: "boots",
      gender: "Men",
      tagline: "Hand-burnished Ethiopian oiled suede with elastic side gusset",
      description:
        "Masterfully assembled in Addis Ababa using local oiled split-suede leather. Built with reinforced pull tabs, leather storm welting, and non-slip commando micro-stud outsoles.",
      priceETB: 5200,
      compareAtPriceETB: 5800,
      cogsETB: 2300,
      rating: 4.85,
      reviewCount: 84,
      badges: ["Artisan Made", "Top Rated"],
      featuredTrending: false,
      featuredNewDrop: false,
      isOnSale: false,
      specs: {
        upperMesh: "Oiled Ethiopian Split Suede",
        cushioning: "Poron Comfort Foam",
        outsoleGrip: "Commando Micro-stud",
        weightGrams: 420,
        heelDropMm: 14,
        fitAdvice: "Order 1 size down for snug dress fit.",
        materials: ["Ethiopian Suede", "Calfskin Lining", "Durable Rubber"],
      },
      colorways: [
        {
          name: "Espresso Roast Brown",
          hex: "#3B2219",
          secondaryHex: "#1C100C",
          images: [
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBMhVdRZgE10tnFPvdqSXScsUsAoNMqUU7kCrMwKCABc8Kt7Ki1YbBA6jpLUqRUfhBqVcTUItqpPlC4dBcau9YF6uhYlsznu416EwolQr0WQnLzQr_j-QdYF-naZlHI2wcP511UcFh2_5VBbV6sde4SJTpSlt_TS8dbEK8uOLPa3wIQw2wCW2eQZ1hCJJM-9sWYaKD3ZR6uS6f35txFO4h9e5uaOLafRE8Wsoj7Ig",
          ],
        },
      ],
    },
    {
      id: "prod-recovery-slide",
      slug: "addis-hypercloud-recovery-slide",
      sku: "AG-SLD-ETH-090",
      name: "Addis HyperCloud Recovery Slide",
      brand: "Addis Performance Lab",
      categorySlug: "sandals",
      gender: "Unisex",
      tagline: "Bio-EVA contoured footbed for post-marathon foot restoration",
      description:
        "Engineered for the intense lactic recovery phase following highland distance runs. Deep heel cup, high longitudinal arch support, and water-channeling flex grooves.",
      priceETB: 1850,
      compareAtPriceETB: 2200,
      cogsETB: 650,
      rating: 4.75,
      reviewCount: 52,
      badges: ["Rest & Recovery", "Addis Best Value"],
      featuredTrending: false,
      featuredNewDrop: false,
      isOnSale: true,
      specs: {
        upperMesh: "One-piece molded Bio-EVA",
        cushioning: "HyperCloud Zero-Drop Footbed",
        outsoleGrip: "Anti-slip flex tread",
        weightGrams: 160,
        heelDropMm: 0,
        fitAdvice: "True to size.",
        materials: ["100% Closed-cell Bio-EVA"],
      },
      colorways: [
        {
          name: "Chalk Bone / Basalt",
          hex: "#E5E0D8",
          secondaryHex: "#333333",
          images: [
            "https://lh3.googleusercontent.com/aida-public/AB6AXuDUJSY62HOs4GQzbjJSJVAxOS_ZlCBOSnvjMGjQfc0_MqXtUgtfNz63TKYZxOlWap3Wh0k54z5m0Wuxje8l3hi9uyTt9pAxXh23lJFrdMiPZwT_WfLdgJjZcHD9e01n5jFLDCBcjHZlyZXbG_OfvfE3kj2XoYE0adOWJJgTlQvLD23lwLl3snmy_uNEokQ-A0S45KUOcdVUUDMiv1LS9k0nCq7GBO07LrtukO-DrA",
          ],
        },
      ],
    },
  ];

  // Helper generator to synthesize the remaining 46 products across categories
  const categoriesList = CATEGORIES_DATA;
  const brandList = [
    "Addis Performance Lab",
    "Bole Heritage Series",
    "Entoto Highland Gear",
    "Addis Atelier Leather",
    "Sheger Urban Running",
    "Rift Valley Athletics",
  ];

  const syntheticProducts = [];
  let productCounter = 100;

  for (let i = 0; i < 46; i++) {
    productCounter++;
    const cat = categoriesList[i % categoriesList.length]!;
    const brand = brandList[i % brandList.length]!;
    const gender = i % 3 === 0 ? "Men" : i % 3 === 1 ? "Women" : "Unisex";
    const price = Math.round((2800 + (i * 135) % 4500) / 50) * 50;
    const comparePrice = i % 2 === 0 ? price + 600 : null;
    const isTrending = i % 4 === 0;
    const isNew = i % 3 === 0;
    const onSale = Boolean(comparePrice);

    const nameOptions = [
      `Addis ${cat.name.replace(/ Shoes| & Streetwear| & Performance| Loafers| Leather| & Trail| & Slides| & Tennis/, "")} Pro ${productCounter}`,
      `Highland Runner ${productCounter} Edition`,
      `Bole Boulevard Stride ${productCounter}`,
      `Entoto Ascent Sport ${productCounter}`,
      `Meskel Heritage Sneaker ${productCounter}`,
      `Awash River Swift ${productCounter}`,
    ];
    const name = nameOptions[i % nameOptions.length]!;
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${productCounter}`;
    const sku = `AG-${cat.slug.slice(0, 3).toUpperCase()}-${productCounter}`;

    syntheticProducts.push({
      id: `prod-synth-${productCounter}`,
      slug,
      sku,
      name,
      brand,
      categorySlug: cat.slug,
      gender,
      tagline: `Premium craftsmanship engineered for urban mobility and all-day comfort`,
      description: `Designed in Addis Ababa with focus on durability, breathable ergonomics, and high-traction performance across city streets and highland paths.`,
      priceETB: price,
      compareAtPriceETB: comparePrice,
      cogsETB: Math.round(price * 0.42),
      rating: Number((4.3 + ((i * 7) % 7) / 10).toFixed(1)),
      reviewCount: 15 + ((i * 13) % 95),
      badges: onSale ? ["Sale"] : isNew ? ["New Drop"] : ["Trending"],
      featuredTrending: isTrending,
      featuredNewDrop: isNew,
      isOnSale: onSale,
      specs: {
        upperMesh: "Breathable Highland Mesh & Leather",
        cushioning: "Responsive EVA Dynamic Midsole",
        outsoleGrip: "Addis Anti-slip Traction Lugs",
        weightGrams: 260 + (i % 8) * 15,
        heelDropMm: 8,
        fitAdvice: "True to standard European sizing.",
        materials: ["Recycled Knit", "Ethically Sourced Ethiopian Hide", "Durable Rubber"],
      },
      colorways: [
        {
          name: i % 2 === 0 ? "Addis Midnight / Crimson" : "Highland Cream / Forest Emerald",
          hex: i % 2 === 0 ? "#1A1A24" : "#E8E5DD",
          secondaryHex: i % 2 === 0 ? "#E63946" : "#2D6A4F",
          images: [cat.imageUrl],
        },
      ],
    });
  }

  const allProductsToSeed = [...FLAGSHIP_PRODUCTS, ...syntheticProducts];
  console.info(`[seed] Total products to seed: ${allProductsToSeed.length}`);

  for (const p of allProductsToSeed) {
    const category = await prisma.category.findUnique({ where: { slug: p.categorySlug } });
    if (!category) continue;

    const inferredType =
      p.categorySlug === "running"
        ? "Running"
        : p.categorySlug === "formal-leather" || p.categorySlug === "ethiopian-leather"
          ? "Formal"
          : p.categorySlug === "casual-loafers"
            ? "Casual"
            : p.categorySlug === "boots"
              ? "Boots"
              : p.categorySlug === "sandals"
                ? "Sandals"
                : p.categorySlug === "court"
                  ? "Sports"
                  : "Sneakers";
    const inferredMaterial = Array.isArray(p.specs?.materials) ? p.specs.materials.join(", ") : null;

    const createdProduct = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        categoryId: category.id,
        gender: p.gender,
        shoeType: inferredType,
        material: inferredMaterial,
        tagline: p.tagline,
        description: p.description,
        priceETB: p.priceETB,
        compareAtPriceETB: p.compareAtPriceETB,
        cogsETB: p.cogsETB,
        rating: p.rating,
        reviewCount: p.reviewCount,
        badges: p.badges,
        featuredTrending: p.featuredTrending,
        featuredNewDrop: p.featuredNewDrop,
        isOnSale: p.isOnSale,
        specs: p.specs,
      },
      create: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        brand: p.brand,
        categoryId: category.id,
        gender: p.gender,
        shoeType: inferredType,
        material: inferredMaterial,
        tagline: p.tagline,
        description: p.description,
        priceETB: p.priceETB,
        compareAtPriceETB: p.compareAtPriceETB,
        cogsETB: p.cogsETB,
        rating: p.rating,
        reviewCount: p.reviewCount,
        badges: p.badges,
        featuredTrending: p.featuredTrending,
        featuredNewDrop: p.featuredNewDrop,
        isOnSale: p.isOnSale,
        specs: p.specs,
      },
    });

    // Colorways and Variants
    for (const [cwIdx, cw] of p.colorways.entries()) {
      let colorway = await prisma.productColorway.findFirst({
        where: { productId: createdProduct.id, name: cw.name },
      });

      if (!colorway) {
        colorway = await prisma.productColorway.create({
          data: {
            productId: createdProduct.id,
            name: cw.name,
            hex: cw.hex,
            secondaryHex: cw.secondaryHex ?? null,
            soleHex: cw.soleHex ?? null,
            images: cw.images,
          },
        });
      }

      // Add product images with Cloudinary publicId and primary flag
      for (const [imgIdx, imgUrl] of cw.images.entries()) {
        const isPrimary = cwIdx === 0 && imgIdx === 0;
        const publicId = `addisgebeya/products/${createdProduct.slug}-${cw.id || cwIdx}-${imgIdx}`;
        const existingImg = await prisma.productImage.findFirst({
          where: { productId: createdProduct.id, imageUrl: imgUrl },
        });
        if (!existingImg) {
          await prisma.productImage.create({
            data: {
              productId: createdProduct.id,
              imageUrl: imgUrl,
              publicId,
              isPrimary,
              altText: `${p.name} - ${cw.name}`,
              displayOrder: cwIdx * 10 + imgIdx,
            },
          });
        } else {
          await prisma.productImage.update({
            where: { id: existingImg.id },
            data: {
              publicId: existingImg.publicId || publicId,
              isPrimary: existingImg.isPrimary || isPrimary,
            },
          });
        }
      }

      // Size variants
      for (const size of EU_SIZES) {
        const stock = 4 + ((p.name.length * 3 + size * 7) % 18);
        await prisma.productVariant.upsert({
          where: {
            colorwayId_size: {
              colorwayId: colorway.id,
              size,
            },
          },
          update: {
            stockQuantity: stock,
          },
          create: {
            productId: createdProduct.id,
            colorwayId: colorway.id,
            size,
            sku: `${p.sku}-${size}`,
            stockQuantity: stock,
            lowStockThreshold: 3,
          },
        });
      }
    }
  }

  // 5. Coupons
  console.info("[seed] Seeding coupons...");
  const COUPONS = [
    {
      code: "ADDISRUN",
      discountType: "percent",
      discountValue: 10,
      minimumOrderAmount: 5000,
      description: "10% off on all performance marathon running shoes",
      isActive: true,
    },
    {
      code: "WELCOME10",
      discountType: "percent",
      discountValue: 10,
      minimumOrderAmount: 3000,
      description: "10% off for first-time Addis runners",
      isActive: true,
    },
    {
      code: "BOLEVIP",
      discountType: "fixed",
      discountValue: 500,
      minimumOrderAmount: 4000,
      description: "500 ETB instant discount for Bole VIP members",
      isActive: true,
    },
    {
      code: "FAST500",
      discountType: "fixed",
      discountValue: 500,
      minimumOrderAmount: 6000,
      description: "500 ETB off express orders over 6,000 ETB",
      isActive: true,
    },
  ];

  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
  }

  // 6. Community Reviews
  console.info("[seed] Seeding verified community reviews...");
  const reviewsData = [
    {
      authorName: "Kassahun Bekele",
      authorInitials: "KB",
      location: "Addis Ababa (Bole)",
      purchasedSize: 42,
      rating: 5,
      title: "Best marathon carbon shoe tested on Entoto hills",
      comment:
        "The supercritical nitrogen foam gives insane energy return on the downhill segments towards Jan Meda. Zero knee pain even after 25km. Delivery took only 90 minutes to Bole!",
      dateLabel: "2 days ago",
      verified: true,
      helpfulCount: 24,
    },
    {
      authorName: "Tigist Assefa",
      authorInitials: "TA",
      location: "Addis Ababa (Kazanchis)",
      purchasedSize: 39,
      rating: 5,
      title: "Flawless fit and elegant leather finishing",
      comment:
        "The leather quality is distinctly Ethiopian—soft, durable, and smells authentic. I wear them daily to the office and get compliments constantly.",
      dateLabel: "1 week ago",
      verified: true,
      helpfulCount: 18,
    },
    {
      authorName: "Yared Girma",
      authorInitials: "YG",
      location: "Addis Ababa (Bisrate Gabriel)",
      purchasedSize: 44,
      rating: 4,
      title: "Highland grip is second to none",
      comment:
        "Muddy trails after the rain can be slippery, but the rubber lugs held up with firm grip on rocky terrain. Very pleased with the build quality.",
      dateLabel: "2 weeks ago",
      verified: true,
      helpfulCount: 11,
    },
  ];

  const firstProduct = await prisma.product.findFirst({
    where: { slug: "addis-velocity-pro-nitro" },
  });

  if (firstProduct) {
    for (const r of reviewsData) {
      await prisma.review.create({
        data: {
          productId: firstProduct.id,
          authorName: r.authorName,
          authorInitials: r.authorInitials,
          location: r.location,
          purchasedSize: r.purchasedSize,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          dateLabel: r.dateLabel,
          verified: r.verified,
          helpfulCount: r.helpfulCount,
        },
      });
    }
  }

  // 7. Initial Orders and Tracking
  console.info("[seed] Seeding initial customer orders...");
  const orderProduct = firstProduct ?? (await prisma.product.findFirst());
  if (orderProduct && seededCustomers[0]) {
    const customer = seededCustomers[0];
    const customerAddress = await prisma.address.findFirst({ where: { userId: customer.id } });

    const orderNumber = "AG-9482";
    const existingOrder = await prisma.order.findUnique({ where: { orderNumber } });

    if (!existingOrder) {
      const order = await prisma.order.create({
        data: {
          orderNumber,
          userId: customer.id,
          addressId: customerAddress?.id,
          customerName: customer.fullName,
          customerEmail: customer.email,
          customerPhone: customer.phoneNumber ?? "+251911234567",
          city: "Addis Ababa",
          subCity: customer.subCity ?? "Bole",
          landmark: "Near Edna Mall",
          riderNotes: "Call when you reach the gate.",
          deliverySpeed: "vip",
          deliveryFeeETB: 450,
          subtotalETB: 5850,
          discountETB: 585,
          promoCode: "ADDISRUN",
          totalETB: 5715,
          paymentMethod: "telebirr",
          paymentStatus: "verified",
          paymentReference: "TB-982314-ETH",
          status: "out_for_delivery",
          courierName: "Bole Rapid Dispatch - Rider Daniel",
          waybill: "WB-ETH-2026-9482",
          trackingEvents: [
            {
              step: "Order Confirmed",
              description: "Order placed and payment verified via Telebirr.",
              timestamp: "2026-11-23 09:30 AM",
              completed: true,
            },
            {
              step: "Packed & Quality Inspected",
              description: "Pairs inspected at Bole Medhanialem Central Hub.",
              timestamp: "2026-11-23 10:15 AM",
              completed: true,
            },
            {
              step: "Out for 2-Hour VIP Delivery",
              description: "Rider Daniel is en route with your shoe pair.",
              timestamp: "2026-11-23 11:00 AM",
              completed: true,
              current: true,
            },
            {
              step: "Delivered",
              description: "Recipient signs and verifies sizing.",
              timestamp: "Pending arrival",
              completed: false,
            },
          ],
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: orderProduct.id,
          productName: orderProduct.name,
          sku: orderProduct.sku,
          colorwayName: "Highland Forest Teal / Sunset Clay",
          size: 42,
          quantity: 1,
          unitPriceETB: orderProduct.priceETB,
          totalPriceETB: orderProduct.priceETB,
          image:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAnX2Ac09Qjbv2Q6v87-MUoBmOkIOWFc23JeLu4nVp53yHvWTT4dUCtpqV9M-PYpv-Y6JjDy67sXay4HwAsbCqXvfISYR20LotiQmX-ttGjZt4oGkzcWMx3bJUFYOxIp4YzBs63IOfgUSIIzzVUwZhwmq1C36lANxk0IcWdnASse1Pt6VwUbvVce0UGbGGJ52gVso8-loWMNNPAEjC97ci5RY8--BjzYiRJ4sDBrg",
        },
      });

      await prisma.payment.create({
        data: {
          orderId: order.id,
          transactionReference: "TB-982314-ETH",
          paymentMethod: "telebirr",
          amount: 5715,
          paymentStatus: "verified",
          paidAt: new Date(),
        },
      });
    }
  }

  // 8. Payment Slips
  console.info("[seed] Seeding verified payment slips...");
  const SLIPS = [
    {
      reference: "TB-982314-ETH",
      provider: "Telebirr",
      amountETB: 5715,
      senderName: "Abebe Tadesse",
      senderInfo: "251911234567 (Telebirr App)",
    },
    {
      reference: "CBE-883104-92",
      provider: "CBE Birr",
      amountETB: 4200,
      senderName: "Selamawit Bekele",
      senderInfo: "1000293847291 (Commercial Bank of Ethiopia)",
    },
    {
      reference: "AW-449102-ET",
      provider: "Awash Bank",
      amountETB: 6400,
      senderName: "Dawit Haile",
      senderInfo: "01320491823900 (Awash Online)",
    },
  ];

  for (const slip of SLIPS) {
    await prisma.paymentSlip.upsert({
      where: { reference: slip.reference },
      update: {},
      create: slip,
    });
  }

  console.info("[seed] Seeding Cheki payment provider receiving accounts...");
  await ensurePaymentProviderConfigsSeeded();

  console.info("[seed] Database seed completed successfully!");
}

seedDatabase()
  .catch((error: unknown) => {
    console.error("[seed] Seed script error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
