import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, query, orderBy, onSnapshot, where, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course, SupportChat, ChatMessage, AppUser } from '../types';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import { TrashIcon, PencilIcon, SearchIcon, UsersIcon, BookOpenIcon, ClipboardListIcon, MessageSquareIcon } from '../components/Icons';
import { useAuth } from '../App';

type AdminSection = 'overview' | 'courses' | 'users' | 'content' | 'support';

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

const getYoutubeThumbnailUrl = (url: string): string => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    // Fallback image if URL is invalid or not a YouTube URL
    return `https://picsum.photos/seed/${url}/200/120`;
};


const AdminDashboard = () => {
    const [activeSection, setActiveSection] = useState<AdminSection>('overview');

    return (
        <div className="container mx-auto px-6 py-8">
            <h1 className="text-4xl font-extrabold mb-2 text-white tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-400 mb-8">Manage your platform's courses, content, and user support.</p>

            <div className="flex space-x-2 border-b border-gray-800 mb-8">
                <TabButton title="Overview" section="overview" activeSection={activeSection} setActiveSection={setActiveSection} />
                <TabButton title="Courses" section="courses" activeSection={activeSection} setActiveSection={setActiveSection} />
                <TabButton title="Users" section="users" activeSection={activeSection} setActiveSection={setActiveSection} />
                <TabButton title="Content" section="content" activeSection={activeSection} setActiveSection={setActiveSection} />
                <TabButton title="Support" section="support" activeSection={activeSection} setActiveSection={setActiveSection} />
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeSection === 'overview' && <DashboardOverview />}
                    {activeSection === 'courses' && <CourseManagement />}
                    {activeSection === 'users' && <UserManagement />}
                    {activeSection === 'content' && <ContentManagement />}
                    {activeSection === 'support' && <SupportManagement />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

const TabButton = ({ title, section, activeSection, setActiveSection }: { title: string, section: AdminSection, activeSection: AdminSection, setActiveSection: React.Dispatch<React.SetStateAction<AdminSection>> }) => {
    const isActive = section === activeSection;
    return (
        <button
            onClick={() => setActiveSection(section)}
            className={`relative py-3 px-5 text-base font-semibold transition-colors duration-300 outline-none ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`}
        >
            {title}
            {isActive && <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" layoutId="admin-tab-underline" />}
        </button>
    );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) => (
    <div className="bg-[#1e1e1e] p-6 rounded-2xl flex items-center space-x-4">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const DashboardOverview = () => {
    const [stats, setStats] = useState({ users: 0, courses: 0, newChats: 0 });

    useEffect(() => {
        const unsubs: (() => void)[] = [];

        const qUsers = query(collection(db, "users"));
        unsubs.push(onSnapshot(qUsers, (snapshot) => {
            setStats(prev => ({ ...prev, users: snapshot.size }));
        }));

        const qCourses = query(collection(db, "courses"));
        unsubs.push(onSnapshot(qCourses, (snapshot) => {
            setStats(prev => ({ ...prev, courses: snapshot.size }));
        }));

        const qChats = query(collection(db, "supportChats"), where("status", "==", "new"));
        unsubs.push(onSnapshot(qChats, (snapshot) => {
            setStats(prev => ({ ...prev, newChats: snapshot.size }));
        }));

        return () => unsubs.forEach(unsub => unsub());
    }, []);

    return (
        <div>
             <h2 className="text-2xl font-bold mb-6 text-white">Platform Overview</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Users" value={stats.users} icon={<UsersIcon />} color="bg-blue-500/20 text-blue-400" />
                <StatCard title="Total Courses" value={stats.courses} icon={<BookOpenIcon />} color="bg-green-500/20 text-green-400" />
                <StatCard title="New Support Chats" value={stats.newChats} icon={<MessageSquareIcon />} color="bg-red-500/20 text-red-400" />
            </div>
        </div>
    );
};

const CourseManagement = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [formData, setFormData] = useState({ title: '', category: '12th Board', videoUrl: '', notesUrl: '' });
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; confirmText?: string; } | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCourses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course)));
        }, (error) => {
            console.error("Error listening for course updates:", error);
            toast.error("Connection lost. Retrying to sync courses.");
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const resetForm = () => {
        setEditingCourse(null);
        setFormData({ title: '', category: '12th Board', videoUrl: '', notesUrl: '' });
        formRef.current?.reset();
    };

    const handleSaveCourse = async () => {
        if (!formData.videoUrl.trim() || !formData.title.trim()) {
            toast.error("Course Title and YouTube Video URL are required.");
            return;
        }

        try {
            const courseData = { 
                title: formData.title.trim(),
                category: formData.category,
                videoUrl: formData.videoUrl.trim(),
                notesUrl: formData.notesUrl.trim(),
            };
            
            if (editingCourse) {
                await updateDoc(doc(db, 'courses', editingCourse.id), courseData);
                toast.success('Course updated successfully');
            } else {
                await addDoc(collection(db, 'courses'), { ...courseData, createdAt: serverTimestamp() });
                toast.success('Course added successfully');
            }
            resetForm();
        } catch (error: any) {
            console.error("Error saving course:", error);
            toast.error('Failed to save course data.');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setModalConfig({
            title: editingCourse ? 'Confirm Update' : 'Confirm Add Course',
            message: <p>Are you sure you want to {editingCourse ? 'update' : 'add'} the course: <strong className="text-red-400">"{formData.title}"</strong>?</p>,
            onConfirm: handleSaveCourse,
            confirmText: editingCourse ? 'Update' : 'Add Course',
        });
        setIsModalOpen(true);
    };
    
    const handleEdit = (course: Course) => {
        setEditingCourse(course);
        setFormData({ title: course.title, category: course.category, videoUrl: course.videoUrl, notesUrl: course.notesUrl || '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (id: string, title: string) => {
        const action = async () => {
            try {
                await deleteDoc(doc(db, 'courses', id));
                toast.success('Course deleted');
            } catch (error) {
                toast.error('Failed to delete course');
            }
        };

        setModalConfig({
            title: 'Confirm Deletion',
            message: <p>Permanently delete <strong className="text-red-400">"{title}"</strong>? This cannot be undone.</p>,
            onConfirm: action,
            confirmText: 'Delete',
        });
        setIsModalOpen(true);
    };

    return (
        <div>
            <form onSubmit={handleSubmit} ref={formRef} className="bg-[#1e1e1e] p-6 rounded-2xl mb-8 space-y-4">
                <h2 className="text-2xl font-bold mb-4">{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="title" value={formData.title} onChange={handleChange} placeholder="Course Title" className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none" required />
                    <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none">
                        {['12th Board', 'JEE', '11th', 'AI', 'Development'].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <div className="md:col-span-2">
                        <label htmlFor="video-url-input" className="font-semibold text-gray-300 block mb-2">
                           YouTube Video URL <span className="text-red-500">*</span>
                        </label>
                         <input
                            id="video-url-input"
                            name="videoUrl"
                            type="url"
                            value={formData.videoUrl}
                            onChange={handleChange}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="notes-url-input" className="font-semibold text-gray-300 block mb-2">
                            Google Drive Link for Notes (Optional)
                        </label>
                         <input 
                            id="notes-url-input"
                            name="notesUrl" 
                            value={formData.notesUrl} 
                            onChange={handleChange} 
                            placeholder="https://docs.google.com/..." 
                            className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none" 
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-4 pt-2">
                    <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105">
                        {editingCourse ? 'Update Course' : 'Add Course'}
                    </button>
                    {editingCourse && <button type="button" onClick={resetForm} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel Edit</button>}
                </div>
            </form>

            <div className="bg-[#1e1e1e] rounded-2xl overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-800/50">
                        <tr>
                            <th className="p-4 font-semibold">Title</th>
                            <th className="p-4 font-semibold">Category</th>
                            <th className="p-4 font-semibold">Created</th>
                            <th className="p-4 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map(course => (
                            <tr key={course.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                                <td className="p-4 align-top">
                                    <div className="flex items-center space-x-3">
                                        <img src={getYoutubeThumbnailUrl(course.videoUrl)} alt={course.title} className="w-20 h-12 object-cover rounded-md flex-shrink-0"/>
                                        <span className="font-bold">{course.title}</span>
                                    </div>
                                </td>
                                <td className="p-4 align-top text-gray-300">{course.category}</td>
                                <td className="p-4 align-top text-gray-300">{course.createdAt ? new Date(course.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                                <td className="p-4 align-top">
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleEdit(course)} className="p-2 text-blue-400 hover:text-blue-300"><PencilIcon /></button>
                                        <button onClick={() => handleDelete(course.id, course.title)} className="p-2 text-red-400 hover:text-red-300"><TrashIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ConfirmationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalConfig?.onConfirm || (() => {})} title={modalConfig?.title || ''} message={modalConfig?.message || ''} confirmButtonText={modalConfig?.confirmText} />
        </div>
    );
};

// User Management Component
const UserManagement = () => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
    const { appUser: currentAdmin } = useAuth()!;

    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => doc.data() as AppUser);
            // Sort client-side for robustness
            usersData.sort((a, b) => {
                const timeA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : 0;
                const timeB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : 0;
                return timeB - timeA;
            });
            setUsers(usersData);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = (user: AppUser) => {
        setUserToDelete(user);
        setIsModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        try {
            // Note: This deletes the Firestore record, not the Firebase Auth user.
            // For a full user deletion, you would need a Cloud Function to handle the Auth part.
            await deleteDoc(doc(db, 'users', userToDelete.uid));
            toast.success(`User ${userToDelete.email} deleted.`);
            setUserToDelete(null);
        } catch (error) {
            toast.error('Failed to delete user.');
        }
    };

    const filteredUsers = users.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.nickname?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="mb-6 bg-[#1e1e1e] p-4 rounded-2xl flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Manage Users</h2>
                <div className="relative">
                     <input type="text" placeholder="Search by email or nickname..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full max-w-xs bg-gray-800 py-2 pl-10 pr-4 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none" />
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                </div>
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-800/50">
                        <tr>
                            <th className="p-4 font-semibold">User</th>
                            <th className="p-4 font-semibold">Email</th>
                            <th className="p-4 font-semibold">Role</th>
                            <th className="p-4 font-semibold">Joined</th>
                            <th className="p-4 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.uid} className="border-b border-gray-800 hover:bg-gray-800/30">
                                <td className="p-4">
                                    <div className="flex items-center space-x-3">
                                        <span className="bg-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-lg">{user.emoji}</span>
                                        <span className="font-bold">{user.nickname}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-gray-300">{user.email}</td>
                                <td className="p-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-sky-500/20 text-sky-400'}`}>{user.role}</span></td>
                                <td className="p-4 text-gray-300">
                                    {user.createdAt && typeof user.createdAt.toDate === 'function' ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="p-4">
                                    <button onClick={() => handleDelete(user)} className="p-2 text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed" disabled={user.uid === currentAdmin?.uid} aria-label={`Delete ${user.nickname}`}>
                                        <TrashIcon />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <ConfirmationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={confirmDelete} title="Confirm Deletion" message={<p>Permanently delete user <strong className="text-red-400">{userToDelete?.email}</strong>? This cannot be undone.</p>} confirmButtonText="Delete" />
        </div>
    );
};


// Content Management Component
const ContentManagement = () => {
    const [about, setAbout] = useState('');
    const [terms, setTerms] = useState('');
    const [support, setSupport] = useState('');

    useEffect(() => {
        const contentRef = collection(db, 'siteContent');
        const unsubscribe = onSnapshot(contentRef, (snapshot) => {
            snapshot.docs.forEach(doc => {
                if (doc.id === 'about') setAbout(doc.data().content);
                if (doc.id === 'terms') setTerms(doc.data().content);
                if (doc.id === 'support') setSupport(doc.data().content);
            });
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async (page: 'about' | 'terms' | 'support') => {
        let content = '';
        let pageTitle = '';
        switch(page) {
            case 'about': content = about; pageTitle = 'About Us'; break;
            case 'terms': content = terms; pageTitle = 'Terms of Service'; break;
            case 'support': content = support; pageTitle = 'Customer Support'; break;
        }

        try {
            await setDoc(doc(db, 'siteContent', page), { content });
            toast.success(`${pageTitle} page updated!`);
        } catch (error) {
            toast.error(`Failed to update ${pageTitle}.`);
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-[#1e1e1e] p-6 rounded-2xl">
                <h2 className="text-2xl font-bold mb-4">About Us Page</h2>
                <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={10} className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none"></textarea>
                <button onClick={() => handleSave('about')} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Save About Us</button>
            </div>
            <div className="bg-[#1e1e1e] p-6 rounded-2xl">
                <h2 className="text-2xl font-bold mb-4">Terms of Service Page</h2>
                <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={10} className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none"></textarea>
                <button onClick={() => handleSave('terms')} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Save Terms</button>
            </div>
             <div className="bg-[#1e1e1e] p-6 rounded-2xl">
                <h2 className="text-2xl font-bold mb-4">Customer Support Page</h2>
                <textarea value={support} onChange={(e) => setSupport(e.target.value)} rows={10} className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-red-500 focus:outline-none"></textarea>
                <button onClick={() => handleSave('support')} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Save Support Page</button>
            </div>
        </div>
    );
};


// Support Management Component
const SupportManagement = () => {
    const [chats, setChats] = useState<SupportChat[]>([]);
    const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [reply, setReply] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'supportChats'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setChats(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SupportChat)));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!selectedChat) {
            setMessages([]);
            return;
        }
        const messagesRef = collection(db, 'supportChats', selectedChat.id, 'messages');
        const q = query(messagesRef, orderBy('timestamp'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChatMessage)));
        });
        return () => unsubscribe();
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSelectChat = async (chat: SupportChat) => {
        setSelectedChat(chat);
        if (chat.status === 'new') {
            await updateDoc(doc(db, 'supportChats', chat.id), { status: 'read' });
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim() || !selectedChat) return;
        const replyText = reply.trim();
        setReply('');

        try {
            await addDoc(collection(db, 'supportChats', selectedChat.id, 'messages'), {
                text: replyText,
                sender: 'admin',
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, 'supportChats', selectedChat.id), {
                lastMessage: `Admin: ${replyText}`,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            toast.error('Failed to send reply.');
        }
    };

    const handleDeleteChat = async () => {
        if (!selectedChat) return;
        try {
            const messagesRef = collection(db, 'supportChats', selectedChat.id, 'messages');
            const messagesSnapshot = await getDocs(messagesRef);
            
            const batch = writeBatch(db);
            messagesSnapshot.forEach(doc => { batch.delete(doc.ref); });
            await batch.commit();
    
            await deleteDoc(doc(db, 'supportChats', selectedChat.id));
    
            toast.success('Chat deleted successfully.');
            setSelectedChat(null);
        } catch (error) {
            toast.error('Failed to delete chat.');
            console.error("Error deleting chat:", error);
        }
    };
    
    const getSenderClass = (sender: ChatMessage['sender']) => {
        switch (sender) {
            case 'admin': return 'bg-red-600 self-end text-white';
            case 'user': return 'bg-gray-600 self-start text-white';
            default: return 'bg-gray-700 self-center text-gray-300 text-xs px-2 py-1';
        }
    };

    return (
        <div className="bg-[#1e1e1e] rounded-2xl h-[75vh] flex overflow-hidden">
            <div className="w-1/3 border-r border-gray-700/50 flex flex-col">
                <h2 className="text-xl font-bold p-4 border-b border-gray-700/50">Conversations</h2>
                <div className="overflow-y-auto flex-1">
                    {chats.length > 0 ? chats.map(chat => (
                        <div key={chat.id} onClick={() => handleSelectChat(chat)}
                            className={`p-4 cursor-pointer border-l-4 ${selectedChat?.id === chat.id ? 'bg-red-500/10 border-red-500' : 'border-transparent hover:bg-gray-800/50'}`}>
                            <div className="flex justify-between items-center">
                                <p className="font-bold text-white truncate">{chat.userEmail}</p>
                                {chat.status === 'new' && <span className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0 ml-2"></span>}
                            </div>
                            <p className="text-sm text-gray-400 truncate mt-1">{chat.lastMessage}</p>
                            <p className="text-xs text-gray-500 text-right mt-1">{new Date(chat.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    )) : <p className="text-gray-400 p-4">No support chats yet.</p>}
                </div>
            </div>

            <div className="w-2/3 flex flex-col">
                {selectedChat ? (
                    <>
                        <div className="flex justify-between items-center p-4 border-b border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-bold">{selectedChat.userEmail}</h3>
                            </div>
                            <button onClick={() => setIsDeleteModalOpen(true)} aria-label="Delete this conversation" className="text-gray-400 hover:text-red-500 transition-colors">
                                <TrashIcon />
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto flex flex-col space-y-3">
                            {messages.map(msg => (
                                <div key={msg.id} className={`p-3 rounded-lg max-w-[80%] ${getSenderClass(msg.sender)}`}>
                                    <p>{msg.text}</p>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <form onSubmit={handleSendReply} className="p-4 border-t border-gray-700/50 flex items-center">
                            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply..."
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500" />
                            <button type="submit" className="ml-3 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-lg">Send</button>
                        </form>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-lg">Select a conversation to start chatting.</p>
                    </div>
                )}
            </div>
             <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteChat}
                title="Confirm Chat Deletion"
                message={<p>Are you sure you want to permanently delete this conversation? This action cannot be undone.</p>}
                confirmButtonText="Delete"
            />
        </div>
    );
};


export default AdminDashboard;