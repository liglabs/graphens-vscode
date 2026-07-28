import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { GraphensConfigSchema } from 'graphens-vscode-shared'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const distDir = join(__dirname, '..', 'dist')
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

// Zod v4 native JSON Schema generation
// @ts-ignore
const schema = GraphensConfigSchema.toJSONSchema()

writeFileSync(
  join(distDir, 'schema.json'),
  JSON.stringify(schema, null, 2)
)

console.log('JSON Schema generated successfully at web/dist/schema.json')
