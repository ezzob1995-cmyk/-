import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import CourseList from './components/CourseList';
import CourseDetail from './components/CourseDetail';
import LessonView from './components/LessonView';
import AdminDashboard from './components/AdminDashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!profile) return <Navigate to="/" />;
  if (adminOnly && profile.role !== 'admin') return <Navigate to="/" />;

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<CourseList />} />
            <Route path="course/:courseId" element={<CourseDetail />} />
            <Route path="course/:courseId/lesson/:lessonId" element={<LessonView />} />
            <Route path="course/:courseId/unit/:unitId/lesson/:lessonId" element={<LessonView />} />
            <Route 
              path="admin" 
              element={
                <ProtectedRoute adminOnly>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
