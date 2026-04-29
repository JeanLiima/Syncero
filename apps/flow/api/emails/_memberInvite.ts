type Lang = 'pt' | 'en'

const copy = {
  pt: {
    subject: (company: string) => `Você foi convidado para fazer parte de ${company} no Syncero`,
    title: 'Você foi convidado',
    body: (inviter: string, company: string) =>
      `<strong style="color:#f1f5f9;">${inviter}</strong> convidou você para fazer parte da equipe de <strong style="color:#f1f5f9;">${company}</strong> no Syncero Flow.`,
    description: 'Após aceitar, você terá acesso ao painel financeiro da empresa conforme o papel atribuído a você.',
    cta: 'Aceitar convite',
    linkLabel: 'Ou copie este link no seu navegador:',
    footer: 'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
    brand: 'Syncero · Plataforma de gestão financeira',
  },
  en: {
    subject: (company: string) => `You've been invited to join ${company} on Syncero`,
    title: "You've been invited",
    body: (inviter: string, company: string) =>
      `<strong style="color:#f1f5f9;">${inviter}</strong> has invited you to join the team at <strong style="color:#f1f5f9;">${company}</strong> on Syncero Flow.`,
    description: "Once accepted, you'll have access to the company's financial dashboard according to your assigned role.",
    cta: 'Accept invitation',
    linkLabel: 'Or copy this link into your browser:',
    footer: "If you weren't expecting this invite, you can safely ignore this email.",
    brand: 'Syncero · Financial management platform',
  },
}

export function memberInviteEmail(opts: {
  companyName: string
  inviterName: string
  inviteLink: string
  language?: Lang
}): { subject: string; html: string } {
  const { companyName, inviterName, inviteLink, language = 'pt' } = opts
  const t = copy[language]

  return {
    subject: t.subject(companyName),
    html: `<!DOCTYPE html>
<html lang="${language === 'pt' ? 'pt-BR' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.title}</title>
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
                    <span style="font-size:16px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;">Syncero Flow</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111827;border:1px solid #1e2d45;border-radius:16px;padding:40px 36px;">

              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;line-height:1.3;">
                ${t.title}
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
                ${t.body(inviterName, companyName)}
              </p>

              <p style="margin:0 0 8px;font-size:13px;color:#475569;">
                ${t.description}
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td style="background:#3b82f6;border-radius:8px;">
                    <a href="${inviteLink}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      ${t.cta}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:12px;color:#475569;">${t.linkLabel}</p>
              <p style="margin:0;font-size:12px;font-family:monospace;color:#3b82f6;word-break:break-all;">
                ${inviteLink}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;" align="center">
              <p style="margin:0;font-size:12px;color:#475569;">
                ${t.footer}
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#1e2d45;">
                ${t.brand}
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
