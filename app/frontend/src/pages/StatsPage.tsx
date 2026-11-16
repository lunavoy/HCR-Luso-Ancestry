import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle2, FileText, RefreshCw, Type, Wand2 } from 'lucide-react'
import { apiDataService } from '../services/dataService'
import type { DashboardStats } from '../types/domain'

function pct(value: number | null | undefined): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`
}

function Card({ icon: Icon, label, value, hint }: {
  icon: typeof Type
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="stat-card">
      <Icon size={18} />
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint && <small className="stat-hint">{hint}</small>}
      </div>
    </div>
  )
}

export function StatsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    apiDataService.getDashboardStats()
      .then(setStats)
      .catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar estatísticas.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <main className="page-shell">
      <section className="page-heading heading-with-action">
        <div>
          <p className="eyebrow">Administrativo</p>
          <h1>Estatísticas de transcrição</h1>
          <p>Volume de correção humana e acurácia medida da IA sobre o que já foi revisado.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={load} type="button">
          <RefreshCw size={15} /> Atualizar
        </button>
      </section>

      {error && <p className="form-error">{error}</p>}
      {loading && !stats && <p className="confirm-empty">Carregando…</p>}

      {stats && (
        <>
          <section className="stats-grid" aria-label="Volume de trabalho">
            <Card icon={FileText} label="Linhas totais" value={String(stats.lines.total)}
              hint={`${stats.lines.verified} verificadas · ${stats.lines.pending} pendentes`} />
            <Card icon={CheckCircle2} label="Linhas revisadas por humano" value={String(stats.lines.verified)}
              hint={`${stats.lines.human_origin} com texto corrigido · ${stats.transcriptions.human} transcrições humanas`} />
            <Card icon={Type} label="Palavras totais" value={String(stats.words.total)}
              hint={`${stats.words.verified} verificadas · ${stats.words.pending} pendentes`} />
            <Card icon={Wand2} label="Confiança média da IA" value={pct(stats.transcriptions.avg_confidence)}
              hint={`${stats.transcriptions.htr} linhas lidas pelo Kraken`} />
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2>Acurácia da IA</h2>
                <p>Comparação entre o texto original do Kraken e a correção humana, em {stats.accuracy.sample_lines} linhas.</p>
              </div>
            </div>
            {stats.accuracy.sample_lines === 0 ? (
              <p className="confirm-empty">
                Ainda não há pares IA×humano medidos. O texto original da IA passa a ser preservado
                a partir das próximas correções (migration 021) — as linhas já verificadas antes
                disso não têm a referência da máquina.
              </p>
            ) : (
              <div className="stats-grid">
                <Card icon={BarChart3} label="Acertos exatos" value={pct(stats.accuracy.exact_match_rate)}
                  hint="linhas idênticas à saída da IA" />
                <Card icon={Type} label="Acurácia de caracteres" value={pct(stats.accuracy.char_accuracy)}
                  hint={stats.accuracy.mean_cer != null ? `CER médio ${(stats.accuracy.mean_cer * 100).toFixed(1)}%` : undefined} />
                <Card icon={FileText} label="Acurácia de palavras" value={pct(stats.accuracy.word_accuracy)}
                  hint={stats.accuracy.mean_wer != null ? `WER médio ${(stats.accuracy.mean_wer * 100).toFixed(1)}%` : undefined} />
              </div>
            )}
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2>Sugestões do léxico</h2>
                <p>Propostas automáticas aguardando ou já decididas por você.</p>
              </div>
            </div>
            <div className="stats-grid">
              <Card icon={Wand2} label="Pendentes" value={String(stats.suggestions.pending ?? 0)} />
              <Card icon={CheckCircle2} label="Aceitas" value={String(stats.suggestions.accepted ?? 0)} />
              <Card icon={FileText} label="Rejeitadas" value={String(stats.suggestions.rejected ?? 0)} />
              <Card icon={BarChart3} label="Auto-aplicadas" value={String(stats.suggestions.auto_applied ?? 0)} />
            </div>
          </section>
        </>
      )}
    </main>
  )
}
