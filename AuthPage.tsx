import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { EmailIcon, PasswordIcon } from '../components/Icons';
import { useAuth } from '../App';

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
};

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth()!;

  useEffect(() => {
    // If the user is already logged in (e.g., they navigated to /auth manually),
    // redirect them to the home page immediately.
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Logged in successfully!');
        navigate('/');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const role = email.toLowerCase() === 'thepremanshu@gmail.com' ? 'admin' : 'user';
        
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: role,
          nickname: user.email?.split('@')[0] || 'New User',
          emoji: '👋',
          createdAt: serverTimestamp(),
        });

        toast.success('Account created successfully!');
        navigate('/');
      }
    } catch (error: any) {
      console.error("Authentication error:", error.code, error.message);
      let errorMessage = "An unknown error occurred. Please try again.";
      switch (error.code) {
        case 'auth/invalid-credential':
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
          // Clear the password field on invalid credentials to prompt a re-entry.
          setPassword('');
          break;
        case 'auth/email-already-in-use':
          errorMessage = "This email is already in use. Please log in or use a different email.";
          break;
        case 'auth/weak-password':
          errorMessage = "Your password is too weak. Please use at least 6 characters.";
          break;
        case 'auth/invalid-email':
            errorMessage = "Please enter a valid email address.";
            break;
        case 'auth/visibility-check-was-unavailable':
            errorMessage = "A temporary issue occurred. Please try again. If the problem persists, refreshing the page might help.";
            break;
        default:
          errorMessage = "An authentication error occurred. Please try again later.";
          break;
      }
      toast.error(errorMessage);
      setIsLoading(false); // Only reset loading state on error
    }
  };
  
  // While checking auth state or if user is already logged in, show a loader
  // This prevents the form from flashing for logged-in users before redirect.
  if (loading || user) {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-12 px-4">
            <p className="text-lg text-gray-300">Checking authentication...</p>
        </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-12 px-4">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md p-8 space-y-4 bg-[#1a1a1a] rounded-3xl shadow-2xl shadow-red-500/10 border border-gray-800"
      >
        <motion.div variants={itemVariants} className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-sky-500 text-transparent bg-clip-text mb-2">
                APNA ADDA
            </h1>
            <h2 className="text-2xl font-bold text-white">
                {isLogin ? 'Welcome Back!' : 'Create Your Account'}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-red-500 hover:text-red-400 focus:outline-none">
                {isLogin ? 'Sign up' : 'Sign in'}
                </button>
            </p>
        </motion.div>
        
        <form className="space-y-4" onSubmit={handleSubmit}>
            <motion.div variants={itemVariants} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EmailIcon />
                </div>
                <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm rounded-lg"
                    placeholder="Email address"
                />
            </motion.div>

            <motion.div variants={itemVariants} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PasswordIcon />
                </div>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm rounded-lg"
                    placeholder="Password"
                />
            </motion.div>

            <motion.div variants={itemVariants}>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 disabled:bg-red-800 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Processing...' : (isLogin ? 'Sign in' : 'Create Account')}
                </motion.button>
            </motion.div>
        </form>

        <motion.div variants={itemVariants} className="mt-6 text-center">
            <button
                type="button"
                onClick={() => navigate('/')}
                className="text-sm text-gray-500 hover:text-red-400 transition"
            >
                Back to Home
            </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AuthPage;