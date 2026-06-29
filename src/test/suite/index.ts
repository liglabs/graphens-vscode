import * as fs from 'fs'
import * as path from 'path'
import Mocha = require('mocha')

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  })

  const testsRoot = path.resolve(__dirname, '..')
  const files = collectTestFiles(testsRoot)

  for (const file of files) {
    mocha.addFile(file)
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`))
        return
      }

      resolve()
    })
  })
}

function collectTestFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return collectTestFiles(fullPath)
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      return [fullPath]
    }

    return []
  })
}
