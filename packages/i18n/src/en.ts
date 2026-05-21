import type { SharedTranslationKey } from './pt'

export const sharedEn: Record<SharedTranslationKey, string> = {

  // Common
  common_cnpjInvalid: 'Invalid CNPJ',
  common_errorGeneric: 'Something went wrong. Please try again.',
  common_deletedSuccess: 'Deleted successfully',

  // Router
  router_signOut: 'Sign out',
  router_accessing: 'Accessing...',

  // Onboarding
  onboarding_loading: 'Setting up your account...',

  // Login
  login_google: 'Sign in with Google',
  login_error: 'Could not connect with Google. Please try again.',
  login_terms: 'By signing in, you agree to the terms of use.',
  login_tabSignIn: 'Sign in',
  login_tabSignUp: 'Create account',
  login_email: 'Email',
  login_emailPlaceholder: 'you@email.com',
  login_password: 'Password',
  login_passwordPlaceholder: 'Minimum 6 characters',
  login_passwordConfirm: 'Confirm password',
  login_passwordMismatch: 'Passwords do not match.',
  login_passwordTooShort: 'Password must be at least 6 characters.',
  login_signIn: 'Sign in',
  login_signUp: 'Create account',
  login_forgotPassword: 'Forgot password?',
  login_sendReset: 'Send reset link',
  login_resetSent: 'Check your email to reset your password.',
  login_backToLogin: 'Back to login',
  login_or: 'or',
  login_emailError: 'Incorrect email or password. Please try again.',
  login_emailSignUpError: 'Could not create account. Please try again.',
  login_confirmTitle: 'Check your email',
  login_confirmSent: 'We sent a confirmation link to',
  login_confirmAction: 'Click the link to activate your account.',

  // Invite
  invite_verifying: 'Verifying invite…',
  invite_received: 'Invite received',
  invite_loginRequired: 'You need to be logged in to accept the invite.',
  invite_accept: 'Accept invite',
  invite_loginToAccept: 'Log in to accept',
  invite_invalid: 'Invalid invite',
  invite_gotoHome: 'Go to home',
  invite_success: 'Invite accepted!',
  invite_accessGranted: 'You now have access to the company',
  invite_gotoDashboard: 'Go to dashboard',
  invite_errorInvalid: 'Invalid invite token.',
  invite_errorNotFound: 'Invite not found.',
  invite_errorExpired: 'This invite has already been used or has expired.',
  invite_errorVerify: 'Error verifying invite.',
  invite_errorAccept: 'Error accepting invite. Please try again.',

  // PWA
  pwa_subtitle: 'Quick access, notifications and offline use',
  pwa_install: 'Install',
  pwa_ios: 'Tap Share → Add to Home Screen',
  pwa_close: 'Close',

  // Preferences
  preferences_title: 'Preferences',
  preferences_language: 'Language',
  preferences_languageHint: 'Choose the interface language',

  // Settings — universal labels
  settings_cancel: 'Cancel',
  settings_integrations: 'Integrations',
  settings_certificates: 'Certificates',
  integrations_enabled: 'Enabled',
  integrations_disabled: 'Disabled',

  // Settings — tax regime
  settings_simplesNacional: 'Simples Nacional',
  settings_lucroPresumido: 'Lucro Presumido',
  settings_lucroReal: 'Lucro Real',

  // Settings — company segment
  settings_segmentUndefined: '— Not set —',
  settings_segmentComercio: 'Retail / Commerce',
  settings_segmentServicos: 'Services',
  settings_segmentIndustria: 'Manufacturing',
  settings_segmentConstrucao: 'Construction',
  settings_segmentAgronegocio: 'Agribusiness',
  settings_segmentSaude: 'Healthcare',
  settings_segmentEducacao: 'Education',
  settings_segmentTecnologia: 'Technology',
  settings_segmentFinanceiro: 'Financial',
  settings_segmentOutros: 'Other',

  // Export
  export_title: 'Export Transactions',
  export_button: 'Export',
  export_format: 'Format',
  export_columns: 'Columns',
  export_selectAll: 'Select all',
  export_deselectAll: 'Deselect all',
  export_cancel: 'Cancel',
  export_confirm: 'Export',
  export_limitNote: 'Exports up to {n} records with the current filters applied.',
  export_success: 'File exported successfully.',
  export_fetchError: 'Error fetching transactions. Please try again.',
  export_col_date: 'Date',
  export_col_paidAt: 'Payment date',
  export_col_description: 'Description',
  export_col_type: 'Type',
  export_col_amount: 'Amount',
  export_col_status: 'Status',
  export_col_category: 'Category',
  export_col_contact: 'Contact',
  export_col_nature: 'Nature',
  export_col_paymentMethod: 'Payment method',
  export_col_bank: 'Bank account',
  export_col_installment: 'Installment',
  export_col_notes: 'Notes',

  // API error codes
  api_error_accountant_already_linked: 'This company already has a linked accountant.',
  api_error_accountant_invite_pending: 'An invite is already pending for this company.',
  api_error_member_already_exists: 'This user is already a member of the company.',
  api_error_invite_pending_for_email: 'An invite is already pending for this email.',
  api_error_last_admin_demotion: 'Cannot demote the only admin of the company.',

  // Import (shared — Flow and Books use the same OFX/NFe import modal)
  transactions_import: 'Import',
  transactions_import_title: 'Import transactions',
  transactions_import_dropzone: 'Drop an XML (NFe) or OFX file here',
  transactions_import_dropzone_hint: 'or click to select',
  transactions_import_accept: 'Accepted formats: .xml (NFe), .ofx, .qfx',
  transactions_import_nfe_preview_title: 'Fiscal note detected',
  transactions_import_nfe_counterpart: 'Counterpart',
  transactions_import_nfe_date: 'Issue date',
  transactions_import_nfe_amount: 'Total amount',
  transactions_import_nfe_type_income: 'Income — company is issuer',
  transactions_import_nfe_type_expense: 'Expense — company is recipient',
  transactions_import_nfe_type_unknown: 'Tax ID not identified',
  transactions_import_nfe_cnpj_warning: 'Your tax ID was not found in this file. This document may not belong to your company.',
  transactions_import_nfe_proceed_anyway: 'Proceed anyway',
  transactions_import_nfe_continue: 'Create transaction',
  transactions_import_ofx_found: '{count} transactions found',
  transactions_import_ofx_defaultNature: 'Default nature',
  transactions_import_ofx_confirm: 'Import {count} transaction(s)',
  transactions_import_ofx_noneSelected: 'None selected',
  transactions_import_error_parse: 'Could not read the file. Make sure it is a valid NFe XML or OFX file.',

  // Integrations SEFAZ (shared)
  integrations_sefaz_name: 'SEFAZ DF-e',
  integrations_sefaz_desc: 'Automatic sync of NF-e, NFS-e and CT-e directly from SEFAZ.',
  integrations_sefaz_noCert: 'No digital certificate configured.',
  integrations_sefaz_configureCert: 'Configure in Company → Certificates',

}
