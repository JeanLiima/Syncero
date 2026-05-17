// ── Shared PT translations ────────────────────────────────────
// Keys present and identical in both Flow and Books.
// App-specific keys (e.g. pwa_title, login_title, sefaz_*) stay in each app.

export const sharedPt = {

  // Common
  common_cnpjInvalid: 'CNPJ inválido',
  common_errorGeneric: 'Algo deu errado. Tente novamente.',
  common_deletedSuccess: 'Excluído com sucesso',

  // Router
  router_signOut: 'Sair',
  router_accessing: 'Acessando...',

  // Onboarding
  onboarding_loading: 'Configurando sua conta...',

  // Login (title and subtitle are app-specific)
  login_google: 'Entrar com Google',
  login_error: 'Não foi possível conectar com o Google. Tente novamente.',
  login_terms: 'Ao entrar, você concorda com os termos de uso.',
  login_tabSignIn: 'Entrar',
  login_tabSignUp: 'Criar conta',
  login_email: 'E-mail',
  login_emailPlaceholder: 'seu@email.com',
  login_password: 'Senha',
  login_passwordPlaceholder: 'Mínimo 6 caracteres',
  login_passwordConfirm: 'Confirmar senha',
  login_passwordMismatch: 'As senhas não coincidem.',
  login_passwordTooShort: 'A senha deve ter pelo menos 6 caracteres.',
  login_signIn: 'Entrar',
  login_signUp: 'Criar conta',
  login_forgotPassword: 'Esqueceu a senha?',
  login_sendReset: 'Enviar link de redefinição',
  login_resetSent: 'Verifique seu e-mail para redefinir a senha.',
  login_backToLogin: 'Voltar ao login',
  login_or: 'ou',
  login_emailError: 'E-mail ou senha incorretos. Tente novamente.',
  login_emailSignUpError: 'Não foi possível criar a conta. Tente novamente.',
  login_confirmTitle: 'Verifique seu e-mail',
  login_confirmSent: 'Enviamos um link de confirmação para',
  login_confirmAction: 'Clique no link para ativar sua conta.',

  // Invite (app-specific context keys stay in each app)
  invite_verifying: 'Verificando convite…',
  invite_received: 'Convite recebido',
  invite_loginRequired: 'Você precisa estar logado para aceitar o convite.',
  invite_accept: 'Aceitar convite',
  invite_loginToAccept: 'Fazer login para aceitar',
  invite_invalid: 'Convite inválido',
  invite_gotoHome: 'Ir para o início',
  invite_success: 'Convite aceito!',
  invite_accessGranted: 'Você agora tem acesso à empresa',
  invite_gotoDashboard: 'Acessar painel',
  invite_errorInvalid: 'Token de convite inválido.',
  invite_errorNotFound: 'Convite não encontrado.',
  invite_errorExpired: 'Este convite já foi utilizado ou expirou.',
  invite_errorVerify: 'Erro ao verificar convite.',
  invite_errorAccept: 'Erro ao aceitar convite. Tente novamente.',

  // PWA (pwa_title is app-specific)
  pwa_subtitle: 'Acesso rápido, notificações e uso offline',
  pwa_install: 'Instalar',
  pwa_ios: 'Toque em Compartilhar → Tela de Início',
  pwa_close: 'Fechar',

  // Preferences
  preferences_title: 'Preferências',
  preferences_language: 'Idioma',
  preferences_languageHint: 'Escolha o idioma da interface',

  // Settings — universal labels
  settings_cancel: 'Cancelar',
  settings_integrations: 'Integrações',
  settings_certificates: 'Certificados',
  integrations_enabled: 'Habilitado',
  integrations_disabled: 'Desabilitado',

  // Settings — tax regime
  settings_simplesNacional: 'Simples Nacional',
  settings_lucroPresumido: 'Lucro Presumido',
  settings_lucroReal: 'Lucro Real',

  // Settings — company segment
  settings_segmentUndefined: '— Não definido —',
  settings_segmentComercio: 'Comércio',
  settings_segmentServicos: 'Serviços',
  settings_segmentIndustria: 'Indústria',
  settings_segmentConstrucao: 'Construção Civil',
  settings_segmentAgronegocio: 'Agronegócio',
  settings_segmentSaude: 'Saúde',
  settings_segmentEducacao: 'Educação',
  settings_segmentTecnologia: 'Tecnologia',
  settings_segmentFinanceiro: 'Financeiro',
  settings_segmentOutros: 'Outros',

  // Export
  export_title: 'Exportar Lançamentos',
  export_button: 'Exportar',
  export_format: 'Formato',
  export_columns: 'Colunas',
  export_selectAll: 'Selecionar tudo',
  export_deselectAll: 'Desmarcar tudo',
  export_cancel: 'Cancelar',
  export_confirm: 'Exportar',
  export_limitNote: 'Exporta até {n} registros com os filtros aplicados.',
  export_success: 'Arquivo exportado com sucesso.',
  export_fetchError: 'Erro ao buscar lançamentos. Tente novamente.',
  export_col_date: 'Data',
  export_col_paidAt: 'Data de pagamento',
  export_col_description: 'Descrição',
  export_col_type: 'Tipo',
  export_col_amount: 'Valor',
  export_col_status: 'Status',
  export_col_category: 'Categoria',
  export_col_contact: 'Contato',
  export_col_nature: 'Natureza',
  export_col_paymentMethod: 'Forma de pagamento',
  export_col_bank: 'Conta bancária',
  export_col_installment: 'Parcela',
  export_col_notes: 'Observações',

  // API error codes — backend returns lowercase_underscore codes
  // that are mapped to these user-facing messages
  api_error_accountant_already_linked: 'Esta empresa já possui um contador vinculado.',
  api_error_accountant_invite_pending: 'Já existe um convite pendente para esta empresa.',
  api_error_member_already_exists: 'Este usuário já é membro da empresa.',
  api_error_invite_pending_for_email: 'Já existe um convite pendente para este e-mail.',
  api_error_last_admin_demotion: 'Não é possível rebaixar o único administrador da empresa.',

} as const

export type SharedTranslationKey = keyof typeof sharedPt
