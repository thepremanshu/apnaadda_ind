import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { motion } from 'framer-motion';

const StaticPage = () => {
    const { pageName } = useParams<{ pageName: string }>();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
    
            if (!pageName) {
                setTitle('Page Not Found');
                setContent('The page you are looking for does not exist.');
                setLoading(false);
                return;
            }
    
            let docId = '';
            let pageTitle = '';
    
            switch (pageName) {
                case 'about':
                    docId = 'about';
                    pageTitle = 'About Us';
                    break;
                case 'terms':
                    docId = 'terms';
                    pageTitle = 'Terms of Service';
                    break;
                case 'support':
                    docId = 'support';
                    pageTitle = 'Customer Support';
                    break;
                default:
                    docId = '';
                    pageTitle = 'Page Not Found';
                    setContent('The page you are looking for does not exist.');
                    break;
            }
    
            setTitle(pageTitle);
    
            if (docId) {
                try {
                    const docRef = doc(db, 'siteContent', docId);
                    const docSnap = await getDoc(docRef);
    
                    if (docSnap.exists()) {
                        setContent(docSnap.data().content);
                    } else {
                        if (pageName === 'support') {
                            setContent("For any support queries, please use the support widget on the bottom right of the page or email us at support@apnaadda.com.");
                        } else {
                            setContent('Content for this page has not been set up yet.');
                        }
                    }
                } catch (error: any) {
                    console.error("Error fetching page content:", error);
                    // Provide a more specific error message for offline scenarios.
                    // Using String(error) is more robust as it handles different error shapes.
                    if (error.code === 'unavailable' || String(error).toLowerCase().includes('client is offline')) {
                        setContent('You appear to be offline. This page was not saved for offline viewing. Please connect to the internet and visit this page again to save it for later.');
                    } else {
                        setContent('Could not load content due to a network or permission error.');
                    }
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
    
        fetchContent();
    }, [pageName]);

    if (loading) {
        return (
            <div className="container mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
                <motion.div
                    className="w-16 h-16 border-4 border-t-4 border-gray-700 border-t-red-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <h2 className="mt-4 text-2xl font-bold bg-gradient-to-r from-red-500 to-sky-400 text-transparent bg-clip-text">
                    APNA ADDA
                </h2>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="container mx-auto px-6 py-12"
        >
            <div className="max-w-4xl mx-auto bg-[#1e1e1e] p-8 rounded-2xl">
                <h1 className="text-4xl font-bold mb-6 text-white">{title}</h1>
                <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap">
                    {content}
                </div>
            </div>
        </motion.div>
    );
};

export default StaticPage;