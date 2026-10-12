import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout