import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react'
import { useSession } from '../components/auth/AuthProvider'
import { getAuthClient } from '../services/authClient'
import './auth.css'

const messages: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme o seu e-mail antes de entrar.',
  weak_password: 'Escolha uma senha mais forte.',
  over_email_send_rate_limit: 'Aguarde alguns minutos antes de solicitar outro e-mail.',
  over_request_rate_limit: 'Aguarde alguns minutos antes de tentar novamente.',
}

export function AuthPage({ register = false }: { register?: boolean }) {
  const session = useSession()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const from = location.state?.from
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from : '/workspace'

  if (session) return <Navigate to={destination} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    const email = String(fields.get('email')).trim()
    const password = String(fields.get('password'))
    setBusy(true)
    setError('')
    try {
      const client = await getAuthClient()
      const result = register
        ? await client.auth.signUp({
            email, password, options: { emailRedirectTo: new URL('/login', window.location.origin).href },
          })
        : await client.auth.signInWithPassword({ email, password })
      if (result.error) {
        setError(messages[result.error.code ?? ''] ?? 'Não foi possível concluir. Tente novamente.')
      } else if (register && !result.data.session) {
        setConfirmation(true)
      }
    } catch {
      setError('Não foi possível conectar ao serviço de autenticação.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-identity">
        <img className="auth-backdrop" src="/site/alfama.webp" alt="" />
        <a className="auth-wordmark" href="/site/">
          <img src="/site/favicon.svg" width="44" height="44" alt="" />
          LusoAncestry
        </a>
        <div className="auth-identity-copy">
          <p>Genealogia e memória portuguesa</p>
          <h2>Preserve a história <em>que nos trouxe até aqui.</em></h2>
          <a href="/site/"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao site</a>
        </div>
        <p className="auth-photo-credit">
          <a href="https://commons.wikimedia.org/wiki/File:Alfama_Lisbon_12_2016_9705.jpg">Alfama, Lisboa · Mariordo</a>
          {' · '}<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
        </p>
      </div>
      <section className="auth-content" aria-labelledby="auth-title">
        <a className="auth-mobile-brand auth-wordmark" href="/site/">
          <img src="/site/favicon.svg" width="40" height="40" alt="" />
          LusoAncestry
        </a>
        <div className="auth-card">
          <header>
            <p className="auth-kicker">Espaço de trabalho</p>
            <h1 id="auth-title">{confirmation ? 'Confirme seu e-mail' : register ? 'Criar sua conta' : 'Entrar no LusoAncestry'}</h1>
            {!confirmation && <p>{register
              ? 'Crie sua conta para acessar os documentos paroquiais e revisar transcrições no nível Videira.'
              : 'Acesse o espaço de transcrição e validação de registros históricos.'}</p>}
          </header>
          {confirmation ? (
            <p className="auth-confirmation" role="status">
              <MailCheck size={22} aria-hidden="true" />
              Abra o link de confirmação que enviamos para seu e-mail. Confira também a pasta de spam.
            </p>
          ) : (
            <form onSubmit={submit}>
              <label>
                E-mail
                <input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required />
              </label>
              <label>
                <span>Senha {register && <small>(mínimo de 8 caracteres)</small>}</span>
                <input name="password" type="password" required minLength={register ? 8 : undefined}
                  autoComplete={register ? 'new-password' : 'current-password'} />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          )}
          <div className="auth-links">
            {register
              ? <Link to="/login" state={location.state}>Ir para o login</Link>
              : <Link to="/cadastro" state={location.state}>Criar uma conta</Link>}
            <a href="/site/#participar">Quero participar dos testes</a>
          </div>
        </div>
      </section>
    </main>
  )
}
