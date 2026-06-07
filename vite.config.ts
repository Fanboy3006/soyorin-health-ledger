import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'save-report-middleware',
      configureServer(server) {
        server.middlewares.use('/api/save-report', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }

          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { userId, content, filename } = JSON.parse(body)
              const userDir = path.resolve(process.cwd(), 'daily_logs', userId)

              if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true })
              }

              const filePath = path.join(userDir, filename)
              fs.writeFileSync(filePath, content, 'utf-8')

              res.statusCode = 200
              res.end(JSON.stringify({ success: true, path: filePath }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
            }
          })
        })
      },
    },
  ],
})
