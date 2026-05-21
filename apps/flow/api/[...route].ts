import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { authMiddleware, originGuard, type HonoVariables } from './_shared'
import authRouter from './routes/_auth'
import companiesRouter from './routes/_companies'
import invitesRouter from './routes/_invites'
import companyMembersRouter from './routes/_companyMembers'
import accountantCompaniesRouter from './routes/_accountantCompanies'
import transactionsRouter from './routes/_transactions'
import categoriesRouter from './routes/_categories'
import banksRouter from './routes/_banks'
import incomeStatementRouter from './routes/_incomeStatement'
import cashFlowRouter from './routes/_cashFlow'
import contactsRouter from './routes/_contacts'
import sefazCredentialsRouter from './routes/_sefazCredentials'
import fiscalDocumentsRouter from './routes/_fiscalDocuments'
import pluggyRouter from './routes/_pluggy'

export const config = { runtime: 'edge' }

const app = new Hono<{ Variables: HonoVariables }>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Origin Guard — Flow é 100% interno, sem APIs públicas ─────
// /pluggy/webhook é chamado pelo Pluggy (sem Origin header) — excluir do guard
app.use('/*', (c, next) => {
  if (c.req.path === '/api/pluggy/webhook') return next()
  return originGuard(c, next)
})

// ── Auth middleware ───────────────────────────────────────────
app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.use('/companies/*', authMiddleware)
app.use('/company-members/*', authMiddleware)
app.use('/company-members', authMiddleware)
app.use('/accountant-companies/*', authMiddleware)
app.use('/accountant-companies', authMiddleware)
app.use('/transactions/*', authMiddleware)
app.use('/transactions', authMiddleware)
app.use('/categories/*', authMiddleware)
app.use('/categories', authMiddleware)
app.use('/banks/*', authMiddleware)
app.use('/banks', authMiddleware)
app.use('/income-statement', authMiddleware)
app.use('/cash-flow', authMiddleware)
app.use('/contacts', authMiddleware)
app.use('/contacts/*', authMiddleware)
app.use('/sefaz-credentials', authMiddleware)
app.use('/sefaz-credentials/*', authMiddleware)
app.use('/fiscal-documents', authMiddleware)
app.use('/fiscal-documents/*', authMiddleware)
// /pluggy/webhook é público (autenticado via HMAC) — os demais exigem JWT
app.use('/pluggy/connect-token', authMiddleware)
app.use('/pluggy/connect', authMiddleware)
app.use('/pluggy/disconnect/*', authMiddleware)
app.use('/pluggy/sync/*', authMiddleware)
app.use('/invites/:token/accept', authMiddleware)

// ── Route registrations ────────────────────────────────────────
// GET /invites/:token é público (sem auth) mas ainda passa pelo originGuard
app.route('/me', authRouter)
app.route('/companies', companiesRouter)
app.route('/invites', invitesRouter)
app.route('/company-members', companyMembersRouter)
app.route('/accountant-companies', accountantCompaniesRouter)
app.route('/transactions', transactionsRouter)
app.route('/categories', categoriesRouter)
app.route('/banks', banksRouter)
app.route('/income-statement', incomeStatementRouter)
app.route('/cash-flow', cashFlowRouter)
app.route('/contacts', contactsRouter)
app.route('/sefaz-credentials', sefazCredentialsRouter)
app.route('/fiscal-documents', fiscalDocumentsRouter)
app.route('/pluggy', pluggyRouter)

export default handle(app)
