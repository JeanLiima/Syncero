export interface BrazilianBank {
  code: string
  name: string
  label: string
}

const RAW: { code: string; name: string }[] = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '004', name: 'Banco do Nordeste do Brasil' },
  { code: '007', name: 'BNDES' },
  { code: '033', name: 'Santander' },
  { code: '041', name: 'Banrisul' },
  { code: '047', name: 'Banese' },
  { code: '070', name: 'BRB' },
  { code: '077', name: 'Banco Inter' },
  { code: '085', name: 'Cecred' },
  { code: '089', name: 'Credisan' },
  { code: '099', name: 'Uniprime Central' },
  { code: '104', name: 'Caixa Econômica Federal' },
  { code: '121', name: 'Agibank' },
  { code: '136', name: 'Unicred' },
  { code: '197', name: 'Stone' },
  { code: '208', name: 'BTG Pactual' },
  { code: '212', name: 'Banco Original' },
  { code: '237', name: 'Bradesco' },
  { code: '243', name: 'Banco Master' },
  { code: '260', name: 'Nubank' },
  { code: '290', name: 'PagBank' },
  { code: '318', name: 'Banco BMG' },
  { code: '323', name: 'Mercado Pago' },
  { code: '336', name: 'C6 Bank' },
  { code: '341', name: 'Itaú Unibanco' },
  { code: '364', name: 'EFÍ' },
  { code: '380', name: 'PicPay' },
  { code: '389', name: 'Banco Mercantil do Brasil' },
  { code: '422', name: 'Banco Safra' },
  { code: '623', name: 'Banco Pan' },
  { code: '633', name: 'Rendimento' },
  { code: '637', name: 'Banco Sofisa' },
  { code: '655', name: 'Votorantim' },
  { code: '707', name: 'Daycoval' },
  { code: '735', name: 'Neon' },
  { code: '745', name: 'Citibank' },
  { code: '748', name: 'Sicredi' },
  { code: '756', name: 'Sicoob' },
]

export const BRAZILIAN_BANKS: BrazilianBank[] = RAW
  .map((b) => ({ ...b, label: `${b.code} - ${b.name}` }))
  .sort((a, b) => a.code.localeCompare(b.code))
