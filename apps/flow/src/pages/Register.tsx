import { Navigate } from 'react-router-dom'

// Cadastro agora é feito via Google SSO na tela de login
export function Component() {
  return <Navigate to="/login" replace />
}
