import { Outlet } from 'react-router-dom';
import AdminSidebar from '../pages/AdminSidebar';
import LoanAdminSidebar from '../../loanAdmin/pages/loanAdminSidebar';
import SecretaryAdminSidebar from '../../secretaryAdmin/components/secretaryAdminSidebar';
import NotificationPrompt from '../../components/NotificationPrompt';


export default function AdminLayout() {
  const role = localStorage.getItem('adminRole');

  const renderSidebar = () => {
    if (role === 'loanAdmin') return <LoanAdminSidebar />;
    if (role === 'secretaryAdmin') return <SecretaryAdminSidebar />;
    return <AdminSidebar />;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#161922]">
      <div className="print:hidden shrink-0">
        {renderSidebar()}
      </div>
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 overflow-y-auto w-full h-full">
          <Outlet />
        </div>
      </main>
      <div className="print:hidden">
        <NotificationPrompt />
      </div>
    </div>
  );
}
