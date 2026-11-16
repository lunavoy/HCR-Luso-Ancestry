import {
  Archive,
  Atom,
  BarChart3,
  BookOpen,
  Bot,
  ChevronLeft,
  Clock3,
  FileSearch,
  Feather,
  LayoutDashboard,
  Map,
  MapPin,
  Settings,
  Shield,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../stores/useAppStore'
import { useWorkspaceRole } from '../auth/AuthProvider'

const navigation = [
  { to: '/workspace', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/collections', label: 'Coleções', icon: Archive },
  { to: '/documents', label: 'Documentos paroquiais', icon: BookOpen },
  { to: '/line-review', label: 'Correção rápida de linhas', icon: FileSearch },
  { to: '/validation', label: 'Validação', icon: FileSearch },
  { to: '/map', label: 'Mapa', icon: Map },
  { to: '/timeline', label: 'Timeline', icon: Clock3 },
  { to: '/places', label: 'Lugares', icon: MapPin },
  { to: '/scribes', label: 'Padres', icon: Feather },
  { to: '/stats', label: 'Estatísticas', icon: BarChart3 },
  { to: '/models', label: 'Modelos de IA', icon: Bot },
  { to: '/experiments', label: 'Experimentos', icon: Atom },
  { to: '/settings', label: 'Configurações', icon: Settings },
]

export function AppSidebar() {
  const role = useWorkspaceRole()
  const links = role === 'admin'
    ? [...navigation, { to: '/admin', label: 'Administração', icon: Shield }]
    : navigation.filter(link => link.to === '/documents' || link.to === '/line-review')
  const collapsed = useAppStore(state => state.sidebarCollapsed)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)

  return (
    <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">PH</div>
        {!collapsed && (
          <div>
            <strong>HTR Portuguese</strong>
            <span>Historical</span>
          </div>
        )}
      </div>
      <nav className="primary-nav" aria-label="Navegação principal">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
            end={to === '/workspace'}
            key={to}
            to={to}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} strokeWidth={1.8} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <button className="sidebar-toggle" onClick={toggleSidebar} type="button">
        <ChevronLeft size={17} />
        {!collapsed && <span>Recolher painel</span>}
      </button>
    </aside>
  )
}
