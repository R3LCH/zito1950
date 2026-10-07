import { createApp } from './app.mjs'
const { app, close } = createApp()
const server = app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () =>
  console.log(`ZITO server listening on ${process.env.PORT ?? 3001}`),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      close()
      process.exit(0)
    }),
  )
