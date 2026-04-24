import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { authMiddleware, type HonoVariables } from './_shared'
import authRouter from './routes/auth'
import companiesRouter from './routes/companies'
import invitesRouter from './routes/invites'
import companyMembersRouter from './routes/companyMembers'
import accountantCompaniesRouter from './routes/accountantCompanies'
import transactionsRouter from './routes/transactions'
import categoriesRouter from './routes/categories'
import payablesRouter from './routes/payables'

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
app.use('/company-members/*', authMiddleware)
app.use('/company-members', authMiddleware)
app.use('/accountant-companies/*', authMiddleware)
app.use('/accountant-companies', authMiddleware)
app.use('/transactions/*', authMiddleware)
app.use('/transactions', authMiddleware)
app.use('/categories/*', authMiddleware)
app.use('/categories', authMiddleware)
app.use('/payables/*', authMiddleware)
app.use('/payables', authMiddleware)
app.use('/invites/:token/accept', authMiddleware)

// ── Route registrations ────────────────────────────────────────
// GET /invites/:token doesn't require auth (middleware skipped above)
app.route('/me', authRouter)
app.route('/companies', companiesRouter)
app.route('/invites', invitesRouter)
app.route('/company-members', companyMembersRouter)
app.route('/accountant-companies', accountantCompaniesRouter)
app.route('/transactions', transactionsRouter)
app.route('/categories', categoriesRouter)
app.route('/payables', payablesRouter)

export default handle(app)
