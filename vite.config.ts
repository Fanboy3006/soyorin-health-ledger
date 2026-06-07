import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'save-report',
      configureServer(server) {
        server.middlewares.use('/api/save-report', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }

          try {
            // Read request body
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            }
            const body = Buffer.concat(chunks).toString('utf-8')
            const { userId, content, filename } = JSON.parse(body)

            if (!userId || !content || !filename) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing required fields: userId, content, filename' }))
              return
            }

            // Create user directory if not exists
            const userDir = path.resolve(process.cwd(), 'daily_logs', userId)
            if (!fs.existsSync(userDir)) {
              fs.mkdirSync(userDir, { recursive: true })
            }

            // Write file
            const filePath = path.join(userDir, filename)
            fs.writeFileSync(filePath, content, 'utf-8')

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, path: filePath }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }))
          }
        })
      },
    },
  ],
})
