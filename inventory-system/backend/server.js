// server.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import authRoutes from './routes/auth.js'
import inventoryRoutes from './routes/inventory.js'   // ⬅️ nag-expect og inventory.js
import requisitionRoutes from './routes/requisition.js' // ⬅️ nag-expect og requisition.jsimport trailRoutes from './routes/trail.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/requisitions', requisitionRoutes)
app.use('/api/trail', trailRoutes)

// health check
app.get('/api/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`))