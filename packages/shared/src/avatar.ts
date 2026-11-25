const REMOVED_MOCK_AVATAR_URLS = new Set<string>([
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBGgKfx7gvIOMlhfx7c-LUX97DM5dw2SO7Jfg9YHpOPrRooilyqvPbgZ859FX64hawTM3DEq-eYb_2VfiHsmFwVcL0YsVoV9CT28UE00YyzMp19wX9agJJQx2pU0IuVZZICXuT8RYGcOnRKipYsCIV5AM1Z1w0C6Wfz4bpHUQ0oxh53JbbKbCFvsrHC06rvDvaf0PTF1b2WhhniCb-MqHSRCDLVEr2YSU01ay_q7g",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC1vnvgC5s_9b8714Tj2VBzF95ZfWVg-Dka2EHynypN0CGBSomZ5r0YZAF-3m4J4tsBQN5IMPerpAPxoVvMF2pGR8pKbtDRhWD4S8fOCb0t1LwtO2XDxcq8-gbyNNwJlVshaxAnHFxYwhtEvMnWDVV8S2dg2O_YPh3Nnm5uFM-sSbMjrJSfy16hRitUBSnEgIZmumWYZE2m8JRd2o3odiuo09ZWMylK0h0koF4i8A",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
]);

const GENERATED_AVATAR_HOST_PATTERNS = [
  /(^|\.)dicebear\.com$/i,
  /(^|\.)pravatar\.cc$/i,
  /(^|\.)ui-avatars\.com$/i,
  /(^|\.)robohash\.org$/i,
  /(^|\.)multiavatar\.com$/i,
  /(^|\.)boringavatars\.com$/i,
  /^avatar\.iran\.liara\.run$/i,
];

/**
 * Returns a sanitized avatar URL only when it represents an actual user-uploaded
 * profile image, filtering out removed mock/default/preset/generated avatars.
 */
export function resolveUploadedAvatarUrl(rawUrl?: string | null): string | undefined {
  if (typeof rawUrl !== "string") return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (REMOVED_MOCK_AVATAR_URLS.has(trimmed)) return undefined;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();

    if (GENERATED_AVATAR_HOST_PATTERNS.some((re) => re.test(host))) {
      return undefined;
    }
    if (host.endsWith("gravatar.com") && pathLower.includes("/avatar")) {
      return undefined;
    }
    if (
      pathLower.includes("default-avatar") ||
      pathLower.includes("placeholder-avatar") ||
      pathLower.includes("mock-avatar")
    ) {
      return undefined;
    }
  } catch {
    if (
      trimmed.startsWith("/") &&
      (trimmed.toLowerCase().includes("default-avatar") ||
        trimmed.toLowerCase().includes("placeholder-avatar"))
    ) {
      return undefined;
    }
  }

  return trimmed;
}

/**
 * Extracts uppercase initials from a full name:
 * first name + last name initial ("Abebe Bikila" -> "AB"),
 * or single name initial ("Abebe" -> "A").
 */
export function getUserInitials(name?: string | null): string {
  if (typeof name !== "string") return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const firstInitial = (Array.from(parts[0]!)[0] ?? "").toUpperCase();
  if (parts.length === 1) return firstInitial;
  const lastInitial = (Array.from(parts[parts.length - 1]!)[0] ?? "").toUpperCase();
  return `${firstInitial}${lastInitial}`;
}

