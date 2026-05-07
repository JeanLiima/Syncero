const fs = require('fs')
const path = require('path')

const SPECS_DIR = path.join(__dirname, '..', '..', 'apps', 'docs', 'public')

const specs = [
  { file: 'openapi-flow.json',              lang: 'pt', label: 'Flow (PT)' },
  { file: 'openapi-flow-external.json',     lang: 'pt', label: 'Flow External (PT)' },
  { file: 'openapi-flow-external-en.json',  lang: 'en', label: 'Flow External (EN)' },
  { file: 'openapi-books.json',             lang: 'pt', label: 'Books (PT)' },
  { file: 'openapi-books-external.json',    lang: 'pt', label: 'Books External (PT)' },
  { file: 'openapi-books-external-en.json', lang: 'en', label: 'Books External (EN)' },
]

for (const { file, lang, label } of specs) {
  const filePath = path.join(SPECS_DIR, file)
  if (!fs.existsSync(filePath)) {
    console.log('\n========== ' + label + ' ==========')
    console.log('  (arquivo não encontrado, pulando)')
    continue
  }

  const spec = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const issues = []
  const allItems = []

  // ── helpers ──────────────────────────────────────────────────

  function pushItem(loc, method, where, name, desc, required, prop) {
    allItems.push({
      loc, method, where, name,
      desc:    desc || null,
      required: !!required,
      type:    prop?.type,
      hasRef:  !!(prop?.['$ref']),
      isArray: prop?.type === 'array',
    })
  }

  function collectFields(schema, loc, method, prefix, requiredArr) {
    for (const [field, prop] of Object.entries(schema.properties || {})) {
      if (!prop || typeof prop !== 'object') continue
      pushItem(loc, method, prefix, field, prop.description, requiredArr.includes(field), prop)
      if (prop.type === 'array' && prop.items?.properties) {
        collectFields(prop.items, loc, method, prefix + '.' + field + '[]', prop.items.required || [])
      }
    }
  }

  // ── walk paths (params + request bodies) ─────────────────────

  function walkPaths(paths) {
    for (const [pathStr, pathObj] of Object.entries(paths || {})) {
      const methods = ['get', 'post', 'put', 'patch', 'delete']

      for (const param of (pathObj.parameters || [])) {
        pushItem(pathStr, '*', 'param[' + param.in + ']', param.name, param.description, param.required, param.schema)
      }

      for (const method of methods) {
        const op = pathObj[method]
        if (!op) continue
        for (const param of (op.parameters || [])) {
          pushItem(pathStr, method, 'param[' + param.in + ']', param.name, param.description, param.required, param.schema)
        }
        const bodySchema = op.requestBody?.content?.['application/json']?.schema
        if (bodySchema) collectFields(bodySchema, pathStr, method, 'body', bodySchema.required || [])
      }
    }
  }

  // ── walk schemas (components/schemas) ────────────────────────

  function walkSchemas(schemas) {
    for (const [schemaName, schema] of Object.entries(schemas || {})) {
      if (!schema.properties) continue
      const requiredArr = schema.required || []
      for (const [field, prop] of Object.entries(schema.properties)) {
        if (!prop || typeof prop !== 'object') continue
        pushItem('schema:' + schemaName, '-', 'property', field, prop.description, requiredArr.includes(field), prop)
        if (prop.type === 'array' && prop.items?.properties) {
          collectFields(prop.items, 'schema:' + schemaName, '-', 'property.' + field + '[]', prop.items.required || [])
        }
      }
    }
  }

  walkPaths(spec.paths)
  walkSchemas(spec.components?.schemas)

  // ── detect issues ─────────────────────────────────────────────

  for (const item of allItems) {
    const ctx = item.method === '-'
      ? `[schema] ${item.loc} → ${item.name}`
      : `[${item.method.toUpperCase().padEnd(6)}] ${item.loc} → ${item.where}:${item.name}`

    const skip = item.hasRef || item.isArray

    if (item.desc === null && !skip) {
      issues.push({
        severity: item.required ? 'ERROR' : 'WARN',
        ctx,
        msg: item.required ? 'campo obrigatório sem description' : 'campo opcional sem description',
      })
    }

    if (item.desc) {
      const norm     = item.desc.toLowerCase().replace(/[^a-z0-9]/g, '')
      const nameNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (norm === nameNorm || norm === nameNorm + 's') {
        issues.push({ severity: 'WARN', ctx, msg: `description redundante: "${item.desc}"` })
      }
    }

    if (lang === 'pt' && item.desc) {
      const engPatterns = [/\bcase.insensitive\b/i, /\bbulk.update\b/i, /\baccountingly\b/i, /\bdefault\b(?!.*padrão)/i]
      for (const pat of engPatterns) {
        if (pat.test(item.desc)) issues.push({ severity: 'ERROR', ctx, msg: `inglês em spec PT: "${item.desc}"` })
      }
    }

    if (lang === 'en' && item.desc) {
      const ptPatterns = [/\blançamento\b/i, /\bcontador\b/i, /\bempresa\b/i, /\bpartidas dobradas\b/i]
      for (const pat of ptPatterns) {
        if (pat.test(item.desc)) issues.push({ severity: 'ERROR', ctx, msg: `português em spec EN: "${item.desc}"` })
      }
    }
  }

  const errors = issues.filter(i => i.severity === 'ERROR')
  const warns  = issues.filter(i => i.severity === 'WARN')

  console.log('\n========== ' + label + ' ==========')
  if (issues.length === 0) {
    console.log('  ✓ Nenhum problema encontrado')
  } else {
    errors.forEach(i => console.log('  [ERROR] ' + i.ctx + '\n          → ' + i.msg))
    warns.forEach(i  => console.log('  [WARN]  ' + i.ctx + '\n          → ' + i.msg))
    console.log(`\n  Resumo: ${errors.length} erro(s), ${warns.length} aviso(s)`)
  }
}
