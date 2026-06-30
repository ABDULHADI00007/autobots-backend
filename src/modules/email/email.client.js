import { Resend } from "resend";
import { env } from "../../config/env.js";

const resendClient = new Resend(env.RESEND_API_KEY);

const getFromDomain = () => {
  const [localPart, domain] = env.EMAIL_FROM_ADDRESS.split("@");
  if (!localPart || !domain) {
    throw new Error(`Invalid EMAIL_FROM_ADDRESS: ${env.EMAIL_FROM_ADDRESS}`);
  }
  return domain.toLowerCase();
};

export const validateResendConfiguration = async () => {
  const fromDomain = getFromDomain();
  console.log("EMAIL CONFIG: validating Resend configuration", {
    resendApiKeySet: Boolean(env.RESEND_API_KEY),
    fromAddress: env.EMAIL_FROM_ADDRESS,
  });

  const response = await resendClient.domains.list();
  if (response.error) {
    throw new Error(
      `Resend API key validation failed: ${response.error.name} - ${response.error.message}`
    );
  }

  const domains = response.data?.data ?? [];
  const verifiedDomain = domains.find(
    (domain) =>
      domain.name.toLowerCase() === fromDomain &&
      ["verified", "partially_verified"].includes(domain.status)
  );

  if (!verifiedDomain) {
    const registeredDomainNames = domains.map((domain) => domain.name).join(", ") || "<none>";
    if (fromDomain === "resend.dev") {
      console.warn(
        "EMAIL CONFIG: Resend sender domain is not verified, but using resend.dev in development. Skipping domain check."
      );
      return true;
    }

    throw new Error(
      `EMAIL_FROM_ADDRESS domain is not verified in Resend: ${fromDomain}. Verified domains: ${registeredDomainNames}`
    );
  }

  console.log("EMAIL CONFIG: Resend sender domain verified", {
    fromDomain,
    status: verifiedDomain.status,
  });
  return true;
};

export const getEmailClient = () => resendClient;
