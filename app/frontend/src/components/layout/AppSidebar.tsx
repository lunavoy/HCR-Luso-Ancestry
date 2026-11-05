import {
  Archive,
  Atom,
  BookOpen,
  Bot,
  ChevronLeft,
  FileSearch,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../stores/useAppStore'

const navigation = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/collections', label: 'Coleções', icon: Archive },
  { to: '/documents', label: 'Documentos', icon: BookOpen },
  { to: '/annotations', label: 'Anotações', icon: FileSearch },
  { to: '/models', label: 'Modelos de IA', icon: Bot },
  { to: '/experiments', label: 'Experimentos', icon: Atom },
  { to: '/settings', label: 'Configurações', icon: Settings },
]

export function AppSidebar() {
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
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
            end={to === '/'}
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
