import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilIcon, CheckIcon, SpinnerIcon, BookOpenIcon } from '../components/Icons';

const StatCard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <div className="flex-1 bg-gray-800/50 p-4 rounded-xl flex items-center space-x-3">
        <div className="text-red-400">{icon}</div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="font-bold text-white text-lg">{value}</p>
        </div>
    </div>
);

const ProfilePage = () => {
    const { appUser, user } = useAuth()!;
    const [nickname, setNickname] = useState('');
    const [emoji, setEmoji] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    
    useEffect(() => {
        if (appUser) {
            setNickname(appUser.nickname || '');
            setEmoji(appUser.emoji || '👋');
        }
    }, [appUser]);

    const handleCancel = () => {
        if (appUser) {
            setNickname(appUser.nickname || '');
            setEmoji(appUser.emoji || '👋');
        }
        setIsEditing(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (emoji.trim().length === 0 || nickname.trim().length === 0) {
            toast.error("Nickname and Emoji cannot be empty.");
            return;
        }
        setSaveState('saving');

        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                nickname: nickname.trim(),
                emoji: emoji,
            });
            setSaveState('saved');
            toast.success('Profile updated successfully!');
            setTimeout(() => {
                setIsEditing(false);
                setSaveState('idle');
            }, 1500);
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile.");
            setSaveState('idle');
        }
    };

    const formattedJoinDate = appUser?.createdAt && typeof appUser.createdAt.toDate === 'function'
        ? new Date(appUser.createdAt.toDate()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
        })
        : 'N/A';

    if (!appUser) {
        return (
            <div className="container mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
                <motion.div
                    className="w-16 h-16 border-4 border-t-4 border-gray-700 border-t-red-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="container mx-auto max-w-4xl px-6 py-12"
        >
            <div className="bg-[#1e1e1e] p-8 rounded-2xl shadow-lg">
                <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-8">
                    <div className="relative flex-shrink-0">
                        <div className="text-8xl bg-gray-700 w-36 h-36 rounded-full flex items-center justify-center ring-4 ring-gray-600">
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={emoji}
                                    onChange={(e) => setEmoji(e.target.value)}
                                    maxLength={2}
                                    className="w-28 text-center bg-transparent outline-none"
                                />
                            ) : (
                                emoji
                            )}
                        </div>
                        <AnimatePresence>
                        {!isEditing && (
                             <motion.button
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                onClick={() => setIsEditing(true)}
                                className="absolute bottom-0 right-0 p-2 rounded-full bg-red-600 hover:bg-red-500 transition text-white"
                                aria-label="Edit Profile"
                            >
                                <PencilIcon />
                            </motion.button>
                        )}
                        </AnimatePresence>
                    </div>
                    
                    <div className="flex-grow w-full">
                         {isEditing ? (
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="text-4xl font-bold text-white bg-gray-800 text-center md:text-left rounded-lg p-2 outline-none focus:ring-2 focus:ring-red-500 w-full"
                            />
                        ) : (
                            <h1 className="text-4xl font-bold text-white">{nickname}</h1>
                        )}
                        <p className="text-gray-400 mt-1">{appUser.email}</p>

                        <div className="mt-6 flex flex-col sm:flex-row gap-4">
                            <StatCard title="Role" value={appUser.role} icon={<CheckIcon />} />
                            <StatCard title="Joined" value={formattedJoinDate} icon={<CheckIcon />} />
                            <StatCard title="Completed" value={appUser.completedCourses?.length || 0} icon={<BookOpenIcon />} />
                        </div>
                    </div>
                </div>
                
                <AnimatePresence>
                    {isEditing && (
                        <motion.form
                            onSubmit={handleSubmit}
                            className="mt-8 border-t border-gray-700 pt-6"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto', transition: { delay: 0.1 } }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="flex items-center justify-center md:justify-end space-x-4">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saveState !== 'idle'}
                                    className="w-40 flex justify-center items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition disabled:bg-red-800/50 disabled:cursor-not-allowed"
                                >
                                    {saveState === 'idle' && 'Save Changes'}
                                    {saveState === 'saving' && <SpinnerIcon />}
                                    {saveState === 'saved' && <CheckIcon />}
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default ProfilePage;