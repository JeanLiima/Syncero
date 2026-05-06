const fs = require('fs')
const path = require('path')

const SPECS_DIR = path.join(__dirname, '..', 'apps', 'docs', 'public')

const specs = [
  { file: 'openapi-flow.json', lang: 'pt', label: 'Flow (PT)' },
  { file: 'openapi-books.json', lang: 'pt', label: 'Books (PT)' },
  { file: 'openapi-books-external.json', lang: 'pt', label: 'Books External (PT)' },
  { file: 'openapi-books-external-en.json', lang: 'en', label: 'Books External (EN)' },
]

for (const { file, lang, label } of specs) {
  const spec = JSON.parse(fs.readFileSync(path.join(SPECS_DIR, file), 'utf8'))
  const issues = []
  const allItems = []

  // Collect ALL params and body fields
  function walkPaths(paths) {
    for (const [pathStr, pathObj] of Object.entries(paths || {})) {
      const methods = ['get', 'post', 'put', 'patch', 'delete']

      // Path-level parameters
      for (const param of (pathObj.parameters || [])) {
        allItems.push({ loc: pathStr, method: '*', where: 'param[' + param.in + ']', name: param.name, desc: param.description || null, required: param.required === true })
      }

      for (const method of methods) {
        const op = pathObj[method]
        if (!op) continue

        // Operation parameters
        for (const param of (op.parameters || [])) {
          allItems.push({ loc: pathStr, method, where: 'param[' + param.in + ']', name: param.name, desc: param.description || null, required: param.required === true })
        }

        // Request body fields
        const bodySchema = op.requestBody?.content?.['application/json']?.schema
        if (bodySchema) {
          collectFields(bodySchema, pathStr, method, 'body', bodySchema.required || [])
        }
      }
    }
  }

  function collectFields(schema, pathStr, method, prefix, requiredArr) {
    for (const [field, prop] of Object.entries(schema.properties || {})) {
      if (!prop || typeof prop !== 'object') continue
      allItems.push({
        loc: pathStr,
        method,
        where: prefix,
        name: field,
        desc: prop.description || null,
        required: requiredArr.includes(field),
        type: prop.type,
        hasRef: !!prop['$ref'],
        hasEnum: !!prop.enum,
        isArray: prop.type === 'array',
      })
      // Recurse into items for arrays
      if (prop.type === 'array' && prop.items?.properties) {
        collectFields(prop.items, pathStr, method, prefix + '.' + field + '[]', prop.items.required || [])
      }
    }
  }

  walkPaths(spec.paths)

  // Detect issues
  for (const item of allItems) {
    const ctx = `[${item.method.toUpperCase().padEnd(6)}] ${item.loc} → ${item.where}:${item.name}`

    // Missing description on required params/fields (not refs, not arrays, not obvious booleans)
    if (item.desc === null && item.required && !item.hasRef && !item.isArray && item.name !== 'id') {
      issues.push({ severity: 'WARN', ctx, msg: 'required field sem description' })
    }

    // Description that just restates the field name (redundant)
    if (item.desc) {
      const norm = item.desc.toLowerCase().replace(/[^a-z0-9]/g, '')
      const nameNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (norm === nameNorm || norm === nameNorm + 's') {
        issues.push({ severity: 'WARN', ctx, msg: `description redundante: "${item.desc}"` })
      }
    }

    // Check for English words in PT specs
    if (lang === 'pt' && item.desc) {
      const engPatterns = [/\bcase.insensitive\b/i, /\bbulk.update\b/i, /\baccountingly\b/i, /\bdefault\b(?!.*padrão)/i]
      for (const pat of engPatterns) {
        if (pat.test(item.desc)) {
          issues.push({ severity: 'ERROR', ctx, msg: `inglês em spec PT: "${item.desc}"` })
        }
      }
    }

    // Check for Portuguese words in EN specs
    if (lang === 'en' && item.desc) {
      const ptPatterns = [/\blançamento\b/i, /\bcontador\b/i, /\bempresa\b/i, /\bpartidas dobradas\b/i]
      for (const pat of ptPatterns) {
        if (pat.test(item.desc)) {
          issues.push({ severity: 'ERROR', ctx, msg: `português em spec EN: "${item.desc}"` })
        }
      }
    }
  }

  console.log('\n========== ' + label + ' ==========')
  if (issues.length === 0) {
    console.log('  ✓ Nenhum problema encontrado')
  } else {
    issues.forEach(i => console.log('  [' + i.severity + '] ' + i.ctx + '\n         → ' + i.msg))
  }

  // Print all items without description (non-required) for review
  const noDesc = allItems.filter(i => i.desc === null && !i.required && !i.hasRef && !i.isArray && i.name !== 'id' && i.type !== 'boolean')
  if (noDesc.length > 0) {
    console.log('\n  --- Campos opcionais sem description (para considerar) ---')
    noDesc.forEach(i => console.log('  [opt] ' + i.method.toUpperCase() + ' ' + i.loc + ' → ' + i.name + ' (' + (i.type || 'ref') + ')'))
  }
}
