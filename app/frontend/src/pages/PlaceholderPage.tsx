import { Beaker, Bot, FileSearch, Settings } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

const content = {
  annotations: { title: 'Anotações', description: 'A fila global de revisão será conectada ao serviço de tarefas do backend.', icon: FileSearch },
  models: { title: 'Modelos de IA', description: 'Os modelos Kraken e PyTorch serão geridos no backend, nunca no navegador.', icon: Bot },
  experiments: { title: 'Experimentos de treinamento', description: 'Esta área acompanhará execuções, métricas e versões dos conjuntos de dados.', icon: Beaker },
  settings: { title: 'Configurações', description: 'Preferências do espaço de trabalho e integrações futuras serão centralizadas aqui.', icon: Settings },
}

export function PlaceholderPage({ page }: { page: keyof typeof content }) {
  const item = content[page]
  const Icon = item.icon
  return <main className="page-shell placeholder-page"><EmptyState icon={<Icon size={28} />} title={item.title} description={item.description} /></main>
}
