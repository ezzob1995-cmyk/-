import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LogOut, BookOpen, LayoutDashboard, User as UserIcon, Award } from 'lucide-react';

const Layout: React.FC = () => {
  const { profile, logout, login, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      <nav className="bg-white border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-2xl font-bold tracking-tight text-[#5A5A40]">
                EduSmart
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2 text-sm font-medium hover:text-[#5A5A40] transition-colors">
                  <BookOpen size={18} />
                  الكورسات
                </Link>
                {profile?.role === 'admin' && (
                  <Link to="/admin" className="flex items-center gap-2 text-sm font-medium hover:text-[#5A5A40] transition-colors">
                    <LayoutDashboard size={18} />
                    لوحة التحكم
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {profile ? (
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-bold text-[#5A5A40] flex items-center gap-1 uppercase tracking-wider">
                      <Award size={12} />
                      Level {profile.level} • {profile.totalXp} XP
                    </span>
                    <span className="text-sm font-medium">{profile.displayName}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-[#5A5A40] flex items-center justify-center text-white font-bold overflow-hidden border-2 border-white shadow-sm">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt={profile.displayName} referrerPolicy="no-referrer" />
                    ) : (
                      profile.displayName[0]
                    )}
                  </div>
                </div>
              ) : (
                <button 
                  onClick={login}
                  className="bg-[#5A5A40] text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-[#4A4A30] transition-all shadow-md active:scale-95"
                >
                  تسجيل الدخول
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
