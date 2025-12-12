import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Stethoscope, Sparkles, AlertCircle, Send, MessageSquare, Bot } from 'lucide-react';
import { MediaUpload } from './components/ImageUpload';
import { ResultDisplay } from './components/ResultDisplay';
import { analyzeHealthInput, createChatSession, sendChatMessage } from './services/geminiService';
import { MediaFile, AnalysisState, ChatMessage } from './types';
import { Chat } from "@google/genai";
import ReactMarkdown from 'react-markdown';

// Web Speech API type definition augmentation
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [description, setDescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    result: null
  });

  // Chat State
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Speech Recognition Logic
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.start();
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setAnalysis({ isLoading: true, error: null, result: null });
    setChatSession(null);
    setChatMessages([]);
    
    try {
      const result = await analyzeHealthInput(
        selectedFile.base64,
        selectedFile.mimeType,
        description
      );
      
      setAnalysis({ isLoading: false, error: null, result });
      
      // Initialize Chat Session immediately after analysis
      const newChat = createChatSession(
        selectedFile.base64,
        selectedFile.mimeType,
        description,
        result
      );
      setChatSession(newChat);

    } catch (err: any) {
      setAnalysis({ 
        isLoading: false, 
        error: err.message || "An unexpected error occurred.", 
        result: null 
      });
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !chatSession) return;

    const userMsg: ChatMessage = { role: 'user', text };
    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsChatLoading(true);

    try {
      const responseText = await sendChatMessage(chatSession, text);
      setChatMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error answering that. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const resetApp = () => {
    setSelectedFile(null);
    setDescription('');
    setAnalysis({ isLoading: false, error: null, result: null });
    setChatSession(null);
    setChatMessages([]);
    setInputMessage('');
  };

  // Determine suggested follow-up questions from the report if available
  const suggestedQuestions = analysis.result?.doctor_report?.suggested_questions 
    ? analysis.result.doctor_report.suggested_questions.slice(0, 3) 
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={resetApp}>
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
              <Stethoscope size={20} />
            </div>
            <h1 className="text-xl font-bold text-blue-700 tracking-tight">
              MediSense
            </h1>
          </div>
          {analysis.result && (
            <button 
              onClick={resetApp}
              className="text-sm font-medium text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              New Scan
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!analysis.result ? (
          <div className="space-y-8 animate-fade-in-up">
            
            {/* Intro Text */}
            <div className="text-center space-y-3 mb-8">
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight">AI Health Assistant</h2>
              <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed">
                Upload a photo, video, or medical report. Get a deep multimodal safety assessment.
              </p>
            </div>

            {/* Input Section */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8">
              
              {/* Media Uploader */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider">1. Upload Image, Video, or PDF</label>
                <MediaUpload 
                  selectedFile={selectedFile} 
                  onFileSelect={setSelectedFile} 
                />
              </div>

              {/* Text/Audio Input */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider">2. Describe Symptoms</label>
                <div className="relative group">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe how it feels, how long you've had it, or any other details..."
                    className="w-full p-4 pr-12 h-36 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all bg-white text-slate-900 placeholder:text-slate-400 group-hover:border-slate-400"
                  />
                  <button
                    onClick={isListening ? () => {} : startListening}
                    disabled={isListening}
                    className={`
                      absolute bottom-3 right-3 p-2.5 rounded-full transition-all duration-200 shadow-sm
                      ${isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                      }
                    `}
                    title="Speak to describe"
                  >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleAnalyze}
                disabled={!selectedFile || analysis.isLoading}
                className={`
                  w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all transform active:scale-[0.99]
                  ${!selectedFile || analysis.isLoading
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 animate-pulse'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                  }
                `}
              >
                {analysis.isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Scan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Run Health Scan</span>
                  </>
                )}
              </button>
            </div>
            
             {/* Error Message */}
             {analysis.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 animate-fade-in">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{analysis.error}</p>
                </div>
              )}

          </div>
        ) : (
          /* Results & Chat View */
          <div className="space-y-8 max-w-4xl mx-auto">
            <ResultDisplay data={analysis.result} />
            
            <div className="border-t border-slate-200 pt-10 animate-fade-in">
              <div className="flex items-center space-x-2 mb-6 text-slate-800">
                <MessageSquare className="text-blue-600 w-6 h-6" />
                <h2 className="text-2xl font-bold">Ask Follow-up Questions</h2>
              </div>

              {/* Suggested Questions (from Doctor Report now) */}
              {suggestedQuestions.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="px-4 py-2 bg-white border border-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-50 hover:border-blue-200 transition-all text-left shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat Container */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50">
                   {chatMessages.length === 0 && (
                     <div className="text-center text-slate-400 mt-20 flex flex-col items-center">
                       <div className="bg-slate-100 p-4 rounded-full mb-3">
                        <Bot className="w-8 h-8 opacity-40" />
                       </div>
                       <p className="font-medium">Ask anything about the results above.</p>
                     </div>
                   )}
                   
                   {chatMessages.map((msg, idx) => (
                     <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`
                         max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm
                         ${msg.role === 'user' 
                           ? 'bg-blue-600 text-white rounded-br-none' 
                           : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                         }
                       `}>
                         {msg.role === 'model' ? (
                           <div className="prose prose-sm max-w-none prose-slate prose-p:my-1 prose-headings:my-2 prose-ul:my-2 prose-li:my-0.5">
                             <ReactMarkdown>
                               {msg.text}
                             </ReactMarkdown>
                           </div>
                         ) : (
                           <p>{msg.text}</p>
                         )}
                       </div>
                     </div>
                   ))}
                   
                   {isChatLoading && (
                     <div className="flex justify-start">
                       <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center space-x-2">
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                       </div>
                     </div>
                   )}
                   <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-200 bg-white flex items-center space-x-3">
                  <input 
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputMessage)}
                    placeholder="Type a follow-up question..."
                    disabled={isChatLoading}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 transition-all"
                  />
                  <button 
                    onClick={() => handleSendMessage(inputMessage)}
                    disabled={!inputMessage.trim() || isChatLoading}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}