#!/bin/bash
# Rode este script UMA VEZ dentro da pasta finflow/
# Pré-requisito: ter o GitHub CLI instalado (brew install gh) ou usar HTTPS com token

# 1. Inicializa o git
git init
git branch -M main

# 2. Cria o repositório no GitHub (requer gh CLI autenticado)
gh repo create finflow \
  --private \
  --description "Controle financeiro empresarial — PWA multi-tenant" \
  --source=. \
  --remote=origin

# 3. Primeiro commit
git add .
git commit -m "chore: estrutura inicial do projeto Finflow

- Schema Supabase com 10 tabelas e RLS completo
- Hooks: useAuth, usePWAInstall
- Componente PWABanner
- Roteamento com guards por role (empresa / contador)
- Setup vite + PWA configurado"

# 4. Push
git push -u origin main

echo ""
echo "✓ Repositório criado e código enviado para o GitHub!"
echo "  Acesse: https://github.com/$(gh api user --jq .login)/finflow"
