import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, XIcon, CheckIcon } from '../components/Icons';
import { useAuth } from '../App';
import LoginPromptModal from '../components/LoginPromptModal';
import { toast } from 'react-hot-toast';

// --- DEBOUNCE HOOK ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// --- HELPERS ---
const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    let videoId = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1).split('?')[0];
        } else if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (e) {
        // Regex fallback for invalid URLs or different formats
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        if (match) {
            videoId = match[1];
        }
    }
    return videoId;
};

const getYoutubeThumbnailUrl = (url: string, courseId: string): string => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    // Fallback image if URL is invalid or not a YouTube URL
    return `https://picsum.photos/seed/${courseId}/500/300`;
};

const getYoutubeEmbedUrl = (url: string): string | null => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    return null;
};


// --- VIDEO MODAL ---
interface VideoModalProps {
    videoUrl: string;
    title: string;
    onClose: () => void;
}

const VideoModal = ({ videoUrl, title, onClose }: VideoModalProps) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const embedUrl = getYoutubeEmbedUrl(videoUrl);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.8, y: -50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: -50 }}
                className="bg-[#1a1a1a] rounded-2xl w-full max-w-4xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 flex justify-between items-center border-b border-gray-700">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <XIcon />
                    </button>
                </div>
                <div className="aspect-video bg-black">
                    {embedUrl ? (
                         <iframe
                            src={embedUrl}
                            title={title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full"
                        ></iframe>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-red-500">
                           <p>Video not available. The provided link may be invalid.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};


// --- COURSE CARD ---
interface CourseCardProps {
  course: Course;
  onWatch: (videoUrl: string, title: string) => void;
  onNotes: (notesUrl: string) => void;
  onComplete: (courseId: string) => void;
  isCompleted: boolean;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onWatch, onNotes, onComplete, isCompleted }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="bg-[#1e1e1e] rounded-2xl overflow-hidden shadow-lg flex flex-col"
        >
            <img src={getYoutubeThumbnailUrl(course.videoUrl, course.id)} alt={course.title} className="w-full h-48 object-cover" />
            <div className="p-4 flex flex-col flex-grow">
                <span className="bg-red-600/20 text-red-400 text-xs font-semibold px-2 py-1 rounded-full self-start mb-2">{course.category}</span>
                <h3 className="text-lg font-bold text-white flex-grow">{course.title}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => onWatch(course.videoUrl, course.title)} aria-label={`Watch ${course.title}`} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Watch</button>
                    <button onClick={() => onNotes(course.notesUrl)} aria-label={`Download notes for ${course.title}`} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Notes</button>
                    {isCompleted ? (
                         <button onClick={() => onComplete(course.id)} className="flex-[2_1_100%] bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition duration-300">
                            <CheckIcon />
                            <span>Completed</span>
                        </button>
                    ) : (
                        <button onClick={() => onComplete(course.id)} className="flex-[2_1_100%] bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                            Mark as Complete
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// --- SKELETON LOADER ---
const CourseCardSkeleton = () => (
    <div className="bg-[#1e1e1e] rounded-2xl overflow-hidden shadow-lg flex flex-col animate-pulse">
        <div className="w-full h-48 bg-gray-700/50"></div>
        <div className="p-4 flex flex-col flex-grow">
            <div className="bg-gray-700/50 h-4 w-1/4 rounded-full self-start mb-3"></div>
            <div className="bg-gray-700/50 h-6 w-3/4 rounded-md"></div>
            <div className="mt-6 flex flex-wrap gap-2">
                <div className="flex-1 bg-gray-700/50 h-10 rounded-lg"></div>
                <div className="flex-1 bg-gray-700/50 h-10 rounded-lg"></div>
                <div className="flex-[2_1_100%] bg-gray-700/50 h-10 rounded-lg"></div>
            </div>
        </div>
    </div>
);


// --- HOME PAGE ---
const Home = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const coursesCache = useRef<Course[]>([]);
    const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedVideo, setSelectedVideo] = useState<{ url: string; title: string } | null>(null);
    const location = useLocation();
    const { user, appUser } = useAuth()!;
    const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
    
    const category = new URLSearchParams(location.search).get('category');

    useEffect(() => {
        const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
            if (!snapshot.empty) {
                coursesCache.current = coursesData;
                setCourses(coursesData);
            } else if (coursesCache.current.length === 0) {
                setCourses([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching courses:", error);
            setCourses(coursesCache.current);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let result = courses;
        if (category) {
            result = result.filter(course => course.category === category);
        }
        if (debouncedSearchTerm) {
            result = result.filter(course =>
                course.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                course.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            );
        }
        setFilteredCourses(result);
    }, [debouncedSearchTerm, category, courses]);

    const handleWatchClick = (url: string, title: string) => {
        if (!user) {
            setIsLoginPromptOpen(true);
            return;
        }
        setSelectedVideo({ url, title });
    };

    const handleNotesClick = (notesUrl: string) => {
        if (!user) {
            setIsLoginPromptOpen(true);
            return;
        }
        if (notesUrl && notesUrl.trim()) {
            window.open(notesUrl, '_blank', 'noopener,noreferrer');
        } else {
            toast.error("Notes are not available for this video.");
        }
    };

    const handleCompleteClick = async (courseId: string) => {
        if (!user || !appUser) {
            setIsLoginPromptOpen(true);
            return;
        }
        
        const userDocRef = doc(db, 'users', user.uid);
        const isAlreadyCompleted = appUser.completedCourses?.includes(courseId);

        try {
            if (isAlreadyCompleted) {
                await updateDoc(userDocRef, {
                    completedCourses: arrayRemove(courseId)
                });
                toast.success('Course marked as incomplete.');
            } else {
                await updateDoc(userDocRef, {
                    completedCourses: arrayUnion(courseId)
                });
                toast.success('Course marked as complete!', { icon: '🎉' });
            }
        } catch (error) {
            console.error("Error updating course status:", error);
            toast.error("Could not update course status.");
        }
    };

    return (
        <div className="container mx-auto px-6 py-8">
            <AnimatePresence>
                {selectedVideo && (
                    <VideoModal videoUrl={selectedVideo.url} title={selectedVideo.title} onClose={() => setSelectedVideo(null)} />
                )}
            </AnimatePresence>
            <LoginPromptModal isOpen={isLoginPromptOpen} onClose={() => setIsLoginPromptOpen(false)} />
            
             <motion.section 
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
                }}
                className="text-center py-16"
            >
                <motion.h1 
                    variants={{ hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0 } }}
                    className="text-5xl md:text-7xl font-extrabold tracking-tight"
                >
                    <span className="bg-gradient-to-r from-red-500 to-sky-400 text-transparent bg-clip-text animated-gradient-text">
                        APNA ADDA
                    </span>
                </motion.h1>
                <motion.p 
                    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: 0.3 }}}}
                    className="max-w-3xl mx-auto mt-4 text-lg text-gray-300"
                >
                    Your one-stop destination for quality education. Access courses for 12th Board, JEE, 11th, AI, and Development. Learn from the best, anytime, anywhere.
                </motion.p>
                <motion.div
                    variants={{ hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1, transition: { delay: 0.5 }}}}
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    className="mt-12 text-2xl md:text-3xl font-bold tracking-widest"
                >
                    <span className="bg-gradient-to-r from-red-500 via-pink-500 to-sky-400 text-transparent bg-clip-text">
                        START LEARNING
                    </span>
                </motion.div>
            </section>

            <div className="my-8 max-w-2xl mx-auto">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search courses, topics, categories…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-gray-700 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                       <SearchIcon />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
                </div>
            ) : (
                <>
                    <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AnimatePresence>
                            {filteredCourses.map(course => (
                                <CourseCard 
                                    key={course.id} 
                                    course={course} 
                                    onWatch={handleWatchClick} 
                                    onNotes={handleNotesClick}
                                    onComplete={handleCompleteClick}
                                    isCompleted={appUser?.completedCourses?.includes(course.id) || false}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                    {filteredCourses.length === 0 && !loading && (
                       <div className="text-center py-16 text-gray-400">
                           <h3 className="text-2xl font-bold">No Courses Found</h3>
                           <p className="mt-2">
                           {searchTerm 
                               ? "No courses found matching your search criteria." 
                               : "Try adjusting your search or category filter."}
                           </p>
                       </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Home;