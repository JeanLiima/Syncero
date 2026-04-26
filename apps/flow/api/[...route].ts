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
import banksRouter from './routes/banks'
import payablesRouter from './routes/payables'
import incomeStatementRouter from './routes/incomeStatement'
import cashFlowRouter from './routes/cashFlow'
import contactsRouter from './routes/contacts'

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
app.use('/banks/*', authMiddleware)
app.use('/banks', authMiddleware)
app.use('/payables/*', authMiddleware)
app.use('/payables', authMiddleware)
app.use('/income-statement', authMiddleware)
app.use('/cash-flow', authMiddleware)
app.use('/contacts', authMiddleware)
app.use('/contacts/*', authMiddleware)
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
app.route('/banks', banksRouter)
app.route('/payables', payablesRouter)
app.route('/income-statement', incomeStatementRouter)
app.route('/cash-flow', cashFlowRouter)
app.route('/contacts', contactsRouter)

export default handle(app)
