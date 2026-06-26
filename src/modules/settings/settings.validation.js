import { z } from "zod";

export const settingsSchema = z.object({
  platformName: z.string().trim().min(1, "Platform name is required"),
  marketplaceName: z.string().trim().min(1, "Marketplace name is required"),
  supportEmail: z.string().trim().email("Support email must be a valid email"),
  contactEmail: z.string().trim().email("Contact email must be a valid email"),
  commissionPercentage: z.coerce.number().min(0, "Commission must be 0 or greater").max(100, "Commission must be 100 or less"),
  defaultCurrency: z.string().trim().min(1, "Currency is required"),
  defaultTimezone: z.string().trim().min(1, "Timezone is required"),
  defaultListingStatus: z.enum(["draft", "pending", "approved", "rejected"], {
    errorMap: () => ({ message: "Default listing status is invalid" }),
  }),
  refundPolicy: z.string().trim().min(1, "Refund policy is required"),
  termsUrl: z.string().trim().url("Terms URL must be a valid URL"),
  privacyUrl: z.string().trim().url("Privacy URL must be a valid URL"),
});
