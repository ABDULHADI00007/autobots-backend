export const BrandHeader = () => `
  <tr>
    <td style="padding:28px 32px 0; text-align:center; background:#ffffff;">
      <p style="margin:0; font-size:20px; font-weight:700; color:#111827; letter-spacing:0.03em;">Autobots Marketplace</p>
      <p style="margin:8px 0 0; font-size:14px; color:#6b7280; line-height:20px;">AI-powered marketplace for buyers and sellers.</p>
    </td>
  </tr>
`;

export const BrandFooter = () => `
  <tr>
    <td style="padding:24px 32px 32px; text-align:center; background:#f8fafc; color:#6b7280; font-size:12px; line-height:18px;">
      <p style="margin:0;">Powered by Autobots Marketplace.</p>
      <p style="margin:8px 0 0;">If you need help, reply to this email or visit your account dashboard.</p>
    </td>
  </tr>
`;

export const BaseEmailLayout = ({ previewText = "", body }) => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Email</title>
      <style>
        body { margin: 0; padding: 0; background: #f3f4f6; color: #111827; }
        table { border-collapse: collapse; }
        img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
        .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
        @media only screen and (max-width: 620px) {
          .container { width: 100% !important; padding: 0 !important; }
          .content { padding: 24px !important; }
          .button-link { width: 100% !important; }
        }
      </style>
    </head>
    <body style="margin:0; padding:0; background:#f3f4f6;">
      <span class="preheader">${previewText}</span>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f6; min-width:100%;">
        <tr>
          <td align="center" style="padding:24px 16px;">
            <table class="container" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px; background:#ffffff; border-radius:18px; overflow:hidden;">
              ${body}
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;
