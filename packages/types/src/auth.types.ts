export type AuthProviderName = "password" | "google";

export type GoogleOAuthIntent = "login" | "register";

export interface AuthenticatedUserDto {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  role: "customer" | "admin";
  preferredSize: number;
  subCity: string;
  avatarUrl?: string;
  hasPassword?: boolean;
  authProviders?: AuthProviderName[];
}

export interface GoogleOAuthCallbackQuery {
  status?: "success" | "error";
  provider?: "google";
  isNewUser?: string;
  linked?: string;
  from?: string;
  intent?: GoogleOAuthIntent;
  error?: string;
  message?: string;
}

export interface GoogleOAuthPublicConfig {
  enabled: boolean;
  clientId: string | null;
}

export interface GoogleOneTapAuthResponse {
  user: AuthenticatedUserDto;
  accessToken: string;
  refreshToken?: string;
  isNewUser: boolean;
  linkedExistingAccount: boolean;
}

export interface CartMergeItemDto {
  id: string;
  dbItemId: string;
  productId: string;
  productSlug: string;
  productName: string;
  categoryName: string;
  brand: string;
  colorwayId: string;
  colorwayName: string;
  colorHex: string;
  size: number;
  unitPriceETB: number;
  compareAtPriceETB?: number;
  quantity: number;
  image: string;
  badge?: string;
  maxStock: number;
}

export interface CartMergeResponse {
  id: string;
  items: CartMergeItemDto[];
  itemCount: number;
  subtotalETB: number;
  mergedCount: number;
  warnings: string[];
}

