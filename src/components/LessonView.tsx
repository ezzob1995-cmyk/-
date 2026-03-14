import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Lesson, Activity, UserProgress } from '../types';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  PlayCircle, 
  Gamepad2, 
  HelpCircle,
  Volume2,
  Award,
  BookOpen,
  Layers,
  Map as MapIcon,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  Info,
  Download,
  X as CloseIcon
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AudioPlayer: React.FC<{ url: string }> = ({ url }) => {
  return (
    <div className="py-8 flex justify-center w-full">
      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-[#5A5A40]/10 shadow-xl flex flex-col items-center gap-6 w-full max-w-lg transition-all hover:border-[#5A5A40]/30">
        <div className="w-20 h-20 rounded-full bg-[#5A5A40] flex items-center justify-center text-white shadow-lg animate-pulse">
          <Volume2 size={40} />
        </div>
        <div className="text-center space-y-2">
          <h4 className="font-bold text-xl text-[#141414]">استمع للمحتوى الصوتي</h4>
          <p className="text-gray-400 text-sm">اضغط على زر التشغيل للبدء</p>
        </div>
        <audio controls className="w-full h-12 custom-audio-player">
          <source src={url} type="audio/mpeg" />
          متصفحك لا يدعم مشغل الصوت.
        </audio>
      </div>
    </div>
  );
};

const VideoPlayer: React.FC<{ url: string }> = ({ url }) => {
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
  let embedUrl = url;
  
  if (isYoutube) {
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  }

  return (
    <div className="my-10 w-full aspect-video rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white bg-black group relative">
      {isYoutube ? (
        <iframe 
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video controls className="w-full h-full object-cover">
          <source src={url} />
          متصفحك لا يدعم مشغل الفيديو.
        </video>
      )}
    </div>
  );
};

const FileDownload: React.FC<{ url: string }> = ({ url }) => {
  const fileName = url.split('/').pop()?.split('?')[0] || 'ملف مرفق';
  const extension = fileName.split('.').pop()?.toUpperCase();

  return (
    <div className="my-8 w-full">
      <div className="bg-white p-6 rounded-[2rem] border-2 border-dashed border-[#5A5A40]/20 flex items-center justify-between gap-4 transition-all hover:border-[#5A5A40]/40 hover:bg-[#F5F5F0]/30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F0] text-[#5A5A40] flex items-center justify-center shadow-sm">
            <FileText size={28} />
          </div>
          <div className="text-right">
            <h4 className="font-bold text-[#141414] truncate max-w-[200px] md:max-w-md">{fileName}</h4>
            <span className="text-xs text-gray-400 font-black uppercase">{extension} • ملف تعليمي</span>
          </div>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-[#5A5A40] text-white p-4 rounded-2xl shadow-lg hover:bg-[#4A4A30] hover:scale-110 transition-all"
        >
          <Download size={20} />
        </a>
      </div>
    </div>
  );
};

const NoteBlock: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="my-8 p-8 rounded-[2.5rem] bg-[#5A5A40]/5 border-r-8 border-[#5A5A40] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-24 h-24 bg-[#5A5A40]/5 rounded-br-full -ml-12 -mt-12" />
      <div className="flex items-start gap-4 relative z-10">
        <div className="shrink-0 text-[#5A5A40] mt-1">
          <Info size={24} />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-black text-[#5A5A40] uppercase tracking-widest">ملاحظة هامة</span>
          <div className="text-gray-700 text-lg leading-relaxed font-medium">
            <MixedContent content={content} />
          </div>
        </div>
      </div>
    </div>
  );
};

const HtmlModule: React.FC<{ url: string }> = ({ url }) => {
  return (
    <div className="my-10 w-full aspect-video rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white bg-white">
      <iframe 
        src={url}
        className="w-full h-full border-0"
        title="External HTML Module"
        allowFullScreen
      />
    </div>
  );
};

const Quiz: React.FC<{ activity: Activity }> = ({ activity }) => {
  const [data, setData] = useState<any>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    try {
      setData(JSON.parse(activity.data));
    } catch (e) {
      console.error("Failed to parse quiz data", e);
    }
  }, [activity.data]);

  if (!data || !data.questions || data.questions.length === 0) return null;

  const currentQuestion = data.questions[currentQuestionIdx];

  const handleAnswer = (idx: number | boolean) => {
    if (showResult) return;
    
    let isCorrect = false;
    if (currentQuestion.type === 'mcq') {
      setSelectedOption(idx as number);
      isCorrect = idx === currentQuestion.correctIndex;
    } else {
      setSelectedOption(idx ? 1 : 0);
      isCorrect = idx === currentQuestion.correctAnswer;
    }

    if (isCorrect) setScore(prev => prev + 1);
    setShowResult(true);
  };

  const nextQuestion = () => {
    if (currentQuestionIdx < data.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setQuizFinished(true);
    }
  };

  if (quizFinished) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-16 px-8 bg-white rounded-[3rem] border-2 border-[#5A5A40]/10 shadow-2xl space-y-8 max-w-2xl mx-auto"
      >
        <div className="relative inline-block">
          <div className="w-32 h-32 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Award size={64} />
          </div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-2 -right-2 bg-green-500 text-white p-2 rounded-full shadow-lg"
          >
            <CheckCircle2 size={24} />
          </motion.div>
        </div>
        <div className="space-y-2">
          <h3 className="text-4xl font-black text-[#141414]">عمل رائع!</h3>
          <p className="text-gray-500 text-xl">لقد أتممت الاختبار بنجاح</p>
        </div>
        
        <div className="bg-[#F5F5F0] p-8 rounded-3xl inline-block min-w-[200px]">
          <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">نتيجتك النهائية</div>
          <div className="text-5xl font-black text-[#5A5A40]">{score} <span className="text-2xl text-gray-300 font-normal">/ {data.questions.length}</span></div>
        </div>

        <div className="flex justify-center gap-4">
          <button 
            onClick={() => {
              setCurrentQuestionIdx(0);
              setScore(0);
              setQuizFinished(false);
              setSelectedOption(null);
              setShowResult(false);
            }}
            className="bg-[#5A5A40] text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-[#4A4A30] hover:scale-105 transition-all"
          >
            إعادة المحاولة
          </button>
        </div>
      </motion.div>
    );
  }

  const progress = ((currentQuestionIdx + 1) / data.questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4" dir="rtl">
      <div className="mb-10 space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest">السؤال {currentQuestionIdx + 1}</span>
            <h2 className="text-2xl font-bold text-[#141414]">اختبر معلوماتك</h2>
          </div>
          <span className="text-sm font-bold text-gray-400">{currentQuestionIdx + 1} من {data.questions.length}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-[#5A5A40] shadow-lg"
          />
        </div>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[3rem] border-2 border-[#5A5A40]/10 shadow-2xl space-y-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#5A5A40]/5 rounded-bl-full -mr-16 -mt-16" />
        
        <h3 className="text-3xl font-bold text-[#141414] leading-tight relative z-10">
          {currentQuestion.question}
        </h3>

        <div className="grid grid-cols-1 gap-4 relative z-10">
          {currentQuestion.type === 'mcq' ? (
            currentQuestion.options.map((option: string, idx: number) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQuestion.correctIndex;
              let bgColor = "bg-white";
              let borderColor = "border-black/5";
              let textColor = "text-[#141414]";

              if (showResult) {
                if (isCorrect) {
                  bgColor = "bg-green-50";
                  borderColor = "border-green-500";
                  textColor = "text-green-700";
                } else if (isSelected) {
                  bgColor = "bg-red-50";
                  borderColor = "border-red-500";
                  textColor = "text-red-700";
                }
              } else if (isSelected) {
                borderColor = "border-[#5A5A40]";
                bgColor = "bg-[#F5F5F0]";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={showResult}
                  className={`group p-6 rounded-2xl border-2 text-right transition-all font-bold text-lg flex items-center justify-between ${bgColor} ${borderColor} ${textColor} ${!showResult ? 'hover:border-[#5A5A40] hover:bg-[#F5F5F0] hover:translate-x-1' : ''}`}
                >
                  <span>{option}</span>
                  {showResult && isCorrect && <CheckCircle2 size={24} className="text-green-500" />}
                  {showResult && isSelected && !isCorrect && <HelpCircle size={24} className="text-red-500" />}
                </button>
              );
            })
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {[true, false].map((val, idx) => {
                const isSelected = selectedOption === (val ? 1 : 0);
                const isCorrect = val === currentQuestion.correctAnswer;
                let bgColor = "bg-white";
                let borderColor = "border-black/5";

                if (showResult) {
                  if (isCorrect) {
                    bgColor = "bg-green-50";
                    borderColor = "border-green-500";
                  } else if (isSelected) {
                    bgColor = "bg-red-50";
                    borderColor = "border-red-500";
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(val)}
                    disabled={showResult}
                    className={`p-10 rounded-3xl border-2 text-center transition-all font-black text-3xl ${bgColor} ${borderColor} ${!showResult ? 'hover:border-[#5A5A40] hover:bg-[#F5F5F0] hover:scale-105' : ''}`}
                  >
                    {val ? 'صح' : 'خطأ'}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showResult && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 p-8 rounded-3xl bg-[#F5F5F0] border-r-8 border-[#5A5A40] space-y-4"
            >
              <div className="flex items-center gap-3 font-black text-xl text-[#5A5A40]">
                <Sparkles size={24} />
                <span>لماذا هذه الإجابة؟</span>
              </div>
              <p className="text-gray-600 text-lg leading-relaxed">
                {currentQuestion.type === 'mcq' 
                  ? (selectedOption === currentQuestion.correctIndex ? currentQuestion.explanationCorrect : currentQuestion.explanationIncorrect)
                  : currentQuestion.explanation
                }
              </p>
              <button 
                onClick={nextQuestion}
                className="w-full mt-6 bg-[#5A5A40] text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-[#4A4A30] transition-all flex items-center justify-center gap-2"
              >
                <span>{currentQuestionIdx < data.questions.length - 1 ? 'السؤال التالي' : 'إنهاء الاختبار'}</span>
                <ArrowLeft size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const MixedContent: React.FC<{ content: string, proseInvert?: boolean, onImageExpand?: (url: string) => void }> = ({ content, proseInvert = false, onImageExpand }) => {
  if (!content) return null;

  // Split content by block markers
  const parts = content.split(/(:::flashcards|:::mindmap|:::audio|:::video|:::file|:::note|:::html|:::)/);
  const elements: React.ReactNode[] = [];
  
  let currentMode: 'text' | 'flashcards' | 'mindmap' | 'audio' | 'video' | 'file' | 'note' | 'html' = 'text';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part === ':::flashcards') {
      currentMode = 'flashcards';
      continue;
    } else if (part === ':::mindmap') {
      currentMode = 'mindmap';
      continue;
    } else if (part === ':::audio') {
      currentMode = 'audio';
      continue;
    } else if (part === ':::video') {
      currentMode = 'video';
      continue;
    } else if (part === ':::file') {
      currentMode = 'file';
      continue;
    } else if (part === ':::note') {
      currentMode = 'note';
      continue;
    } else if (part === ':::html') {
      currentMode = 'html';
      continue;
    } else if (part === ':::') {
      currentMode = 'text';
      continue;
    }

    if (!part.trim()) continue;

    if (currentMode === 'flashcards') {
      elements.push(<Flashcards key={i} content={part} />);
    } else if (currentMode === 'mindmap') {
      elements.push(<MindMap key={i} content={part} />);
    } else if (currentMode === 'audio') {
      elements.push(<AudioPlayer key={i} url={part.trim()} />);
    } else if (currentMode === 'video') {
      elements.push(<VideoPlayer key={i} url={part.trim()} />);
    } else if (currentMode === 'file') {
      elements.push(<FileDownload key={i} url={part.trim()} />);
    } else if (currentMode === 'note') {
      elements.push(<NoteBlock key={i} content={part} />);
    } else if (currentMode === 'html') {
      elements.push(<HtmlModule key={i} url={part.trim()} />);
    } else {
      elements.push(
        <div key={i} className={`prose prose-lg max-w-none text-right ${proseInvert ? 'prose-invert' : ''}`} dir="rtl">
          <Markdown 
            remarkPlugins={[remarkGfm]}
            components={{
              img: ({ node, ...props }) => (
                <div className="my-10 flex flex-col items-center gap-3">
                  <div 
                    className="relative group cursor-zoom-in"
                    onClick={() => props.src && onImageExpand?.(props.src)}
                  >
                    <img {...props} referrerPolicy="no-referrer" className="rounded-[2.5rem] shadow-2xl border-4 border-white max-h-[500px] object-contain transition-transform hover:scale-[1.01]" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-[2.5rem] flex items-center justify-center">
                      <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                    </div>
                  </div>
                  {props.alt && <span className="text-sm text-gray-400 font-medium italic">{props.alt}</span>}
                </div>
              ),
              table: ({ node, ...props }) => (
                <div className="my-10 overflow-x-auto rounded-3xl border-2 border-[#5A5A40]/10 shadow-xl bg-white">
                  <table {...props} className="min-w-full divide-y divide-[#5A5A40]/10" />
                </div>
              ),
              thead: ({ node, ...props }) => (
                <thead {...props} className="bg-[#F5F5F0]" />
              ),
              th: ({ node, ...props }) => (
                <th {...props} className="px-6 py-4 text-right text-sm font-black text-[#5A5A40] uppercase tracking-wider" />
              ),
              tr: ({ node, ...props }) => (
                <tr {...props} className="hover:bg-gray-50/50 transition-colors even:bg-gray-50/20" />
              ),
              td: ({ node, ...props }) => (
                <td {...props} className="px-6 py-4 text-sm text-gray-600" />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote {...props} className="border-r-8 border-[#5A5A40] bg-[#F5F5F0] p-6 rounded-2xl italic text-xl text-[#141414] my-8" />
              ),
              h1: ({ node, ...props }) => <h1 {...props} className="text-4xl font-black text-[#141414] mb-8 mt-12" />,
              h2: ({ node, ...props }) => <h2 {...props} className="text-3xl font-bold text-[#141414] mb-6 mt-10" />,
              h3: ({ node, ...props }) => <h3 {...props} className="text-2xl font-bold text-[#141414] mb-4 mt-8" />,
            }}
          >
            {part}
          </Markdown>
        </div>
      );
    }
  }

  return <div className="space-y-4">{elements}</div>;
};

const Flashcards: React.FC<{ content: string }> = ({ content }) => {
  const cards = content.split('---').map(c => c.trim()).filter(c => c.length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && currentIndex < cards.length - 1) {
        handleNext();
      } else if (e.key === ' ' || e.key === 'Enter') {
        setIsFlipped(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, cards.length]);

  if (cards.length === 0) return <div>لا توجد بطاقات.</div>;

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const currentCard = cards[currentIndex];
  const [front, back] = currentCard.includes('\n') 
    ? [currentCard.split('\n')[0], currentCard.split('\n').slice(1).join('\n')]
    : [currentCard, ''];

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9
    })
  };

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      <div className="w-full max-w-md relative h-96">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0 perspective-1000"
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
              className="relative w-full h-full cursor-pointer preserve-3d shadow-2xl rounded-3xl"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-3xl border-2 border-[#5A5A40]/10 flex flex-col items-center justify-center p-10 text-center">
                <div className="absolute top-6 left-6 text-[#5A5A40]/20">
                  <Layers size={24} />
                </div>
                <h3 className="text-3xl font-bold text-[#141414] leading-tight">{front}</h3>
                <div className="absolute bottom-8 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <Sparkles size={14} className="text-[#5A5A40]" />
                  انقر للقلب
                </div>
              </div>
              {/* Back */}
              <div className="absolute inset-0 backface-hidden bg-[#5A5A40] text-white rounded-3xl flex flex-col items-center justify-center p-10 text-center rotate-y-180">
                <div className="w-full overflow-y-auto max-h-full custom-scrollbar">
                  <MixedContent content={back} proseInvert={true} />
                </div>
                <div className="absolute bottom-6 text-xs text-white/40">انقر للعودة</div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <div className="flex items-center justify-between w-full px-4">
          <button 
            disabled={currentIndex === 0}
            onClick={handlePrev}
            className="group flex items-center gap-2 p-4 rounded-2xl bg-white border border-black/5 shadow-sm hover:shadow-md hover:border-[#5A5A40]/30 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm hidden sm:inline">السابق</span>
          </button>

          <div className="flex flex-col items-center">
            <span className="font-black text-2xl text-[#5A5A40]">{currentIndex + 1} <span className="text-gray-300 text-lg font-normal">/ {cards.length}</span></span>
          </div>

          <button 
            disabled={currentIndex === cards.length - 1}
            onClick={handleNext}
            className="group flex items-center gap-2 p-4 rounded-2xl bg-[#5A5A40] text-white shadow-lg hover:bg-[#4A4A30] hover:shadow-xl transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <span className="font-bold text-sm hidden sm:inline">التالي</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            className="h-full bg-[#5A5A40]"
          />
        </div>
      </div>
    </div>
  );
};

const MindMap: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="py-6" dir="rtl">
      <div className="bg-[#F5F5F0] p-6 md:p-10 rounded-[2.5rem] border border-black/5">
        <div className="mindmap-view">
          <MixedContent content={content} />
        </div>
      </div>
      <style>{`
        .mindmap-view ul {
          list-style: none;
          padding-right: 20px;
          border-right: 2px solid #5A5A40;
        }
        .mindmap-view li {
          position: relative;
          margin-bottom: 15px;
        }
        .mindmap-view li::before {
          content: "";
          position: absolute;
          right: -22px;
          top: 15px;
          width: 15px;
          height: 2px;
          background: #5A5A40;
        }
      `}</style>
    </div>
  );
};

const InteractiveJourney: React.FC<{ content: string, onComplete: () => void }> = ({ content, onComplete }) => {
  const stages = content.split('===').map(s => s.trim()).filter(s => s.length > 0);
  const [currentStage, setCurrentStage] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);

  if (stages.length === 0) return <div>لا يوجد محتوى للرحلة التعليمية.</div>;

  const progress = ((currentStage + 1) / stages.length) * 100;

  return (
    <div className={`space-y-8 transition-all duration-500 ${isFocusMode ? 'fixed inset-0 z-50 bg-[#F5F5F0] p-4 md:p-10 overflow-y-auto' : ''}`}>
      {/* Progress Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shadow-lg">
              <MapIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-[#141414]">رحلتك التعليمية</h3>
              <p className="text-xs text-gray-400">المرحلة {currentStage + 1} من {stages.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="p-2 rounded-lg hover:bg-black/5 text-gray-400 transition-colors"
              title={isFocusMode ? "تصغير" : "ملء الشاشة"}
            >
              {isFocusMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          </div>
        </div>
        
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-[#5A5A40]"
          />
        </div>
      </div>

      {/* Stage Content */}
      <div className="min-h-[400px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-black/5 shadow-xl min-h-[400px] flex flex-col"
          >
            <div className="flex-1">
              <MixedContent content={stages[currentStage]} />
            </div>

            {/* Navigation Controls */}
            <div className="mt-12 pt-8 border-t border-black/5 flex items-center justify-between">
              <button
                disabled={currentStage === 0}
                onClick={() => setCurrentStage(prev => prev - 1)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-gray-400 hover:text-[#141414] hover:bg-gray-50 transition-all disabled:opacity-20"
              >
                <ChevronLeft size={20} />
                السابق
              </button>

              <div className="flex gap-2">
                {stages.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentStage ? 'w-6 bg-[#5A5A40]' : 'bg-gray-200'}`}
                  />
                ))}
              </div>

              {currentStage < stages.length - 1 ? (
                <button
                  onClick={() => setCurrentStage(prev => prev + 1)}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold bg-[#5A5A40] text-white shadow-lg hover:bg-[#4A4A30] hover:-translate-y-1 transition-all"
                >
                  التالي
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  onClick={onComplete}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold bg-green-600 text-white shadow-lg hover:bg-green-700 hover:-translate-y-1 transition-all"
                >
                  إكمال الرحلة
                  <CheckCircle2 size={20} />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stage Navigator (Desktop) */}
      {!isFocusMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4">
          {stages.map((stage, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStage(idx)}
              className={`p-3 rounded-xl border text-xs font-bold transition-all ${idx === currentStage ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-md' : 'bg-white text-gray-400 border-black/5 hover:border-[#5A5A40]/30'}`}
            >
              المرحلة {idx + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const LessonView: React.FC = () => {
  const { courseId, unitId, lessonId } = useParams<{ courseId: string, unitId: string, lessonId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentTab, setCurrentTab] = useState<'content' | 'activities' | 'summary'>('content');
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !unitId || !lessonId) return;

    const lessonRef = doc(db, `courses/${courseId}/units/${unitId}/lessons`, lessonId);
    const unsubscribeLesson = onSnapshot(lessonRef, (docSnap) => {
      if (docSnap.exists()) {
        setLesson({ id: docSnap.id, ...docSnap.data() } as Lesson);
      }
      setLoading(false);
    });

    const activitiesQuery = query(
      collection(db, `courses/${courseId}/units/${unitId}/lessons/${lessonId}/activities`),
      orderBy('order', 'asc')
    );
    const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setActivities(activityData);
    });

    return () => {
      unsubscribeLesson();
      unsubscribeActivities();
    };
  }, [courseId, unitId, lessonId]);

  const handleComplete = async () => {
    if (!profile || !lessonId) return;
    
    setCompleted(true);
    // Save progress
    await addDoc(collection(db, 'progress'), {
      userId: profile.uid,
      lessonId: lessonId,
      completed: true,
      score: 100,
      xpEarned: 50,
      updatedAt: serverTimestamp()
    });
    
    // Update user XP (simplified)
    // In a real app, use a cloud function or transaction
  };

  const [activeActivity, setActiveActivity] = useState<string | null>(null);

  if (loading) return <div className="text-center py-20">جاري تحميل الدرس...</div>;
  if (!lesson) return <div className="text-center py-20">الدرس غير موجود.</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate(`/course/${courseId}`)}
          className="flex items-center gap-2 text-gray-500 hover:text-[#141414] font-medium transition-colors"
        >
          <ArrowLeft size={20} />
          العودة للكورس
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#5A5A40] bg-[#5A5A40]/10 px-3 py-1 rounded-full uppercase tracking-wider">
            Lesson {lesson.order}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2rem] border border-black/5 shadow-sm overflow-hidden">
            <div className="flex border-b border-black/5 relative">
              {(['content', 'activities', 'summary'] as const).map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setCurrentTab(tab)}
                  className={`flex-1 py-4 text-sm font-bold transition-colors relative ${currentTab === tab ? 'text-[#5A5A40]' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {tab === 'content' && 'الشرح'}
                  {tab === 'activities' && `الأنشطة (${activities.length})`}
                  {tab === 'summary' && 'بإيجاز'}
                  {currentTab === tab && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="p-8 md:p-12 min-h-[400px]">
              <AnimatePresence mode="wait">
                {currentTab === 'content' && (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="prose prose-lg max-w-none text-right"
                    dir="rtl"
                  >
                    <h1 className="text-3xl font-bold mb-8 text-[#141414]">{lesson.title}</h1>
                    <div className="text-gray-700 leading-relaxed space-y-6">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={lesson.displayMode || 'standard'}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                        >
                          {lesson.displayMode === 'flashcards' ? (
                            <Flashcards content={lesson.content} />
                          ) : lesson.displayMode === 'mindmap' ? (
                            <MindMap content={lesson.content} />
                          ) : lesson.displayMode === 'interactive_journey' ? (
                            <InteractiveJourney content={lesson.content} onComplete={handleComplete} />
                          ) : (
                            <MixedContent content={lesson.content} onImageExpand={setExpandedImage} />
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {currentTab === 'activities' && (
                  <motion.div
                    key="activities"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-10"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h2 className="text-3xl font-black text-[#141414]">الأنشطة التفاعلية</h2>
                        <p className="text-gray-400">طبق ما تعلمته من خلال هذه التمارين الممتعة</p>
                      </div>
                      <div className="bg-[#5A5A40]/10 px-4 py-2 rounded-full text-[#5A5A40] font-bold text-sm">
                        {activities.length} أنشطة متاحة
                      </div>
                    </div>

                    <div className="space-y-12">
                      {activities.map((activity, idx) => {
                        const isBuiltInQuiz = activity.type === 'quiz' && activity.data && activity.data.includes('questions');
                        const isActive = activeActivity === activity.id;
                        
                        return (
                          <div key={activity.id} className="w-full">
                            <motion.div 
                              layout
                              className={`rounded-[3rem] border-2 transition-all overflow-hidden ${isActive ? 'bg-white border-[#5A5A40] shadow-2xl scale-[1.02]' : 'bg-[#F5F5F0] border-transparent hover:bg-white hover:shadow-xl'}`}
                            >
                              <div className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                                <div className={`w-24 h-24 md:w-32 md:h-32 rounded-[2rem] flex items-center justify-center shadow-2xl shrink-0 ${activity.type === 'quiz' ? 'bg-blue-500 text-white' : activity.type === 'game' ? 'bg-purple-500 text-white' : activity.type === 'video' ? 'bg-red-500 text-white' : 'bg-[#5A5A40] text-white'}`}>
                                  {activity.type === 'game' && <Gamepad2 size={48} />}
                                  {activity.type === 'quiz' && <HelpCircle size={48} />}
                                  {activity.type === 'video' && <PlayCircle size={48} />}
                                  {activity.type === 'audio' && <Volume2 size={48} />}
                                </div>

                                <div className="flex-1 text-center md:text-right space-y-4">
                                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                    <span className="bg-white/50 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-gray-500 border border-black/5">
                                      {activity.type === 'quiz' ? 'اختبار تفاعلي' : activity.type === 'game' ? 'لعبة تعليمية' : activity.type === 'video' ? 'فيديو توضيحي' : 'محتوى صوتي'}
                                    </span>
                                  </div>
                                  <h4 className="text-3xl md:text-4xl font-black text-[#141414] leading-tight">{activity.title}</h4>
                                  <p className="text-gray-500 text-lg md:text-xl max-w-2xl">
                                    {activity.type === 'quiz' ? 'اختبر مدى استيعابك للمفاهيم الأساسية في هذا الدرس من خلال هذا الاختبار التفاعلي الممتع.' : 
                                     activity.type === 'audio' ? 'استمع إلى شرح صوتي مفصل أو ملخص شامل للدرس لتعزيز مهارات الاستماع لديك.' :
                                     activity.type === 'video' ? 'شاهد مقطع فيديو توضيحي يعزز فهمك للمادة العلمية بطريقة بصرية مشوقة.' :
                                     'نشاط تفاعلي ممتع مصمم خصيصاً لمساعدتك على تطبيق المهارات التي اكتسبتها في هذا الدرس.'}
                                  </p>
                                </div>

                                <div className="shrink-0 w-full md:w-auto">
                                  <button 
                                    onClick={() => {
                                      if (isBuiltInQuiz || activity.type === 'audio') {
                                        setActiveActivity(isActive ? null : activity.id);
                                      } else if (activity.url) {
                                        window.open(activity.url, '_blank');
                                      }
                                    }}
                                    className={`w-full md:w-auto px-12 py-5 rounded-[2rem] font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3 ${isActive ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30] hover:scale-105'}`}
                                  >
                                    {isActive ? 'إغلاق النشاط' : (isBuiltInQuiz ? 'ابدأ الاختبار الآن' : (activity.type === 'audio' ? 'استمع الآن' : 'ابدأ النشاط'))}
                                    {!isActive && <ArrowLeft size={24} />}
                                  </button>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isActive && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden bg-gray-50/50 border-t-2 border-gray-100"
                                  >
                                    <div className="p-8 md:p-12">
                                      {isBuiltInQuiz && <Quiz activity={activity} />}
                                      {activity.type === 'audio' && activity.url && <AudioPlayer url={activity.url} />}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {activities.length === 0 && (
                      <div className="text-center py-20 bg-[#F5F5F0] rounded-[3rem] border-2 border-dashed border-gray-200">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                          <Layers size={40} />
                        </div>
                        <p className="text-gray-400 font-bold text-xl">لا توجد أنشطة لهذا الدرس بعد.</p>
                        <p className="text-gray-300 text-sm mt-2">سيقوم المعلم بإضافة أنشطة قريباً</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {currentTab === 'summary' && (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8 text-right"
                    dir="rtl"
                  >
                    <div className="bg-[#5A5A40]/5 p-8 rounded-[2rem] border border-[#5A5A40]/10">
                      <div className="flex items-center gap-3 mb-6 text-[#5A5A40]">
                        <Sparkles size={24} />
                        <h2 className="text-2xl font-bold">ملخص الدرس الذكي</h2>
                      </div>
                      <div className="text-gray-700 leading-relaxed text-lg">
                        <MixedContent content={lesson.summary || 'جاري توليد الملخص...'} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-8 bg-gray-50 border-t border-black/5 flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle2 className={completed ? "text-green-500" : "text-gray-300"} size={20} />
                {completed ? "تم إكمال الدرس!" : "لم يتم إكمال الدرس بعد"}
              </div>
              {!completed && (
                <button 
                  onClick={handleComplete}
                  className="bg-[#5A5A40] text-white px-8 py-3 rounded-full font-bold hover:bg-[#4A4A30] transition-all shadow-lg flex items-center gap-2"
                >
                  إكمال الدرس
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar / Progress */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-sm">
            <h3 className="font-bold text-lg mb-4">تقدمك في هذا الدرس</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">الإنجاز</span>
                <span className="font-bold">{completed ? '100%' : '0%'}</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#5A5A40] transition-all duration-1000" 
                  style={{ width: completed ? '100%' : '0%' }}
                />
              </div>
              <div className="pt-4 flex items-center gap-3 text-[#5A5A40]">
                <Award size={20} />
                <span className="text-sm font-bold">+50 XP عند الإكمال</span>
              </div>
            </div>
          </div>

          <div className="bg-[#141414] p-8 rounded-[2rem] text-white shadow-xl">
            <h3 className="font-bold text-lg mb-4 text-[#5A5A40]">نصيحة ذكية</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              المراجعة المنتظمة للملخصات تزيد من نسبة تذكر المعلومات بنسبة ٤٠٪. لا تنسَ العودة لقسم "بإيجاز" قبل الامتحان!
            </p>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImage(null)}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 cursor-zoom-out"
          >
            <button 
              onClick={() => setExpandedImage(null)}
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
            >
              <CloseIcon size={40} />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={expandedImage}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LessonView;
