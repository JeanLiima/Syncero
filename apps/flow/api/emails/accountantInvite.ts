export function accountantInviteEmail(opts: {
  companyName: string
  inviterName: string
  inviteLink: string
}): { subject: string; html: string } {
  const { companyName, inviterName, inviteLink } = opts

  return {
    subject: `You've been invited to access ${companyName} on Syncero`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Syncero Invite</title>
</head>
<body style="margin:0;padding:0;background:#0b0f19;font-family:'DM Sans',Arial,sans-serif;color:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#111827;border:1px solid #1e2d45;border-radius:12px;padding:10px 18px;">
                    <span style="font-size:16px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;">Syncero Books</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111827;border:1px solid #1e2d45;border-radius:16px;padding:40px 36px;">

              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;line-height:1.3;">
                You've been invited
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#f1f5f9;">${inviterName}</strong> has invited you to access
                <strong style="color:#f1f5f9;">${companyName}</strong>'s accounting on Syncero Books.
              </p>

              <p style="margin:0 0 8px;font-size:13px;color:#475569;">
                As the accountant for this company, you'll be able to view financial records, journal entries, and more — in read-only mode.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td style="background:#10b981;border-radius:8px;">
                    <a href="${inviteLink}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:12px;color:#475569;">Or copy this link into your browser:</p>
              <p style="margin:0;font-size:12px;font-family:monospace;color:#3b82f6;word-break:break-all;">
                ${inviteLink}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;" align="center">
              <p style="margin:0;font-size:12px;color:#475569;">
                If you weren't expecting this invite, you can safely ignore this email.
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#1e2d45;">
                Syncero · Financial management platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }
}
