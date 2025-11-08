import React, { useState, useEffect, createContext, useContext, ReactNode, PropsWithChildren, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs, orderBy, updateDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';

import { AuthContextType, AppUser, ChatMessage, SupportChat } from './types';
import Home from './pages/Home';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/AdminDashboard';
import StaticPage from './pages/StaticPage';
import ProfilePage from './pages/ProfilePage';
import { MenuIcon, XIcon, MessageSquareIcon } from './components/Icons';
import LoginPromptModal from './components/LoginPromptModal';
import ConfirmationModal from './components/ConfirmationModal';
import TelegramJoinModal from './components/TelegramJoinModal';


// --- AUTH CONTEXT ---
const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }: PropsWithChildren<{}>) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  let userListenerUnsubscribe: (() => void) | null = null;

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (userListenerUnsubscribe) {
        userListenerUnsubscribe();
      }

      setUser(firebaseUser);

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userListenerUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const isAdminEmail = firebaseUser.email?.toLowerCase() === 'thepremanshu@gmail.com';

                // Force-correct the role if the user has the admin email but Firestore has the wrong role.
                if (isAdminEmail && userData.role !== 'admin') {
                    userData.role = 'admin'; // Correct the role in the local state immediately
                    // Asynchronously update the document in Firestore for consistency.
                    updateDoc(userDocRef, { role: 'admin' })
                      .catch(err => console.error("Failed to update admin role in Firestore:", err));
                }
                
                // Patch for legacy users: if createdAt is missing, add it.
                if (!userData.createdAt) {
                    updateDoc(userDocRef, { createdAt: serverTimestamp() })
                      .catch(err => console.error("Error backfilling createdAt:", err));
                    // The onSnapshot listener will re-trigger with the updated document.
                }
                setAppUser({ uid: firebaseUser.uid, ...userData } as AppUser);
            } else {
                // User exists in auth but not in firestore, create them
                const isAdmin = firebaseUser.email?.toLowerCase() === 'thepremanshu@gmail.com';
                const newUser: AppUser = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    role: isAdmin ? 'admin' : 'user',
                    nickname: isAdmin ? 'Admin' : (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'New User'),
                    emoji: isAdmin ? '👑' : '👋',
                    createdAt: serverTimestamp(),
                };
                // The listener will be triggered again after this setDoc, updating the state
                setDoc(userDocRef, newUser).catch(err => console.error("Failed to create user doc:", err));
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching user data:", error);
            // Fallback for safety
            const isAdmin = firebaseUser.email?.toLowerCase() === 'thepremanshu@gmail.com';
            setAppUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: isAdmin ? 'admin' : 'user' });
            setLoading(false);
        });
      } else {
        // User is signed out
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userListenerUnsubscribe) {
        userListenerUnsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// --- LOADING SCREEN ---
const LoadingScreen = () => (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-50"
    >
      <div className="text-center">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity, repeatType: 'reverse' }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight mb-8"
        >
          <span className="bg-gradient-to-r from-red-500 to-sky-400 text-transparent bg-clip-text animated-gradient-text">
              APNA ADDA
          </span>
        </motion.h1>
         <motion.div
              className="w-12 h-12 mx-auto border-4 border-t-4 border-gray-700 border-t-red-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
      </div>
      <div className="absolute bottom-5 w-full text-center text-gray-500 text-sm">
        <p>A Product by Premanshu Kumar</p>
      </div>
    </motion.div>
);


// --- HEADER ---
const baseNavLinks = [
    { name: 'Home', path: '/' },
    { name: '12th Board', path: '/?category=12th%20Board' },
    { name: 'JEE', path: '/?category=JEE' },
    { name: '11th', path: '/?category=11th' },
    { name: 'AI', path: '/?category=AI' },
    { name: 'Development', path: '/?category=Development' },
];

