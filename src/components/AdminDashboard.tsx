import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { Course, Unit, Lesson, Activity } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  Save, 
  X, 
  Sparkles, 
  ChevronUp, 
  ChevronDown, 
  Upload,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Wand2,
  FileText,
  Layers
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [newCourse, setNewCourse] = useState({ title: '', description: '', category: '', thumbnail: '' });

  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitTitle, setUnitTitle] = useState('');

  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');

  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [newActivity, setNewActivity] = useState({ title: '', type: 'quiz' as any, url: '', data: '' });
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: string, id: string} | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkJson, setBulkJson] = useState('');
  const [importError, setImportError] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const insertMarkdown = (type: string) => {
    if (!selectedLesson) return;
    const textarea = document.getElementById('lesson-content-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = selectedLesson.content;
    let before = text.substring(0, start);
    let after = text.substring(end);
    let selection = text.substring(start, end);
    let insertion = '';

    switch (type) {
      case 'bold': insertion = `**${selection || 'نص عريض'}**`; break;
      case 'italic': insertion = `*${selection || 'نص مائل'}*`; break;
      case 'list': insertion = `\n- ${selection || 'عنصر قائمة'}`; break;
      case 'link': insertion = `[${selection || 'نص الرابط'}](https://example.com)`; break;
      case 'image': insertion = `![${selection || 'وصف الصورة'}](رابط_الصورة)`; break;
      case 'code': insertion = `\n\`\`\`\n${selection || 'كود برمجى'}\n\`\`\`\n`; break;
    }

    const newContent = before + insertion + after;
    setSelectedLesson({ ...selectedLesson, content: newContent });
    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? { ...l, content: newContent } : l));
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  const generateSmartSummary = async () => {
    if (!selectedLesson?.content) return;
    setIsGeneratingSummary(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `قم بتلخيص المحتوى التعليمي التالي بإيجاز شديد (في جملتين أو ثلاث) ليكون ملخصاً ذكياً للدرس:\n\n${selectedLesson.content}`,
      });
      
      const summary = response.text || '';
      setSelectedLesson(prev => prev ? { ...prev, summary } : null);
      setLessons(prev => prev.map(l => l.id === selectedLesson.id ? { ...l, summary } : l));
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const textArea = e.currentTarget;
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;

    // Handle Images
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const imageMarkdown = `\n![صورة ملصقة](${base64})\n`;
            const newContent = selectedLesson!.content.substring(0, start) + imageMarkdown + selectedLesson!.content.substring(end);
            setSelectedLesson(prev => prev ? { ...prev, content: newContent } : null);
            setLessons(prev => prev.map(l => l.id === selectedLesson!.id ? { ...l, content: newContent } : l));
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }

    // Handle Tables (HTML from Excel/Word)
    const html = e.clipboardData.getData('text/html');
    if (html && html.includes('<table')) {
      e.preventDefault();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const table = doc.querySelector('table');
      if (table) {
        let markdownTable = '\n';
        const rows = Array.from(table.querySelectorAll('tr'));
        
        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          const cellTexts = cells.map(cell => cell.textContent?.trim().replace(/\|/g, '\\|') || '');
          markdownTable += `| ${cellTexts.join(' | ')} |\n`;
          
          if (rowIndex === 0) {
            markdownTable += `| ${cells.map(() => '---').join(' | ')} |\n`;
          }
        });
        
        const newContent = selectedLesson!.content.substring(0, start) + markdownTable + selectedLesson!.content.substring(end);
        setSelectedLesson(prev => prev ? { ...prev, content: newContent } : null);
        setLessons(prev => prev.map(l => l.id === selectedLesson!.id ? { ...l, content: newContent } : l));
        return;
      }
    }

    // Handle Tab-Separated Values (Plain text from Excel)
    const text = e.clipboardData.getData('text/plain');
    if (text.includes('\t') && text.includes('\n')) {
      e.preventDefault();
      const rows = text.trim().split('\n');
      let markdownTable = '\n';
      
      rows.forEach((row, rowIndex) => {
        const cells = row.split('\t');
        markdownTable += `| ${cells.join(' | ')} |\n`;
        if (rowIndex === 0) {
          markdownTable += `| ${cells.map(() => '---').join(' | ')} |\n`;
        }
      });

      const newContent = selectedLesson!.content.substring(0, start) + markdownTable + selectedLesson!.content.substring(end);
      setSelectedLesson(prev => prev ? { ...prev, content: newContent } : null);
      setLessons(prev => prev.map(l => l.id === selectedLesson!.id ? { ...l, content: newContent } : l));
      return;
    }
  };

  // Fetch Courses
  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });
  }, []);

  // Fetch Units when course selected
  useEffect(() => {
    if (!selectedCourse) {
      setUnits([]);
      setSelectedUnit(null);
      return;
    }
    const q = query(collection(db, `courses/${selectedCourse.id}/units`), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
    });
  }, [selectedCourse]);

  // Fetch Lessons when unit selected
  useEffect(() => {
    if (!selectedCourse || !selectedUnit) {
      setLessons([]);
      setSelectedLesson(null);
      return;
    }
    const q = query(collection(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons`), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setLessons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson)));
    });
  }, [selectedCourse, selectedUnit]);

  // Fetch Activities when lesson selected
  useEffect(() => {
    if (!selectedCourse || !selectedUnit || !selectedLesson) {
      setActivities([]);
      return;
    }
    const q = query(collection(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons/${selectedLesson.id}/activities`), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    });
  }, [selectedCourse, selectedUnit, selectedLesson]);

  const handleSaveCourse = async () => {
    if (!newCourse.title) return;
    if (editingCourse) {
      await updateDoc(doc(db, 'courses', editingCourse.id), {
        ...newCourse
      });
    } else {
      await addDoc(collection(db, 'courses'), {
        ...newCourse,
        createdAt: serverTimestamp()
      });
    }
    setNewCourse({ title: '', description: '', category: '', thumbnail: '' });
    setIsAddingCourse(false);
    setEditingCourse(null);
  };

  const handleSaveUnit = async () => {
    if (!selectedCourse || !unitTitle) return;
    if (editingUnit) {
      await updateDoc(doc(db, `courses/${selectedCourse.id}/units`, editingUnit.id), {
        title: unitTitle
      });
    } else {
      await addDoc(collection(db, `courses/${selectedCourse.id}/units`), {
        courseId: selectedCourse.id,
        title: unitTitle,
        order: units.length + 1
      });
    }
    setUnitTitle('');
    setIsAddingUnit(false);
    setEditingUnit(null);
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse || !selectedUnit || !lessonTitle) return;
    if (editingLesson) {
      await updateDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons`, editingLesson.id), {
        title: lessonTitle
      });
    } else {
      await addDoc(collection(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons`), {
        unitId: selectedUnit.id,
        courseId: selectedCourse.id,
        title: lessonTitle,
        content: 'محتوى الدرس الجديد...',
        summary: 'ملخص الدرس...',
        order: lessons.length + 1
      });
    }
    setLessonTitle('');
    setIsAddingLesson(false);
    setEditingLesson(null);
  };

  const handleSaveActivity = async () => {
    if (!selectedCourse || !selectedUnit || !selectedLesson || !newActivity.title) return;
    
    let finalData = newActivity.data;
    if (newActivity.type === 'quiz' && quizQuestions.length > 0) {
      finalData = JSON.stringify({ questions: quizQuestions });
    }

    if (editingActivity) {
      await updateDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons/${selectedLesson.id}/activities`, editingActivity.id), {
        title: newActivity.title,
        type: newActivity.type,
        url: newActivity.url,
        data: finalData
      });
    } else {
      await addDoc(collection(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons/${selectedLesson.id}/activities`), {
        lessonId: selectedLesson.id,
        unitId: selectedUnit.id,
        courseId: selectedCourse.id,
        title: newActivity.title,
        type: newActivity.type,
        url: newActivity.url,
        data: finalData,
        order: activities.length + 1
      });
    }
    setNewActivity({ title: '', type: 'quiz', url: '', data: '' });
    setQuizQuestions([]);
    setIsAddingActivity(false);
    setEditingActivity(null);
  };

  const addQuizQuestion = (type: 'mcq' | 'tf') => {
    if (type === 'mcq') {
      setQuizQuestions([...quizQuestions, { 
        type: 'mcq', 
        question: '', 
        options: ['', ''], 
        correctIndex: 0, 
        explanationCorrect: '', 
        explanationIncorrect: '' 
      }]);
    } else {
      setQuizQuestions([...quizQuestions, { 
        type: 'tf', 
        question: '', 
        correctAnswer: true, 
        explanation: '' 
      }]);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!selectedCourse || !selectedUnit || !selectedLesson) return;
    await deleteDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons/${selectedLesson.id}/activities`, id));
  };

  const handleDeleteUnit = async (id: string) => {
    if (!selectedCourse) return;
    await deleteDoc(doc(db, `courses/${selectedCourse.id}/units`, id));
    if (selectedUnit?.id === id) setSelectedUnit(null);
  };

  const handleDeleteLesson = async (id: string) => {
    if (!selectedCourse || !selectedUnit) return;
    await deleteDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons`, id));
    if (selectedLesson?.id === id) setSelectedLesson(null);
  };

  const handleDeleteCourse = async (id: string) => {
    await deleteDoc(doc(db, 'courses', id));
    if (selectedCourse?.id === id) setSelectedCourse(null);
  };

  const handleMoveUnit = async (unit: Unit, direction: 'up' | 'down') => {
    if (!selectedCourse) return;
    const currentIndex = units.findIndex(u => u.id === unit.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= units.length) return;
    const targetUnit = units[targetIndex];
    const tempOrder = unit.order;
    await Promise.all([
      updateDoc(doc(db, `courses/${selectedCourse.id}/units`, unit.id), { order: targetUnit.order }),
      updateDoc(doc(db, `courses/${selectedCourse.id}/units`, targetUnit.id), { order: tempOrder })
    ]);
  };

  const handleMoveLesson = async (lesson: Lesson, direction: 'up' | 'down') => {
    if (!selectedCourse || !selectedUnit) return;
    const currentIndex = lessons.findIndex(l => l.id === lesson.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;
    const targetLesson = lessons[targetIndex];
    const tempOrder = lesson.order;
    await Promise.all([
      updateDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons`, lesson.id), { order: targetLesson.order }),
      updateDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons`, targetLesson.id), { order: tempOrder })
    ]);
  };

  const handleMoveActivity = async (activity: Activity, direction: 'up' | 'down') => {
    if (!selectedCourse || !selectedUnit || !selectedLesson) return;
    const currentIndex = activities.findIndex(a => a.id === activity.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= activities.length) return;
    const targetActivity = activities[targetIndex];
    const tempOrder = activity.order;
    await Promise.all([
      updateDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons/${selectedLesson.id}/activities`, activity.id), { order: targetActivity.order }),
      updateDoc(doc(db, `courses/${selectedCourse.id}/units/${selectedUnit.id}/lessons/${selectedLesson.id}/activities`, targetActivity.id), { order: tempOrder })
    ]);
  };

  const handleBulkImport = async () => {
    if (!selectedCourse || !bulkJson) return;
    try {
      const data = JSON.parse(bulkJson);
      if (!Array.isArray(data)) throw new Error('يجب أن يكون الإدخال مصفوفة من الوحدات');

      for (const unitData of data) {
        const unitRef = await addDoc(collection(db, `courses/${selectedCourse.id}/units`), {
          courseId: selectedCourse.id,
          title: unitData.title,
          order: units.length + 1
        });

        if (unitData.lessons && Array.isArray(unitData.lessons)) {
          for (let i = 0; i < unitData.lessons.length; i++) {
            const lessonData = unitData.lessons[i];
            await addDoc(collection(db, `courses/${selectedCourse.id}/units/${unitRef.id}/lessons`), {
              unitId: unitRef.id,
              courseId: selectedCourse.id,
              title: lessonData.title,
              content: lessonData.content || 'محتوى الدرس...',
              summary: lessonData.summary || 'ملخص الدرس...',
              order: i + 1
            });
          }
        }
      }
      setIsBulkImporting(false);
      setBulkJson('');
      setImportError('');
    } catch (e: any) {
      setImportError(e.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">لوحة التحكم الإدارية</h1>
        <div className="flex gap-2">
          {selectedCourse && (
            <button 
              onClick={() => setIsBulkImporting(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Upload size={20} />
              استيراد دفعة واحدة
            </button>
          )}
          <button 
            onClick={() => setIsAddingCourse(true)}
            className="bg-[#5A5A40] text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={20} />
            إضافة كورس جديد
          </button>
        </div>
      </div>

      {isBulkImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold">استيراد وحدات ودروس دفعة واحدة</h3>
              <button onClick={() => setIsBulkImporting(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-gray-500">قم بلصق هيكل JSON للوحدات والدروس. مثال:</p>
            <pre className="bg-gray-50 p-4 rounded-xl text-[10px] overflow-x-auto text-left" dir="ltr">
{`[
  {
    "title": "الوحدة الأولى",
    "lessons": [
      { "title": "الدرس الأول", "content": "محتوى...", "summary": "ملخص..." }
    ]
  }
]`}
            </pre>
            <textarea 
              className="w-full h-64 p-4 border rounded-2xl font-mono text-sm"
              placeholder="الصق الـ JSON هنا..."
              value={bulkJson}
              onChange={e => setBulkJson(e.target.value)}
              dir="ltr"
            />
            {importError && <p className="text-red-500 text-sm">{importError}</p>}
            <div className="flex gap-4">
              <button 
                onClick={handleBulkImport}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                بدء الاستيراد
              </button>
              <button 
                onClick={() => setIsBulkImporting(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {(isAddingCourse || editingCourse) && (
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-lg space-y-4">
          <h3 className="font-bold">{editingCourse ? 'تعديل الكورس' : 'إضافة كورس جديد'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <input 
              placeholder="عنوان الكورس" 
              className="p-2 border rounded"
              value={newCourse.title}
              onChange={e => setNewCourse({...newCourse, title: e.target.value})}
            />
            <input 
              placeholder="التصنيف" 
              className="p-2 border rounded"
              value={newCourse.category}
              onChange={e => setNewCourse({...newCourse, category: e.target.value})}
            />
          </div>
          <textarea 
            placeholder="الوصف" 
            className="w-full p-2 border rounded"
            value={newCourse.description}
            onChange={e => setNewCourse({...newCourse, description: e.target.value})}
          />
          <input 
            placeholder="رابط الصورة (Thumbnail URL)" 
            className="w-full p-2 border rounded"
            value={newCourse.thumbnail}
            onChange={e => setNewCourse({...newCourse, thumbnail: e.target.value})}
          />
          <div className="flex gap-2">
            <button onClick={handleSaveCourse} className="bg-green-600 text-white px-4 py-2 rounded">حفظ</button>
            <button onClick={() => { setIsAddingCourse(false); setEditingCourse(null); setNewCourse({ title: '', description: '', category: '', thumbnail: '' }); }} className="bg-gray-200 px-4 py-2 rounded">إلغاء</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Courses Column */}
        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-4">
          <h3 className="font-bold border-b pb-2">الكورسات</h3>
          <div className="space-y-2">
            {courses.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCourse(c)}
                className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all ${selectedCourse?.id === c.id ? 'bg-[#5A5A40] text-white' : 'hover:bg-gray-50'}`}
              >
                <span className="truncate">{c.title}</span>
                <div className="flex gap-1">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingCourse(c);
                      setNewCourse({ title: c.title, description: c.description || '', category: c.category || '', thumbnail: c.thumbnail || '' });
                      setIsAddingCourse(false);
                    }} 
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  {deleteConfirm?.id === c.id ? (
                    <div className="flex gap-2 items-center bg-red-50 px-2 py-1 rounded-lg">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCourse(c.id); setDeleteConfirm(null); }} className="text-red-600 font-bold text-xs">حذف</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="text-gray-400 text-xs">إلغاء</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({type: 'course', id: c.id}); }} className="text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Units Column */}
        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold">الوحدات</h3>
            {selectedCourse && (
              <button 
                onClick={() => setIsAddingUnit(!isAddingUnit)} 
                className="text-[#5A5A40] hover:bg-gray-100 p-1 rounded transition-colors"
              >
                {isAddingUnit ? <X size={18} /> : <Plus size={18} />}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(isAddingUnit || editingUnit) && (
              <div className="p-2 border rounded-xl space-y-2 bg-gray-50 animate-in fade-in slide-in-from-top-1">
                <input 
                  autoFocus
                  placeholder="اسم الوحدة..." 
                  className="w-full p-2 text-sm border rounded bg-white"
                  value={unitTitle}
                  onChange={e => setUnitTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveUnit()}
                />
                <div className="flex gap-1">
                  <button onClick={handleSaveUnit} className="flex-1 bg-[#5A5A40] text-white text-xs py-1.5 rounded font-bold">حفظ</button>
                  <button onClick={() => { setIsAddingUnit(false); setEditingUnit(null); setUnitTitle(''); }} className="flex-1 bg-gray-200 text-xs py-1.5 rounded">إلغاء</button>
                </div>
              </div>
            )}
            {units.map(u => (
              <div 
                key={u.id} 
                onClick={() => setSelectedUnit(u)}
                className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all ${selectedUnit?.id === u.id ? 'bg-[#5A5A40] text-white' : 'hover:bg-gray-50'}`}
              >
                <span className="truncate">{u.title}</span>
                <div className="flex gap-1">
                  <div className="flex flex-col">
                    <button onClick={(e) => { e.stopPropagation(); handleMoveUnit(u, 'up'); }} className="text-gray-400 hover:text-gray-600"><ChevronUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleMoveUnit(u, 'down'); }} className="text-gray-400 hover:text-gray-600"><ChevronDown size={12} /></button>
                  </div>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingUnit(u);
                      setUnitTitle(u.title);
                      setIsAddingUnit(false);
                    }} 
                    className={`${selectedUnit?.id === u.id ? 'text-white' : 'text-blue-400'} hover:opacity-80`}
                  >
                    <Edit2 size={14} />
                  </button>
                  {deleteConfirm?.id === u.id ? (
                    <div className="flex gap-2 items-center bg-red-50 px-2 py-1 rounded-lg">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteUnit(u.id); setDeleteConfirm(null); }} className="text-red-600 font-bold text-[10px]">حذف</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="text-gray-400 text-[10px]">إلغاء</button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setDeleteConfirm({type: 'unit', id: u.id});
                      }} 
                      className={`${selectedUnit?.id === u.id ? 'text-white' : 'text-red-400'} hover:opacity-80`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!selectedCourse && <p className="text-xs text-gray-400 text-center">اختر كورس أولاً</p>}
          </div>
        </div>

        {/* Lessons Column */}
        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold">الدروس</h3>
            {selectedUnit && (
              <button 
                onClick={() => setIsAddingLesson(!isAddingLesson)} 
                className="text-[#5A5A40] hover:bg-gray-100 p-1 rounded transition-colors"
              >
                {isAddingLesson ? <X size={18} /> : <Plus size={18} />}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(isAddingLesson || editingLesson) && (
              <div className="p-2 border rounded-xl space-y-2 bg-gray-50 animate-in fade-in slide-in-from-top-1">
                <input 
                  autoFocus
                  placeholder="عنوان الدرس..." 
                  className="w-full p-2 text-sm border rounded bg-white"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveLesson()}
                />
                <div className="flex gap-1">
                  <button onClick={handleSaveLesson} className="flex-1 bg-[#5A5A40] text-white text-xs py-1.5 rounded font-bold">حفظ</button>
                  <button onClick={() => { setIsAddingLesson(false); setEditingLesson(null); setLessonTitle(''); }} className="flex-1 bg-gray-200 text-xs py-1.5 rounded">إلغاء</button>
                </div>
              </div>
            )}
            {lessons.map(l => (
              <div 
                key={l.id} 
                onClick={() => setSelectedLesson(l)}
                className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all ${selectedLesson?.id === l.id ? 'bg-[#5A5A40] text-white' : 'hover:bg-gray-50'}`}
              >
                <span className="truncate">{l.title}</span>
                <div className="flex gap-1">
                  <div className="flex flex-col">
                    <button onClick={(e) => { e.stopPropagation(); handleMoveLesson(l, 'up'); }} className="text-gray-400 hover:text-gray-600"><ChevronUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleMoveLesson(l, 'down'); }} className="text-gray-400 hover:text-gray-600"><ChevronDown size={12} /></button>
                  </div>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingLesson(l);
                      setLessonTitle(l.title);
                      setIsAddingLesson(false);
                    }} 
                    className={`${selectedLesson?.id === l.id ? 'text-white' : 'text-blue-400'} hover:opacity-80`}
                  >
                    <Edit2 size={14} />
                  </button>
                  {deleteConfirm?.id === l.id ? (
                    <div className="flex gap-2 items-center bg-red-50 px-2 py-1 rounded-lg">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteLesson(l.id); setDeleteConfirm(null); }} className="text-red-600 font-bold text-[10px]">حذف</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="text-gray-400 text-[10px]">إلغاء</button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setDeleteConfirm({type: 'lesson', id: l.id});
                      }} 
                      className={`${selectedLesson?.id === l.id ? 'text-white' : 'text-red-400'} hover:opacity-80`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!selectedUnit && <p className="text-xs text-gray-400 text-center">اختر وحدة أولاً</p>}
          </div>
        </div>

        {/* Activities Column */}
        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold">الفعاليات</h3>
            {selectedLesson && (
              <button 
                onClick={() => setIsAddingActivity(!isAddingActivity)} 
                className="text-[#5A5A40] hover:bg-gray-100 p-1 rounded transition-colors"
              >
                {isAddingActivity ? <X size={18} /> : <Plus size={18} />}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(isAddingActivity || editingActivity) && (
              <div className="p-2 border rounded-xl space-y-2 bg-gray-50 animate-in fade-in slide-in-from-top-1">
                <input 
                  placeholder="عنوان الفعالية..." 
                  className="w-full p-2 text-sm border rounded bg-white"
                  value={newActivity.title}
                  onChange={e => setNewActivity({...newActivity, title: e.target.value})}
                />
                <select 
                  className="w-full p-2 text-sm border rounded bg-white"
                  value={newActivity.type}
                  onChange={e => setNewActivity({...newActivity, type: e.target.value as any})}
                >
                  <option value="quiz">اختبار</option>
                  <option value="game">لعبة تعليمية</option>
                  <option value="video">فيديو</option>
                  <option value="audio">صوت</option>
                </select>
                <input 
                  placeholder="رابط (اختياري)..." 
                  className="w-full p-2 text-sm border rounded bg-white"
                  value={newActivity.url}
                  onChange={e => setNewActivity({...newActivity, url: e.target.value})}
                />

                {newActivity.type === 'quiz' && (
                  <div className="space-y-4 border-t pt-4 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">أسئلة الاختبار:</span>
                      <div className="flex gap-1">
                        <button onClick={() => addQuizQuestion('mcq')} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">MCQ</button>
                        <button onClick={() => addQuizQuestion('tf')} className="text-[10px] bg-green-50 text-green-600 px-2 py-1 rounded border border-green-100">T/F</button>
                      </div>
                    </div>
                    
                    {quizQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="p-3 bg-white border rounded-xl space-y-3 text-xs relative">
                        <button 
                          onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== qIdx))}
                          className="absolute top-2 left-2 text-red-400"
                        >
                          <X size={14} />
                        </button>
                        
                        <input 
                          placeholder="نص السؤال..." 
                          className="w-full p-1.5 border rounded"
                          value={q.question}
                          onChange={e => {
                            const newQs = [...quizQuestions];
                            newQs[qIdx].question = e.target.value;
                            setQuizQuestions(newQs);
                          }}
                        />

                        {q.type === 'mcq' ? (
                          <div className="space-y-2">
                            {q.options.map((opt: string, oIdx: number) => (
                              <div key={oIdx} className="flex gap-2 items-center">
                                <input 
                                  type="radio" 
                                  name={`correct-${qIdx}`}
                                  checked={q.correctIndex === oIdx}
                                  onChange={() => {
                                    const newQs = [...quizQuestions];
                                    newQs[qIdx].correctIndex = oIdx;
                                    setQuizQuestions(newQs);
                                  }}
                                />
                                <input 
                                  placeholder={`خيار ${oIdx + 1}`} 
                                  className="flex-1 p-1 border rounded"
                                  value={opt}
                                  onChange={e => {
                                    const newQs = [...quizQuestions];
                                    newQs[qIdx].options[oIdx] = e.target.value;
                                    setQuizQuestions(newQs);
                                  }}
                                />
                                {q.options.length > 2 && (
                                  <button onClick={() => {
                                    const newQs = [...quizQuestions];
                                    newQs[qIdx].options = q.options.filter((_: any, i: number) => i !== oIdx);
                                    setQuizQuestions(newQs);
                                  }} className="text-red-300">×</button>
                                )}
                              </div>
                            ))}
                            <button 
                              onClick={() => {
                                const newQs = [...quizQuestions];
                                newQs[qIdx].options.push('');
                                setQuizQuestions(newQs);
                              }}
                              className="text-blue-500 text-[10px]"
                            >
                              + إضافة خيار
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <input 
                                placeholder="شرح الإجابة الصحيحة" 
                                className="p-1.5 border rounded bg-green-50"
                                value={q.explanationCorrect}
                                onChange={e => {
                                  const newQs = [...quizQuestions];
                                  newQs[qIdx].explanationCorrect = e.target.value;
                                  setQuizQuestions(newQs);
                                }}
                              />
                              <input 
                                placeholder="شرح الإجابة الخاطئة" 
                                className="p-1.5 border rounded bg-red-50"
                                value={q.explanationIncorrect}
                                onChange={e => {
                                  const newQs = [...quizQuestions];
                                  newQs[qIdx].explanationIncorrect = e.target.value;
                                  setQuizQuestions(newQs);
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-1">
                                <input 
                                  type="radio" 
                                  name={`correct-${qIdx}`}
                                  checked={q.correctAnswer === true}
                                  onChange={() => {
                                    const newQs = [...quizQuestions];
                                    newQs[qIdx].correctAnswer = true;
                                    setQuizQuestions(newQs);
                                  }}
                                /> صح
                              </label>
                              <label className="flex items-center gap-1">
                                <input 
                                  type="radio" 
                                  name={`correct-${qIdx}`}
                                  checked={q.correctAnswer === false}
                                  onChange={() => {
                                    const newQs = [...quizQuestions];
                                    newQs[qIdx].correctAnswer = false;
                                    setQuizQuestions(newQs);
                                  }}
                                /> خطأ
                              </label>
                            </div>
                            <input 
                              placeholder="شرح الإجابة الصحيحة" 
                              className="w-full p-1.5 border rounded bg-green-50"
                              value={q.explanation}
                              onChange={e => {
                                const newQs = [...quizQuestions];
                                newQs[qIdx].explanation = e.target.value;
                                setQuizQuestions(newQs);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1">
                  <button onClick={handleSaveActivity} className="flex-1 bg-[#5A5A40] text-white text-xs py-1.5 rounded font-bold">حفظ</button>
                  <button onClick={() => { setIsAddingActivity(false); setEditingActivity(null); setNewActivity({ title: '', type: 'quiz', url: '', data: '' }); setQuizQuestions([]); }} className="flex-1 bg-gray-200 text-xs py-1.5 rounded">إلغاء</button>
                </div>
              </div>
            )}
            {activities.map(a => (
              <div key={a.id} className="p-3 rounded-xl bg-gray-50 flex justify-between items-center group">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate">{a.title}</span>
                  <span className="text-[10px] text-gray-400 uppercase">{a.type}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <div className="flex flex-col">
                    <button onClick={(e) => { e.stopPropagation(); handleMoveActivity(a, 'up'); }} className="text-gray-400 hover:text-gray-600"><ChevronUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleMoveActivity(a, 'down'); }} className="text-gray-400 hover:text-gray-600"><ChevronDown size={12} /></button>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingActivity(a);
                      setNewActivity({ title: a.title, type: a.type, url: a.url || '', data: a.data || '' });
                      if (a.type === 'quiz' && a.data) {
                        try {
                          const parsed = JSON.parse(a.data);
                          setQuizQuestions(parsed.questions || []);
                        } catch (e) {
                          setQuizQuestions([]);
                        }
                      }
                      setIsAddingActivity(false);
                    }}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <Edit2 size={14} />
                  </button>
                  {deleteConfirm?.id === a.id ? (
                    <div className="flex gap-2 items-center bg-red-50 px-2 py-1 rounded-lg">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteActivity(a.id); setDeleteConfirm(null); }} className="text-red-600 font-bold text-[10px]">حذف</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="text-gray-400 text-[10px]">إلغاء</button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({type: 'activity', id: a.id}); }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!selectedLesson && <p className="text-xs text-gray-400 text-center">اختر درس أولاً</p>}
          </div>
        </div>
      </div>

      {selectedLesson && (
        <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm space-y-6">
          <h3 className="text-xl font-bold">تعديل محتوى الدرس: {selectedLesson.title}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-black/5">
            <div className="col-span-1">
              <label className="block text-sm font-bold mb-2">طريقة العرض</label>
              <select 
                className="w-full p-2 border rounded-xl bg-white"
                value={selectedLesson.displayMode || 'standard'}
                onChange={e => {
                  const mode = e.target.value as any;
                  setSelectedLesson(prev => prev ? {...prev, displayMode: mode} : null);
                  setLessons(prev => prev.map(l => l.id === selectedLesson.id ? {...l, displayMode: mode} : l));
                }}
              >
                <option value="standard">شرح قياسي (نص)</option>
                <option value="flashcards">بطاقات تعليمية</option>
                <option value="mindmap">مخطط هيكلي</option>
                <option value="interactive_journey">رحلة تعليمية تفاعلية (مراحل)</option>
              </select>
            </div>
            <div className="col-span-2">
              <div className="bg-white p-4 rounded-xl border border-black/5 text-xs space-y-3">
                <h4 className="font-bold text-[#5A5A40] flex items-center gap-1">
                  <Sparkles size={14} />
                  دليل تنسيق المحتوى:
                </h4>
                
                {selectedLesson.displayMode === 'standard' && (
                  <div className="space-y-2 leading-relaxed">
                    <p><strong>١. الشرح النصي:</strong> استخدم تنسيق Markdown العادي (عناوين، قوائم، روابط).</p>
                    <p><strong>٢. الجداول:</strong> استخدم <code>|</code> للفصل بين الأعمدة و <code>---</code> للرأس.</p>
                    <p><strong>٣. الصور:</strong> <code>![وصف](رابط_الصورة)</code></p>
                    <p><strong>٤. الكتل التفاعلية (الدمج):</strong></p>
                    <ul className="list-disc list-inside pr-2 space-y-1 text-gray-500">
                      <li>لبدء بطاقات: <code className="bg-gray-100 px-1">:::flashcards</code></li>
                      <li>لبدء مخطط: <code className="bg-gray-100 px-1">:::mindmap</code></li>
                      <li>لبدء صوت: <code className="bg-gray-100 px-1">:::audio</code></li>
                      <li>لبدء فيديو: <code className="bg-gray-100 px-1">:::video</code></li>
                      <li>لبدء ملف: <code className="bg-gray-100 px-1">:::file</code></li>
                      <li>لبدء ملاحظة: <code className="bg-gray-100 px-1">:::note</code></li>
                      <li>لبدء لومدة HTML: <code className="bg-gray-100 px-1">:::html</code></li>
                      <li>للإنهاء: <code className="bg-gray-100 px-1">:::</code></li>
                    </ul>
                  </div>
                )}

                {selectedLesson.displayMode === 'flashcards' && (
                  <div className="space-y-2 leading-relaxed">
                    <p><strong>طريقة البطاقات:</strong> سيظهر المحتوى بالكامل كبطاقات تعليمية متتالية.</p>
                    <p><strong>التنسيق:</strong></p>
                    <ul className="list-disc list-inside pr-2 text-gray-500">
                      <li>السطر الأول: وجه البطاقة (السؤال).</li>
                      <li>الأسطر التالية: ظهر البطاقة (الإجابة/الشرح).</li>
                      <li>استخدم <code>---</code> للفصل بين كل بطاقة وأخرى.</li>
                    </ul>
                  </div>
                )}

                {selectedLesson.displayMode === 'mindmap' && (
                  <div className="space-y-2 leading-relaxed">
                    <p><strong>طريقة المخطط:</strong> سيتحول النص إلى مخطط شجري تفاعلي.</p>
                    <p><strong>التنسيق:</strong> استخدم القوائم المنقطة المتداخلة:</p>
                    <pre className="bg-gray-100 p-2 rounded mt-1 dir-ltr text-left">
                      - العنوان الرئيسي{'\n'}
                      {'  '}- فكرة فرعية ١{'\n'}
                      {'    '}- تفصيل أ{'\n'}
                      {'  '}- فكرة فرعية ٢
                    </pre>
                  </div>
                )}

                {selectedLesson.displayMode === 'interactive_journey' && (
                  <div className="space-y-2 leading-relaxed">
                    <p><strong>الرحلة التفاعلية:</strong> أفضل طريقة للتعلم! تقسم الدرس إلى مراحل يمر بها الطالب.</p>
                    <p><strong>التنسيق:</strong></p>
                    <ul className="list-disc list-inside pr-2 text-gray-500">
                      <li>اكتب محتوى كل مرحلة بشكل طبيعي.</li>
                      <li>استخدم <code>===</code> للفصل بين المراحل.</li>
                      <li>يمكنك استخدام الجداول، الصور، البطاقات، والمخططات داخل كل مرحلة!</li>
                    </ul>
                  </div>
                )}

                <div className="pt-2 mt-2 border-t border-black/5 text-[#5A5A40] font-medium">
                  <p>💡 نصيحة: يمكنك نسخ الجداول من Excel أو الصور ولصقها مباشرة هنا!</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm border-black/5">
              {/* Editor Header & Tabs */}
              <div className="bg-gray-50 border-b p-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-[#5A5A40] flex items-center gap-1">
                    <Edit2 size={16} />
                    محرر المحتوى الذكي
                  </span>
                  <div className="flex bg-white rounded-lg p-1 border border-black/5">
                    <button 
                      onClick={() => {
                        setSelectedLesson(prev => prev ? {...prev, displayMode: 'standard'} : null);
                        setLessons(prev => prev.map(l => l.id === selectedLesson.id ? {...l, displayMode: 'standard'} : l));
                      }}
                      className={`px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1 ${selectedLesson.displayMode === 'standard' || !selectedLesson.displayMode ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <FileText size={14} />
                      نص مستمر
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedLesson(prev => prev ? {...prev, displayMode: 'flashcards'} : null);
                        setLessons(prev => prev.map(l => l.id === selectedLesson.id ? {...l, displayMode: 'flashcards'} : l));
                      }}
                      className={`px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1 ${selectedLesson.displayMode === 'flashcards' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <Layers size={14} />
                      بطاقات تعليمية
                    </button>
                  </div>
                </div>
                
                {/* Toolbar */}
                <div className="flex items-center gap-1 border-r pr-2">
                  <button onClick={() => insertMarkdown('bold')} className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600" title="عريض"><Bold size={16} /></button>
                  <button onClick={() => insertMarkdown('italic')} className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600" title="مائل"><Italic size={16} /></button>
                  <button onClick={() => insertMarkdown('list')} className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600" title="قائمة"><List size={16} /></button>
                  <button onClick={() => insertMarkdown('link')} className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600" title="رابط"><LinkIcon size={16} /></button>
                  <button onClick={() => insertMarkdown('image')} className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600" title="صورة"><ImageIcon size={16} /></button>
                  <button onClick={() => insertMarkdown('code')} className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600" title="كود"><Code size={16} /></button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="relative">
                <div className="absolute top-2 right-4 text-[10px] text-gray-400 font-mono uppercase tracking-wider pointer-events-none">محتوى الدرس (Markdown)</div>
                <textarea 
                  id="lesson-content-editor"
                  className="w-full h-80 p-6 pt-8 border-none focus:ring-0 font-mono text-sm resize-none bg-white"
                  placeholder="ابدأ بكتابة محتوى الدرس هنا..."
                  value={selectedLesson.content}
                  onPaste={handlePaste}
                  onChange={e => {
                    const newContent = e.target.value;
                    setSelectedLesson(prev => prev ? {...prev, content: newContent} : null);
                    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? {...l, content: newContent} : l));
                  }}
                />
              </div>

              {/* Smart Summary Section */}
              <div className="bg-[#F9FAF5] border-t p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[#5A5A40] flex items-center gap-1">
                    <Sparkles size={16} className="text-yellow-500" />
                    ملخص ذكي (تلقائي)
                  </label>
                  <button 
                    onClick={generateSmartSummary}
                    disabled={isGeneratingSummary || !selectedLesson.content}
                    className="text-[10px] bg-white border border-[#5A5A40]/20 text-[#5A5A40] px-3 py-1 rounded-full hover:bg-[#5A5A40] hover:text-white transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    {isGeneratingSummary ? 'جاري التوليد...' : (
                      <>
                        <Wand2 size={12} />
                        توليد بالذكاء الاصطناعي
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  className="w-full h-24 p-3 border rounded-xl font-mono text-sm bg-white/50 focus:bg-white transition-all"
                  placeholder="لصق الملخص هنا..."
                  value={selectedLesson.summary}
                  onChange={e => {
                    const newSummary = e.target.value;
                    setSelectedLesson(prev => prev ? {...prev, summary: newSummary} : null);
                    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? {...l, summary: newSummary} : l));
                  }}
                />
              </div>
            </div>

            <button 
              onClick={async () => {
                const lessonRef = doc(db, `courses/${selectedCourse!.id}/units/${selectedUnit!.id}/lessons`, selectedLesson.id);
                await updateDoc(lessonRef, {
                  content: selectedLesson.content,
                  summary: selectedLesson.summary,
                  displayMode: selectedLesson.displayMode || 'standard'
                });
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
              }}
              className="bg-[#5A5A40] text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              <Save size={20} />
              {saveSuccess ? 'تم الحفظ بنجاح!' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
