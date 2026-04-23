import { serve } from '@hono/node-server'
import app from './[...route]'

serve({ fetch: (req) => app(req as Request), port: 3002 })
console.log('Books API running on http://localhost:3002')
