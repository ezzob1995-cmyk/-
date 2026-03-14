import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Course, Unit, Lesson } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Play, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '../AuthContext';

const CourseDetail: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessonsByUnit, setLessonsByUnit] = useState<Record<string, Lesson[]>>({});
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!courseId || !profile) return;

    const fetchCourse = async () => {
      const docRef = doc(db, 'courses', courseId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCourse({ id: docSnap.id, ...docSnap.data() } as Course);
      }
    };

    fetchCourse();

    // Fetch user progress
    const progressQuery = query(collection(db, `users/${profile.uid}/progress`));
    const unsubscribeProgress = onSnapshot(progressQuery, (snapshot) => {
      const progressMap: Record<string, boolean> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.completed) {
          progressMap[data.lessonId] = true;
        }
      });
      setUserProgress(progressMap);
    });

    const unitsQuery = query(collection(db, `courses/${courseId}/units`), orderBy('order', 'asc'));
    const unsubscribeUnits = onSnapshot(unitsQuery, (snapshot) => {
      const unitData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      setUnits(unitData);
      
      // Initialize all units as expanded
      const initialExpanded: Record<string, boolean> = {};
      unitData.forEach(u => initialExpanded[u.id] = true);
      setExpandedUnits(initialExpanded);

      // Fetch lessons for each unit
      unitData.forEach(unit => {
        const lessonsQuery = query(collection(db, `courses/${courseId}/units/${unit.id}/lessons`), orderBy('order', 'asc'));
        onSnapshot(lessonsQuery, (lessonSnapshot) => {
          const lessonData = lessonSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
          setLessonsByUnit(prev => ({ ...prev, [unit.id]: lessonData }));
        });
      });
      
      setLoading(false);
    });

    return () => {
      unsubscribeUnits();
      unsubscribeProgress();
    };
  }, [courseId, profile]);

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  if (loading) return <div className="text-center py-20">جاري تحميل تفاصيل الكورس...</div>;
  if (!course) return <div className="text-center py-20 text-red-500 font-bold">الكورس غير موجود.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="space-y-6 text-center md:text-right">
        <div className="inline-block bg-[#5A5A40]/10 text-[#5A5A40] px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
          {course.category}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[#141414] leading-tight">
          {course.title}
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl ml-auto leading-relaxed">
          {course.description}
        </p>
      </header>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#141414] border-b border-black/5 pb-4">محتوى الكورس</h2>
        
        <div className="space-y-4">
          {units.map((unit, unitIndex) => {
            const unitLessons = lessonsByUnit[unit.id] || [];
            const completedCount = unitLessons.filter(l => userProgress[l.id]).length;
            const progressPercent = unitLessons.length > 0 ? Math.round((completedCount / unitLessons.length) * 100) : 0;

            return (
              <div key={unit.id} className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-sm">
                <div className="w-full">
                  <button 
                    onClick={() => toggleUnit(unit.id)}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-[#5A5A40]/5 flex items-center justify-center text-[#5A5A40] font-bold">
                        {unitIndex + 1}
                      </div>
                      <div className="text-right">
                        <h3 className="text-lg font-bold text-[#141414]">{unit.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 font-medium">{completedCount} من {unitLessons.length} دروس مكتملة</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-2 w-32">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            className="h-full bg-[#5A5A40]"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[#5A5A40] w-8">{progressPercent}%</span>
                      </div>
                      {expandedUnits[unit.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </button>
                  {/* Mobile Progress Bar */}
                  <div className="md:hidden h-1 bg-gray-50 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      className="h-full bg-[#5A5A40]/30"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {expandedUnits[unit.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 space-y-2">
                        {unitLessons.map((lesson, lessonIndex) => {
                          const isCompleted = userProgress[lesson.id];
                          return (
                            <Link 
                              key={lesson.id}
                              to={`/course/${courseId}/unit/${unit.id}/lesson/${lesson.id}`}
                              className={`group flex items-center justify-between p-4 rounded-2xl transition-all border ${isCompleted ? 'bg-green-50/30 border-green-100/50' : 'hover:bg-[#F5F5F0] border-transparent hover:border-[#5A5A40]/10'}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCompleted ? 'bg-green-500 text-white border-transparent' : 'bg-white border border-gray-200 text-gray-400 group-hover:bg-[#5A5A40] group-hover:text-white group-hover:border-transparent'}`}>
                                  {isCompleted ? <CheckCircle size={16} /> : lessonIndex + 1}
                                </div>
                                <span className={`font-medium transition-colors ${isCompleted ? 'text-green-700' : 'text-gray-700 group-hover:text-[#141414]'}`}>{lesson.title}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {isCompleted && <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">مكتمل</span>}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-400 group-hover:bg-[#5A5A40]/10 group-hover:text-[#5A5A40]'}`}>
                                  <Play size={14} fill="currentColor" />
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                        {unitLessons.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-4 italic">لا توجد دروس في هذه الوحدة بعد.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
