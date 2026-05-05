import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { authMiddleware, apiKeyOrJwtMiddleware, originGuard, type HonoVariables } from './_shared'
import authRouter from './routes/_auth'
import companiesRouter from './routes/_companies'
import companiesExtraRouter from './routes/_companiesExtra'
import externalCompaniesRouter from './routes/_externalCompanies'
import accountPlansRouter from './routes/_accountPlans'
import journalEntriesRouter from './routes/_journalEntries'
import apiKeysRouter from './routes/_apiKeys'
import fiscalDocumentsRouter from './routes/_fiscalDocuments'
import fiscalBooksRouter from './routes/_fiscalBooks'
import taxCalculationsRouter from './routes/_taxCalculations'
import invitesRouter from './routes/_invites'
import transactionsRouter from './routes/_transactions'

export const config = { runtime: 'edge' }

const app = new Hono<{ Variables: HonoVariables }>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Classificação de rotas ─────────────────────────────────────
//
// INTERNAS  — apenas frontends Syncero (originGuard + authMiddleware)
// EXTERNAS  — integrações via x-api-key ou Bearer JWT (apiKeyOrJwtMiddleware, sem originGuard)
//
// Externas:
//   POST   /api/transactions      — criar lançamento para empresa externa
//   GET    /api/transactions      — listar lançamentos (com extCompanyId)
//   POST   /api/journal-entries   — classificar lançamento

// ── Origin Guard — rotas internas ────────────────────────────
app.use('/me', originGuard)
app.use('/me/*', originGuard)
app.use('/invites/*', originGuard)
app.use('/companies/*', originGuard)
app.use('/external-companies', originGuard)
app.use('/external-companies/*', originGuard)
app.use('/account-plans', originGuard)
app.use('/account-plans/*', originGuard)
app.use('/api-keys', originGuard)
app.use('/api-keys/*', originGuard)
app.use('/fiscal-documents', originGuard)
app.use('/fiscal-documents/*', originGuard)
app.use('/fiscal-books', originGuard)
app.use('/fiscal-books/*', originGuard)
app.use('/tax-calculations', originGuard)
app.use('/tax-calculations/*', originGuard)

// ── Auth middleware — rotas internas ─────────────────────────
app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.use('/invites/:token/accept', authMiddleware)
app.use('/companies/*', authMiddleware)
app.use('/external-companies', authMiddleware)
app.use('/external-companies/*', authMiddleware)
app.use('/account-plans', authMiddleware)
app.use('/account-plans/*', authMiddleware)
app.use('/api-keys', authMiddleware)
app.use('/api-keys/*', authMiddleware)
app.use('/fiscal-documents', authMiddleware)
app.use('/fiscal-documents/*', authMiddleware)
app.use('/fiscal-books', authMiddleware)
app.use('/fiscal-books/*', authMiddleware)
app.use('/tax-calculations', authMiddleware)
app.use('/tax-calculations/*', authMiddleware)

// ── Rotas EXTERNAS — API Key ou JWT, sem originGuard ─────────
app.use('/transactions', apiKeyOrJwtMiddleware)
app.use('/transactions/*', apiKeyOrJwtMiddleware)
app.use('/journal-entries', apiKeyOrJwtMiddleware)
app.use('/journal-entries/*', apiKeyOrJwtMiddleware)

// ── Route registrations ────────────────────────────────────────
app.route('/me', authRouter)
app.route('/companies', companiesRouter)
app.route('/companies', companiesExtraRouter)
app.route('/external-companies', externalCompaniesRouter)
app.route('/account-plans', accountPlansRouter)
app.route('/journal-entries', journalEntriesRouter)
app.route('/api-keys', apiKeysRouter)
app.route('/fiscal-documents', fiscalDocumentsRouter)
app.route('/fiscal-books', fiscalBooksRouter)
app.route('/tax-calculations', taxCalculationsRouter)
app.route('/invites', invitesRouter)
app.route('/transactions', transactionsRouter)

export default handle(app)
