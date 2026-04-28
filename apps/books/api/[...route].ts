import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { authMiddleware, type HonoVariables } from './_shared'
import authRouter from './routes/auth'
import companiesRouter from './routes/companies'
import companiesExtraRouter from './routes/companiesExtra'
import externalCompaniesRouter from './routes/externalCompanies'
import accountPlansRouter from './routes/accountPlans'
import journalEntriesRouter from './routes/journalEntries'
import apiKeysRouter from './routes/apiKeys'
import fiscalDocumentsRouter from './routes/fiscalDocuments'
import fiscalBooksRouter from './routes/fiscalBooks'
import taxCalculationsRouter from './routes/taxCalculations'
import invitesRouter from './routes/invites'
import transactionsRouter from './routes/transactions'

export const config = { runtime: 'edge' }

const app = new Hono<{ Variables: HonoVariables }>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Auth middleware ───────────────────────────────────────────
app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.use('/invites/:token/accept', authMiddleware)
app.use('/companies/*', authMiddleware)
app.use('/external-companies/*', authMiddleware)
app.use('/account-plans', authMiddleware)
app.use('/account-plans/*', authMiddleware)
app.use('/journal-entries', authMiddleware)
app.use('/journal-entries/*', authMiddleware)
app.use('/api-keys', authMiddleware)
app.use('/api-keys/*', authMiddleware)
app.use('/fiscal-documents', authMiddleware)
app.use('/fiscal-documents/*', authMiddleware)
app.use('/fiscal-books', authMiddleware)
app.use('/fiscal-books/*', authMiddleware)
app.use('/tax-calculations', authMiddleware)
app.use('/tax-calculations/*', authMiddleware)
app.use('/transactions', authMiddleware)
app.use('/transactions/*', authMiddleware)

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
