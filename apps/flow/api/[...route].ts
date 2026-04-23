import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { authMiddleware, type HonoVariables } from './_shared'
import authRouter from './routes/auth'
import companiesRouter from './routes/companies'
import invitesRouter from './routes/invites'

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
app.use('/invites/:token/accept', authMiddleware)

// ── Route registrations ────────────────────────────────────────
// GET /invites/:token doesn't require auth (middleware skipped above)
app.route('/me', authRouter)
app.route('/companies', companiesRouter)
app.route('/invites', invitesRouter)

export default handle(app)
