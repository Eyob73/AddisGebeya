import { prisma } from "../../config/database.js";

export interface DefaultProviderSeedItem {
  providerCode: string;
  displayName: string;
  receivingAccountName: string;
  receivingAccountNumber: string;
  accountSuffixDigits?: number | null;
  instructions: string;
  isEnabled: boolean;
  maxPaymentAgeDays: number;
}

export const DEFAULT_PAYMENT_PROVIDER_CONFIGS: DefaultProviderSeedItem[] = [
  {
    providerCode: "cbe",
    displayName: "Commercial Bank of Ethiopia (CBE)",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "1000234890123",
    accountSuffixDigits: 8,
    instructions:
      "Transfer exact ETB order total to Commercial Bank of Ethiopia account 1000234890123 and submit your mbreciept link, Receipt ID, or FT reference.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "telebirr",
    displayName: "Telebirr",
    receivingAccountName: "AddisGebeya Footwear Trading",
    receivingAccountNumber: "251911234567",
    accountSuffixDigits: null,
    instructions:
      "Send exact ETB total via Telebirr SuperApp to merchant number and enter the Telebirr Transaction Number or receipt QR.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "boa",
    displayName: "Bank of Abyssinia (BOA)",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "148290315",
    accountSuffixDigits: 5,
    instructions:
      "Transfer exact ETB total to Bank of Abyssinia account 148290315 and provide your BOA slip reference or inter-bank receipt QR.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "dashen",
    displayName: "Dashen Bank",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "5029183746101",
    accountSuffixDigits: null,
    instructions:
      "Complete payment to Dashen Bank account 5029183746101 and submit your FT Ref or receipt QR payload.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "awash",
    displayName: "Awash Bank",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "01320491823900",
    accountSuffixDigits: null,
    instructions:
      "Send your transfer to Awash Bank account 01320491823900 and paste the Awash receipt share link from your SMS.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "cbebirr",
    displayName: "CBE Birr",
    receivingAccountName: "AddisGebeya Footwear Trading",
    receivingAccountNumber: "251911234567",
    accountSuffixDigits: null,
    instructions:
      "Pay exact ETB amount via CBE Birr wallet and enter the Receipt Number plus payer phone number (or CBE Birr receipt QR).",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "mpesa",
    displayName: "M-Pesa Ethiopia",
    receivingAccountName: "AddisGebeya Footwear Trading",
    receivingAccountNumber: "251711234567",
    accountSuffixDigits: null,
    instructions:
      "Complete your M-Pesa Ethiopia transfer and enter the transaction number from your confirmation SMS.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "siinqee",
    displayName: "Siinqee Bank",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "102938475612",
    accountSuffixDigits: null,
    instructions:
      "Transfer exact ETB amount to Siinqee Bank account 102938475612 and submit your receipt link or reference.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "wegagen",
    displayName: "Wegagen Bank",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "0849102938401",
    accountSuffixDigits: null,
    instructions:
      "Send transfer to Wegagen Bank account 0849102938401 and enter the 24-character share ID, share link, or receipt QR.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "bunna",
    displayName: "Bunna Bank",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "210948102938",
    accountSuffixDigits: null,
    instructions:
      "Transfer exact ETB amount to Bunna Bank account 210948102938 and enter the receipt link or receipt QR payload.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "zamzam",
    displayName: "ZamZam Bank",
    receivingAccountName: "AddisGebeya Footwear Trading PLC",
    receivingAccountNumber: "0019283746501",
    accountSuffixDigits: null,
    instructions:
      "Transfer to ZamZam Bank account 0019283746501 and submit the ZamZam receipt ID or receipt link.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
  {
    providerCode: "ebirr",
    displayName: "eBirr",
    receivingAccountName: "AddisGebeya Footwear Trading",
    receivingAccountNumber: "251911234567",
    accountSuffixDigits: null,
    instructions:
      "Pay via eBirr mobile wallet and paste your receipt.ebirr.com receipt link.",
    isEnabled: true,
    maxPaymentAgeDays: 30,
  },
];

let seededPromise: Promise<void> | null = null;

export async function ensurePaymentProviderConfigsSeeded(): Promise<void> {
  if (!seededPromise) {
    seededPromise = (async () => {
      for (const cfg of DEFAULT_PAYMENT_PROVIDER_CONFIGS) {
        await prisma.paymentProviderConfig.upsert({
          where: { providerCode: cfg.providerCode },
          update: {},
          create: cfg,
        });
      }
    })().catch((err) => {
      seededPromise = null;
      throw err;
    });
  }
  await seededPromise;
}

