import { serve } from '@hono/node-server'
import app from './[...route]'

serve({ fetch: (req) => app(req as Request), port: 3001 })
console.log('Flow API running on http://localhost:3001')
