import { useEffect, useState } from 'react'
import { useWorkspaceRole } from '../components/auth/AuthProvider'
import {
  listTrainingInterest, listWorkspaceAccounts, listWorkspaceChanges, setWorkspaceLevel,
  type TrainingInterest, type WorkspaceAccount, type WorkspaceChange, type WorkspaceLevel,
} from '../services/dataService'

const levels = { videira: 'Videira', cacho: 'Cacho', vinho: 'Vinho' }

export function AdminPage() {
  const role = useWorkspaceRole()
  if (role !== 'admin') {
    return <main className="page-shell"><p role="alert">Esta página exige acesso de administrador.</p></main>
  }
  return <AccountManagement />
}

function AccountManagement() {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ users: WorkspaceAccount[]; hasNext: boolean }>()
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState('')
  const [selected, setSelected] = useState<WorkspaceAccount>()

  useEffect(() => {
    let active = true
    listWorkspaceAccounts(page).then(data => {
      if (active) setResult(data)
    }).catch((error: Error) => {
      if (active) setError(error.message)
    })
    return () => { active = false }
  }, [page])

  function changePage(nextPage: number) {
    setError('')
    setResult(undefined)
    setSelected(undefined)
    setPage(nextPage)
  }

  async function changeAccess(account: WorkspaceAccount, level: WorkspaceLevel) {
    setSavingId(account.id)
    setError('')
    try {
      const updated = await setWorkspaceLevel(account.id, level)
      setResult(previous => previous && ({
        ...previous, users: previous.users.map(user => user.id === updated.id ? updated : user),
      }))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível alterar o acesso.')
    } finally {
      setSavingId('')
    }
  }

  return (
    <main className="page-shell">
      <section className="page-heading">
        <h1>Administração de usuários</h1>
        <p>Defina o nível das contas e consulte as alterações salvas.</p>
      </section>
      <div className="workspace-levels">
        {Object.entries(levels).map(([id, label]) => (
          <div className="workspace-level" key={id} data-level={id}>
            <div className="workspace-level-banner" aria-hidden="true" />
            <span className="workspace-level-icon" aria-hidden="true" /> {label}
          </div>
        ))}
      </div>
      <InterestManagement />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!result && !error && <p role="status">Carregando contas…</p>}
      {result && (
        <div className="data-table">
          <table className="admin-accounts">
            <thead><tr><th scope="col">E-mail</th><th scope="col">Nível</th><th scope="col">Alterações</th></tr></thead>
            <tbody>
              {result.users.map(account => (
                <tr key={account.id}>
                  <td>{account.email ?? 'Sem e-mail'}</td>
                  <td>
                    <select aria-label={`Nível de ${account.email ?? account.id}`} value={account.level}
                      disabled={Boolean(savingId)}
                      onChange={event => void changeAccess(account, event.target.value as WorkspaceLevel)}>
                      {Object.entries(levels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    {account.role === 'admin' && <span> · Administrador</span>}
                    {savingId === account.id && <span role="status"> Salvando…</span>}
                  </td>
                  <td><button className="secondary-button" type="button" onClick={() => setSelected(account)}>
                    Ver histórico ({account.changeCount})
                  </button></td>
                </tr>
              ))}
              {!result.users.length && <tr><td colSpan={3}>Nenhuma conta nesta página.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {selected && <ChangeHistory key={selected.id} account={selected} close={() => setSelected(undefined)} />}
      {(page > 1 || result?.hasNext) && (
        <div className="filter-bar">
          <button className="secondary-button" type="button" disabled={page === 1 || Boolean(savingId)}
            onClick={() => changePage(page - 1)}>Anterior</button>
          <span>Página {page}</span>
          <button className="secondary-button" type="button" disabled={!result?.hasNext || Boolean(savingId)}
            onClick={() => changePage(page + 1)}>Próxima</button>
        </div>
      )}
    </main>
  )
}

function ChangeHistory({ account, close }: { account: WorkspaceAccount; close: () => void }) {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ entries: WorkspaceChange[]; hasNext: boolean }>()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listWorkspaceChanges(account.id, page).then(data => {
      if (active) setResult(data)
    }).catch((error: Error) => {
      if (active) setError(error.message)
    })
    return () => { active = false }
  }, [account.id, page])

  function changePage(next: number) {
    setResult(undefined)
    setError('')
    setPage(next)
  }

  return (
    <section className="section-block">
      <h2>Histórico de {account.email ?? account.id}</h2>
      <button className="secondary-button" type="button" onClick={close}>Fechar histórico</button>
      {error && <p role="alert">{error}</p>}
      {!result && !error && <p role="status">Carregando histórico…</p>}
      {result?.entries.length === 0 && <p>Nenhum salvamento registrado.</p>}
      {result?.entries.map(entry => (
        <details key={entry.id}>
          <summary>{new Date(entry.created_at).toLocaleString('pt-BR')} · {entry.changes.length} anotações alteradas</summary>
          <p><a href={`/viewer/${encodeURIComponent(entry.page_id)}`}>Abrir página</a></p>
          {entry.changes.map(change => (
            <details key={change.id}>
              <summary>{change.before == null ? 'Adição' : change.after == null ? 'Remoção' : 'Edição'} · {change.id}</summary>
              <pre className="workspace-change-diff">{JSON.stringify({ antes: change.before, depois: change.after }, null, 2)}</pre>
            </details>
          ))}
        </details>
      ))}
      <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Anterior</button>
      <button type="button" disabled={!result?.hasNext} onClick={() => changePage(page + 1)}>Próxima</button>
    </section>
  )
}

function InterestManagement() {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ entries: TrainingInterest[]; hasNext: boolean }>()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!page) return
    let active = true
    listTrainingInterest(page).then(data => {
      if (active) setResult(data)
    }).catch((error: Error) => {
      if (active) setError(error.message)
    })
    return () => { active = false }
  }, [page])

  function changePage(nextPage: number) {
    setResult(undefined)
    setError('')
    setPage(nextPage)
  }

  return (
    <section className="admin-interest">
      <h2>Candidaturas para validar transcrições</h2>
      <p>Envie às pessoas selecionadas este link de cadastro. As contas começam no nível Videira.</p>
      <input aria-label="Link de cadastro para copiar" readOnly value={new URL('/cadastro', window.location.origin).href} />
      <button className="secondary-button" type="button" onClick={() => changePage(page ? 0 : 1)} aria-expanded={page > 0}>
        {page ? 'Ocultar candidaturas' : 'Ver candidaturas'}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {page > 0 && !result && !error && <p role="status">Carregando candidaturas…</p>}
      {result && (
        <div className="data-table">
          <table className="admin-accounts">
            <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Experiência</th><th scope="col">Recebida em</th></tr></thead>
            <tbody>
              {result.entries.map(entry => (
                <tr key={entry.email}>
                  <td>{entry.name}</td>
                  <td><a className="text-link" href={`mailto:${encodeURIComponent(entry.email)}`}>{entry.email}</a></td>
                  <td>{entry.experience || '—'}</td>
                  <td>{new Date(entry.submitted_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
              {!result.entries.length && <tr><td colSpan={4}>Nenhuma candidatura nesta página.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {result && (page > 1 || result.hasNext) && (
        <div className="filter-bar">
          <button className="secondary-button" type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Anterior</button>
          <span>Página {page}</span>
          <button className="secondary-button" type="button" disabled={!result.hasNext} onClick={() => changePage(page + 1)}>Próxima</button>
        </div>
      )}
    </section>
  )
}