const Header = () => {
    const { appUser, user } = useAuth()!;
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    
    const handleLogoutClick = () => {
        setIsLogoutModalOpen(true);
    };

    const confirmLogout = async () => {
        await signOut(auth);
        toast.success('Logged out successfully');
        navigate('/');
        setIsLogoutModalOpen(false);
    };

    const navLinks = useMemo(() => {
        if (appUser?.role === 'admin') {
            return [...baseNavLinks, { name: 'Admin Panel', path: '/admin' }];
        }
        return baseNavLinks;
    }, [appUser]);
    
    const currentPath = location.pathname + location.search;
    const [underlinedPath, setUnderlinedPath] = useState(currentPath);

    useEffect(() => {
        setUnderlinedPath(currentPath);
    }, [currentPath]);
    
    return (
        <>
            <header className="bg-[#0f0f0f]/80 backdrop-blur-sm sticky top-0 z-40">
                <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div 
                        className="hidden md:flex items-center space-x-6"
                        onMouseLeave={() => setUnderlinedPath(currentPath)}
                    >
                        {navLinks.map(link => {
                            const isUnderlined = underlinedPath === link.path;
                            const isAdminLink = link.path === '/admin';
                            return (
                                 <Link 
                                    key={link.name} 
                                    to={link.path} 
                                    className="relative py-2"
                                    onMouseEnter={() => setUnderlinedPath(link.path)}
                                >
                                    <span className={`transition ${
                                        isAdminLink 
                                            ? `font-semibold ${isUnderlined ? 'text-red-500' : 'text-red-400 hover:text-red-500'}`
                                            : `${isUnderlined ? 'text-white' : 'text-gray-300 hover:text-white'}`
                                    }`}>
                                        {link.name}
                                    </span>
                                    {isUnderlined && (
                                        <motion.div 
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" 
                                            layoutId="underline"
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="hidden md:flex items-center space-x-4">
                            {user ? (
                                <>
                                    <Link to="/profile" className="flex items-center space-x-2 text-gray-300 hover:text-white transition group">
                                        <span className="bg-gray-700 w-9 h-9 rounded-full flex items-center justify-center text-xl group-hover:ring-2 group-hover:ring-red-500 transition-all duration-300">
                                            {appUser?.emoji || '👤'}
                                        </span>
                                        <span className="font-semibold">{appUser?.nickname || user.email?.split('@')[0]}</span>
                                    </Link>
                                    <button onClick={handleLogoutClick} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition">Logout</button>
                                </>
                            ) : (
                                <Link to="/auth" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition">Login</Link>
                            )}
                        </div>
                        <div className="md:hidden">
                            <button onClick={() => setIsOpen(!isOpen)}>
                                {isOpen ? <XIcon /> : <MenuIcon />}
                            </button>
                        </div>
                    </div>
                </nav>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden flex flex-col items-center space-y-4 py-4 bg-[#1a1a1a]"
                        >
                            {navLinks.map(link => <Link key={link.name} to={link.path} onClick={() => setIsOpen(false)} className={`transition ${link.path === '/admin' ? 'text-red-400 hover:text-red-500 font-semibold' : 'text-gray-300 hover:text-white'}`}>{link.name}</Link>)}
                             {user ? (
                                <>
                                    <Link to="/profile" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-white transition">My Profile</Link>
                                    <button onClick={handleLogoutClick} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition w-4/5">Logout</button>
                                </>
                            ) : (
                                <Link to="/auth" onClick={() => setIsOpen(false)} className="bg-gray-700 text-center hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition w-4/5">Login</Link>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>
            <ConfirmationModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={confirmLogout}
                title="Confirm Logout"
                message="Are you sure you want to log out from APNA ADDA?"
                confirmButtonText="Logout"
            />
        </>
    );
};


// --- FOOTER ---
const Footer = () => (
  <footer className="bg-[#121212] py-8 mt-16">
    <div className="container mx-auto px-6 text-center text-gray-400">
        <div className="flex justify-center space-x-6 mb-4">
            <Link to="/page/about" className="hover:text-white">About Us</Link>
            <Link to="/page/terms" className="hover:text-white">Terms of Service</Link>
            <Link to="/page/support" className="hover:text-white">Customer Support</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} APNA ADDA. All Rights Reserved. Platform by PREMANSHU.</p>
    </div>
  </footer>
);

// --- SUPPORT WIDGET ---
const SupportWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const { user } = useAuth()!;
    const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const lastCheckedTimestamp = useRef<number>(Date.now());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Effect 1: Find chatId for the current user. This runs constantly for a logged-in user.
    useEffect(() => {
        if (!user) {
            setChatId(null);
            setMessages([]); // Clear messages on logout
            return;
        }
        const chatsRef = collection(db, 'supportChats');
        const q = query(chatsRef, where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setChatId(snapshot.docs[0].id);
            } else {
                setChatId(null);
                 if (messages.length === 0) {
                    setMessages([{
                        id: 'welcome-msg',
                        text: "Hello! Welcome to APNA ADDA Support. How can we assist you today?",
                        sender: 'system',
                        timestamp: new Date()
                    }]);
                }
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Effect 2: Listen for messages to display when widget is open
    useEffect(() => {
        if (!chatId) {
            // Welcome message is handled in Effect 1 now
            return;
        }
    
        // If the widget is closed, we don't need a listener. Messages are preserved.
        if (!isOpen) {
            return;
        }
    
        const messagesRef = collection(db, 'supportChats', chatId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp'));
        
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            if (snapshot.empty) {
                 setMessages([{
                    id: 'welcome-back-msg',
                    text: "Welcome back! Let us know how we can help.",
                    sender: 'system',
                    timestamp: new Date()
                }]);
            } else {
                setMessages(msgs);
            }
        });
    
        return () => unsubscribe();
    }, [isOpen, chatId]);

    // Effect 3: Listen for notifications when widget is closed. This is the new, robust logic.
    useEffect(() => {
        if (isOpen || !chatId) {
            return;
        }
        const messagesRef = collection(db, 'supportChats', chatId, 'messages');
        // Query for messages that are newer than the last time we checked.
        const messagesQuery = query(messagesRef, where("timestamp", ">", new Date(lastCheckedTimestamp.current)));

        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const newMessage = change.doc.data();
                    if (newMessage.sender === 'admin') {
                        toast("Agent has replied to your message.", { icon: '💬' });
                        setUnreadCount(prev => prev + 1);
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [isOpen, chatId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;
    
        const userMessageText = newMessage.trim();
        setNewMessage('');
    
        const isNewChat = !chatId;
    
        // --- Optimistic UI Update ---
        const tempUserMessage: ChatMessage = {
            id: `temp-${Date.now()}`, text: userMessageText, sender: 'user', timestamp: new Date(),
        };
        let tempSystemMessage: ChatMessage | null = null;
        
        if (isNewChat) {
            tempSystemMessage = {
                id: `temp-${Date.now() + 1}`, text: "Our agent will shortly assists you...", sender: 'system', timestamp: new Date(),
            };
            // For a new chat, we replace the welcome message with the new conversation.
            setMessages([tempUserMessage, tempSystemMessage]);
        } else {
            // For an existing chat, we append the new message.
            setMessages(prev => [...prev, tempUserMessage]);
        }
    
        try {
            let currentChatId = chatId;
            
            if (!currentChatId) {
                const chatData: Omit<SupportChat, 'id'> = {
                    userId: user.uid, userEmail: user.email || 'anonymous', lastMessage: userMessageText, timestamp: serverTimestamp(), status: 'new'
                };
                const newChatRef = await addDoc(collection(db, 'supportChats'), chatData);
                currentChatId = newChatRef.id;
                setChatId(currentChatId);
            }
    
            if (!currentChatId) throw new Error("Could not create or find a chat session.");
    
            const messagesRef = collection(db, 'supportChats', currentChatId, 'messages');
            const promises = [];
            
            promises.push(addDoc(messagesRef, { text: userMessageText, sender: 'user', timestamp: serverTimestamp() }));
            promises.push(updateDoc(doc(db, 'supportChats', currentChatId), { lastMessage: userMessageText, timestamp: serverTimestamp(), status: 'new' }));
    
            if (isNewChat) {
                promises.push(addDoc(messagesRef, { text: "Our agent will shortly assists you...", sender: 'system', timestamp: serverTimestamp() }));
            }
            
            await Promise.all(promises);
    
        } catch (error) {
            console.error("Error sending support message:", error);
            toast.error("Failed to send message.");
            // --- Revert optimistic update on failure ---
            setMessages(prev => prev.filter(m => {
                if (m.id === tempUserMessage.id) return false;
                if (tempSystemMessage && m.id === tempSystemMessage.id) return false;
                return true;
            }));
        }
    };
    
    const handleSupportIconClick = () => {
        if (!user) {
            setIsLoginPromptOpen(true);
            return;
        }
        if (!isOpen) { // If it's about to be opened
            setUnreadCount(0);
            // Update timestamp to prevent notifications for messages we are about to see.
            lastCheckedTimestamp.current = Date.now();
        }
        setIsOpen(!isOpen);
    };

    const getSenderClass = (sender: ChatMessage['sender']) => {
        switch (sender) {
            case 'user': return 'bg-red-600 self-end text-white';
            case 'admin': return 'bg-gray-600 self-start text-white';
            default: return 'bg-gray-700 self-center text-gray-300 text-sm';
        }
    };

    return (
        <>
            <div className="fixed bottom-5 right-5 z-50">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="w-80 h-[28rem] bg-[#1e1e1e] rounded-2xl shadow-lg mb-4 flex flex-col"
                        >
                            <div className="flex justify-between items-center p-4 border-b border-gray-700">
                                <h3 className="font-bold text-lg">Hello</h3>
                                <button onClick={() => setIsOpen(false)}><XIcon /></button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto flex flex-col space-y-3">
                                {messages.map(msg => (
                                    <div key={msg.id} className={`p-3 rounded-lg max-w-xs ${getSenderClass(msg.sender)}`}>
                                        <p>{msg.text}</p>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700 flex items-center">
                                <input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                                <button type="submit" className="ml-2 bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded-lg transition">Send</button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className="relative">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSupportIconClick}
                        className="bg-red-600 text-white rounded-full p-4 shadow-xl flex items-center justify-center"
                        aria-label={isOpen ? "Close support chat" : `Open support chat, ${unreadCount} unread messages`}
                    >
                        {isOpen ? <XIcon /> : <MessageSquareIcon />}
                    </motion.button>
                     <AnimatePresence>
                        {unreadCount > 0 && !isOpen && (
                            <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="absolute top-0 right-0 bg-sky-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center transform translate-x-1/4 -translate-y-1/4 pointer-events-none"
                            >
                                {unreadCount}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <LoginPromptModal isOpen={isLoginPromptOpen} onClose={() => setIsLoginPromptOpen(false)} />
        </>
    );
};


// --- PROTECTED ROUTE ---
const ProtectedRoute = ({ children }: PropsWithChildren<{}>) => {
    const { user, loading } = useAuth()!;
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            toast.error("You must be logged in to view this page.");
            navigate('/auth');
        }
    }, [user, loading, navigate]);
    
    if (loading || !user) {
        return <div className="h-screen flex items-center justify-center">Authenticating...</div>;
    }
    
    return <>{children}</>;
};

// --- ADMIN ROUTE ---
const AdminRoute = ({ children }: PropsWithChildren<{}>) => {
    const { appUser, loading } = useAuth()!;
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && (!appUser || appUser.role !== 'admin')) {
            toast.error("Access Denied. Admins only.");
            navigate('/');
        }
    }, [appUser, loading, navigate]);
    
    if (loading || !appUser || appUser.role !== 'admin') {
        return <div className="h-screen flex items-center justify-center">Authenticating...</div>;
    }
    
    return <>{children}</>;
};

// --- TELEGRAM MODAL MANAGER ---
const TelegramModalManager = () => {
  const { user, loading } = useAuth()!;
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  useEffect(() => {
    if (loading) return; // Wait for authentication state to be determined

    if (user) {
      // If user is logged in, ensure the modal is closed and do nothing else.
      setIsTelegramModalOpen(false);
      return;
    }

    // If user is not logged in, check localStorage.
    const hasSeenPrompt = localStorage.getItem('hasSeenTelegramPrompt');
    if (!hasSeenPrompt) {
      setIsTelegramModalOpen(true);
    }
  }, [user, loading]);

  const handleTelegramModalClose = () => {
    localStorage.setItem('hasSeenTelegramPrompt', 'true');
    setIsTelegramModalOpen(false);
  };

  return (
    <TelegramJoinModal
      isOpen={isTelegramModalOpen}
      onClose={handleTelegramModalClose}
    />
  );
};


// --- MAIN APP ---
const App = () => {
  const [isAppLoading, setIsAppLoading] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Pre-fetch static content for offline availability
    const prefetchStaticContent = async () => {
      try {
        const contentIds = ['about', 'terms', 'support'];
        // This will fetch the documents and Firestore's persistence layer will cache them.
        const promises = contentIds.map(id => getDoc(doc(db, 'siteContent', id)));
        await Promise.all(promises);
        console.log('Static content pre-fetched for offline availability.');
      } catch (error: any) {
        // This is not a critical error.
        // It might fail if the user is offline on the very first app load.
        // In that case, the StaticPage component will show its own loading error.
        console.warn('Could not pre-fetch static content for offline use. It might be unavailable offline on first visit.', error.message);
      }
    };

    prefetchStaticContent();
  }, []);

  return (
    <AuthProvider>
        <Toaster position="top-center" toastOptions={{
            style: {
                background: '#333',
                color: '#fff',
            },
        }} />
        <AnimatePresence>
            {isAppLoading && <LoadingScreen />}
        </AnimatePresence>
        {!isAppLoading && (
            <HashRouter>
                <div className="h-screen flex flex-col bg-[#0f0f0f] overflow-hidden">
                    <Header />
                    <div className="flex-1 overflow-y-auto">
                        <main>
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/auth" element={<AuthPage />} />
                                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                                <Route path="/page/:pageName" element={<StaticPage />} />
                            </Routes>
                        </main>
                        <Footer />
                    </div>
                    <SupportWidget />
                </div>
                <TelegramModalManager />
            </HashRouter>
        )}
    </AuthProvider>
  );
};

export default App;