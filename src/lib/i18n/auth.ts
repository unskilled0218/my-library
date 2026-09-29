import { defineMessages } from '@/lib/i18n/config'

export const authMessages = defineMessages(
  {
    loginTitle: '다시 오신 것을 환영합니다',
    registerTitle: '무료로 가입하기',
    adminLoginTitle: '관리자 로그인',
    adminSetupTitle: '초기 관리자 만들기',
    createAccount: '계정 만들기',
    alreadyRegistered: '이미 가입하셨나요?',
    loginId: '로그인 ID',
    loginHelp: '3~40자: 영문자, 숫자, 마침표, 밑줄 또는 하이픈.',
    password: '비밀번호',
    passwordHelp: '12자 이상.',
    continue: '계속',
    invalidLoginId:
      '로그인 ID는 3~40자의 영문자, 숫자, 마침표, 밑줄 또는 하이픈만 사용할 수 있습니다.',
    invalidPassword: '비밀번호는 12~128자여야 합니다.',
    registrationFailed: '가입하지 못했습니다.',
    invalidCredentials: '로그인 정보가 올바르지 않습니다.',
    invalidSetupToken: '설정 토큰이 유효하지 않거나 만료되었습니다.',
    passwordChanged: '비밀번호를 변경했습니다. 다시 로그인해 주세요.',
  },
  {
    loginTitle: 'Welcome back',
    registerTitle: 'Register freely',
    adminLoginTitle: 'Administrator sign in',
    adminSetupTitle: 'Create initial administrator',
    createAccount: 'Create an account',
    alreadyRegistered: 'Already registered?',
    loginId: 'Login ID',
    loginHelp:
      '3-40 characters: letters, numbers, dots, underscores, or hyphens.',
    password: 'Password',
    passwordHelp: 'At least 12 characters.',
    continue: 'Continue',
    invalidLoginId:
      'Login ID must use 3-40 letters, numbers, dots, underscores, or hyphens.',
    invalidPassword: 'Password must be between 12 and 128 characters.',
    registrationFailed: 'Registration failed.',
    invalidCredentials: 'Invalid credentials.',
    invalidSetupToken: 'Setup token is invalid or expired.',
    passwordChanged: 'Password changed. Sign in again.',
  },
)

export const authErrorKeys = {
  'invalid-login-id': 'invalidLoginId',
  'invalid-password': 'invalidPassword',
  'registration-failed': 'registrationFailed',
  'invalid-credentials': 'invalidCredentials',
  'invalid-setup-token': 'invalidSetupToken',
  'password-changed': 'passwordChanged',
} as const
