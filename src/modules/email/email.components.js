export const Text = ({ content, style = "" }) => `
  <tr>
    <td style="padding:0 32px 16px; font-size:16px; line-height:24px; color:#334155; ${style}">
      ${content}
    </td>
  </tr>
`;

export const SectionTitle = ({ content }) => `
  <tr>
    <td style="padding:0 32px 16px; font-size:22px; line-height:28px; font-weight:700; color:#111827;">
      ${content}
    </td>
  </tr>
`;

export const Divider = () => `
  <tr>
    <td style="padding:0 32px 24px;">
      <div style="height:1px; background:#e2e8f0; width:100%;"></div>
    </td>
  </tr>
`;

export const Button = ({ label, url }) => `
  <tr>
    <td style="padding:0 32px 24px; text-align:left;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center">
            <a href="${url}" class="button-link" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:10px; font-weight:600; font-size:16px;">
              ${label}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;
