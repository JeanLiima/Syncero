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

export const config = { runtime: 'edge' }

const app = new Hono<{ Variables: HonoVariables }>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Auth middleware ───────────────────────────────────────────
app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.use('/companies/*', authMiddleware)
app.use('/external-companies/*', authMiddleware)
app.use('/account-plans', authMiddleware)
app.use('/account-plans/*', authMiddleware)
app.use('/journal-entries', authMiddleware)
app.use('/journal-entries/*', authMiddleware)
app.use('/api-keys', authMiddleware)
app.use('/api-keys/*', authMiddleware)

// ── Route registrations ────────────────────────────────────────
app.route('/me', authRouter)
app.route('/companies', companiesRouter)
app.route('/companies', companiesExtraRouter)
app.route('/external-companies', externalCompaniesRouter)
app.route('/account-plans', accountPlansRouter)
app.route('/journal-entries', journalEntriesRouter)
app.route('/api-keys', apiKeysRouter)

export default handle(app)
