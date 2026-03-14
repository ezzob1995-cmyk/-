import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Course } from '../types';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Book, ArrowRight } from 'lucide-react';

const CourseList: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(courseData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="text-center py-20">جاري تحميل الكورسات...</div>;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-[#141414]">مرحباً بك في EduSmart</h1>
        <p className="text-lg text-gray-600">اختر الكورس الذي ترغب في تعلمه اليوم وابدأ رحلتك التعليمية.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group bg-white rounded-3xl overflow-hidden border border-black/5 shadow-sm hover:shadow-xl transition-all duration-300"
          >
            <div className="aspect-video relative overflow-hidden bg-gray-100">
              {course.thumbnail ? (
                <img 
                  src={course.thumbnail} 
                  alt={course.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Book size={48} />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <span className="bg-white/90 backdrop-blur-sm text-[#5A5A40] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  {course.category || 'عام'}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-[#141414] group-hover:text-[#5A5A40] transition-colors">
                {course.title}
              </h3>
              <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">
                {course.description}
              </p>
              <Link 
                to={`/course/${course.id}`}
                className="inline-flex items-center gap-2 text-[#5A5A40] font-bold text-sm group-hover:translate-x-1 transition-transform"
              >
                ابدأ التعلم الآن
                <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
          <p className="text-gray-500">لا توجد كورسات متاحة حالياً. يرجى مراجعة لوحة التحكم لإضافة محتوى.</p>
        </div>
      )}
    </div>
  );
};

export default CourseList;
