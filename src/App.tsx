/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Download, 
  Languages, 
  Settings2, 
  History, 
  BookText, 
  Search, 
  Trash2, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  X,
  Plus,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SubtitleBlock, TranslationOptions, DictionaryEntry, TranslationHistory } from './types';
import { parseSRT, stringifySRT, validateSRT } from './utils/srtParser';
import { translateBlocks } from './services/geminiService';

const LANGUAGES = [
  { code: 'auto', name: 'Tự động nhận diện' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'en', name: 'Tiếng Anh' },
  { code: 'zh', name: 'Tiếng Trung' },
  { code: 'ja', name: 'Tiếng Nhật' },
  { code: 'ko', name: 'Tiếng Hàn' },
  { code: 'fr', name: 'Tiếng Pháp' },
  { code: 'de', name: 'Tiếng Đức' },
  { code: 'es', name: 'Tiếng Tây Ban Nha' },
  { code: 'th', name: 'Tiếng Thái' },
];

export default function App() {
  const [blocks, setBlocks] = useState<SubtitleBlock[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('vi');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'history' | 'dictionary' | 'settings'>('preview');
  
  // Options
  const [options, setOptions] = useState<TranslationOptions>({
    keepNames: true,
    localizeNames: false,
    keepTerminology: true,
    softenSensitive: false,
    maintainLineCount: true,
    noMerge: true,
    noSplit: true,
    style: 'natural',
  });

  // Dictionary
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>(() => {
    const saved = localStorage.getItem('srt_dictionary');
    return saved ? JSON.parse(saved) : [];
  });

  // History
  const [history, setHistory] = useState<TranslationHistory[]>(() => {
    const saved = localStorage.getItem('srt_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Search & Replace
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  useEffect(() => {
    localStorage.setItem('srt_dictionary', JSON.stringify(dictionary));
  }, [dictionary]);

  useEffect(() => {
    localStorage.setItem('srt_history', JSON.stringify(history));
  }, [history]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.srt')) {
      setError('Chỉ chấp nhận file định dạng .srt');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (validateSRT(content)) {
        const parsed = parseSRT(content);
        setBlocks(parsed);
        setFileName(file.name);
        setError(null);
        setActiveTab('preview');
      } else {
        setError('File SRT không đúng định dạng hoặc bị lỗi.');
      }
    };
    reader.readAsText(file);
  };

  const startTranslation = async () => {
    if (blocks.length === 0) return;
    setIsTranslating(true);
    setProgress(0);
    setError(null);

    try {
      const result = await translateBlocks(
        blocks,
        sourceLang,
        targetLang,
        options,
        dictionary,
        (p) => setProgress(p)
      );
      setBlocks(result);
      
      // Add to history
      const newHistory: TranslationHistory = {
        id: Date.now().toString(),
        fileName,
        sourceLang,
        targetLang,
        timestamp: Date.now(),
        blocks: result,
      };
      setHistory(prev => [newHistory, ...prev].slice(0, 20)); // Keep last 20
    } catch (err) {
      setError('Lỗi trong quá trình dịch. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  const downloadSRT = () => {
    const content = stringifySRT(blocks, true);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const langSuffix = targetLang === 'auto' ? '' : `_${targetLang}`;
    a.href = url;
    a.download = fileName.replace('.srt', `${langSuffix}.srt`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBlockEdit = (id: number, text: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, translatedText: text } : b));
  };

  const handleSearchReplace = () => {
    if (!searchTerm) return;
    setBlocks(prev => prev.map(b => ({
      ...b,
      translatedText: (b.translatedText || b.text).replaceAll(searchTerm, replaceTerm)
    })));
    setSearchTerm('');
    setReplaceTerm('');
  };

  const addToDictionary = () => {
    if (!searchTerm || !replaceTerm) return;
    setDictionary(prev => [...prev, { original: searchTerm, replacement: replaceTerm }]);
    setSearchTerm('');
    setReplaceTerm('');
  };

  const removeFromDictionary = (index: number) => {
    setDictionary(prev => prev.filter((_, i) => i !== index));
  };

  const loadFromHistory = (item: TranslationHistory) => {
    setBlocks(item.blocks);
    setFileName(item.fileName);
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    setActiveTab('preview');
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5E0] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white">
              <Languages size={24} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">SRT Translator AI</h1>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveTab('history')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-[#5A5A40] text-white' : 'hover:bg-gray-100'}`}
              title="Lịch sử"
            >
              <History size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('dictionary')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'dictionary' ? 'bg-[#5A5A40] text-white' : 'hover:bg-gray-100'}`}
              title="Từ điển"
            >
              <BookText size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-[#5A5A40] text-white' : 'hover:bg-gray-100'}`}
              title="Cài đặt"
            >
              <Settings2 size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Top Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-[#E5E5E0]">
            <label className="block text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Tải file phụ đề</label>
            <div className="relative group">
              <input 
                type="file" 
                accept=".srt" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-center gap-3 group-hover:border-[#5A5A40] transition-colors bg-gray-50">
                <Upload size={20} className="text-gray-400 group-hover:text-[#5A5A40]" />
                <span className="text-gray-600 font-medium">
                  {fileName || 'Chọn hoặc kéo thả file .srt'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E5E5E0]">
            <label className="block text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Ngôn ngữ</label>
            <div className="flex items-center gap-2">
              <select 
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
              <ArrowRightLeft size={16} className="text-gray-400" />
              <select 
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
              >
                {LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <button 
              onClick={startTranslation}
              disabled={isTranslating || blocks.length === 0}
              className="w-full bg-[#5A5A40] hover:bg-[#4A4A35] disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isTranslating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang dịch {progress}%
                </>
              ) : (
                <>
                  <Play size={20} />
                  Bắt đầu dịch
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-3"
          >
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {/* Content Area */}
        <div className="bg-white rounded-3xl shadow-sm border border-[#E5E5E0] overflow-hidden min-h-[600px] flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-[#E5E5E0] bg-gray-50/50">
            <button 
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'preview' ? 'border-[#5A5A40] text-[#5A5A40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Xem trước & Chỉnh sửa
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history' ? 'border-[#5A5A40] text-[#5A5A40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Lịch sử
            </button>
            <button 
              onClick={() => setActiveTab('dictionary')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'dictionary' ? 'border-[#5A5A40] text-[#5A5A40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Từ điển cá nhân
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'settings' ? 'border-[#5A5A40] text-[#5A5A40]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Tùy chọn nâng cao
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'preview' && (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {blocks.length === 0 ? (
                    <div className="h-96 flex flex-col items-center justify-center text-gray-400">
                      <Upload size={48} className="mb-4 opacity-20" />
                      <p>Chưa có file nào được tải lên</p>
                    </div>
                  ) : (
                    <>
                      {/* Search & Replace Bar */}
                      <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input 
                            type="text" 
                            placeholder="Tìm kiếm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                          />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Thay thế bằng..."
                          value={replaceTerm}
                          onChange={(e) => setReplaceTerm(e.target.value)}
                          className="flex-1 min-w-[200px] px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                        />
                        <button 
                          onClick={handleSearchReplace}
                          className="px-4 py-2 bg-white border border-gray-200 hover:border-[#5A5A40] text-[#5A5A40] rounded-xl text-sm font-medium transition-colors"
                        >
                          Thay thế tất cả
                        </button>
                        <button 
                          onClick={addToDictionary}
                          className="px-4 py-2 bg-[#5A5A40] text-white rounded-xl text-sm font-medium hover:bg-[#4A4A35] transition-colors flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Thêm vào từ điển
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-4">Bản gốc</div>
                        <div className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-4">Bản dịch</div>
                      </div>

                      <div className="space-y-4">
                        {blocks.map((block) => (
                          <div key={block.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 group">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative">
                              <span className="absolute -top-2 -left-2 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">{block.id}</span>
                              <div className="text-[10px] font-mono text-gray-400 mb-2">{block.startTime} → {block.endTime}</div>
                              <div className="text-sm whitespace-pre-wrap">{block.text}</div>
                            </div>
                            <div className="p-4 bg-white rounded-2xl border border-[#5A5A40]/20 shadow-sm focus-within:border-[#5A5A40] transition-colors relative">
                              <div className="text-[10px] font-mono text-gray-400 mb-2">{block.startTime} → {block.endTime}</div>
                              <textarea 
                                value={block.translatedText || ''}
                                onChange={(e) => handleBlockEdit(block.id, e.target.value)}
                                placeholder="Chưa có bản dịch..."
                                className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[60px]"
                              />
                              {block.translatedText && (
                                <div className="absolute top-4 right-4 text-[#5A5A40] opacity-0 group-hover:opacity-100 transition-opacity">
                                  <CheckCircle2 size={16} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {history.length === 0 ? (
                    <div className="h-96 flex flex-col items-center justify-center text-gray-400">
                      <History size={48} className="mb-4 opacity-20" />
                      <p>Chưa có lịch sử dịch</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {history.map((item) => (
                        <div key={item.id} className="bg-white border border-[#E5E5E0] rounded-2xl p-4 hover:shadow-md transition-shadow group">
                          <div className="flex justify-between items-start mb-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                              <Languages size={20} />
                            </div>
                            <button 
                              onClick={() => deleteHistoryItem(item.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <h3 className="font-semibold text-sm truncate mb-1">{item.fileName}</h3>
                          <p className="text-xs text-gray-400 mb-3">
                            {new Date(item.timestamp).toLocaleString('vi-VN')}
                          </p>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase">{item.sourceLang}</span>
                            <ArrowRightLeft size={10} className="text-gray-300" />
                            <span className="px-2 py-1 bg-[#5A5A40]/10 text-[#5A5A40] rounded text-[10px] font-bold uppercase">{item.targetLang}</span>
                          </div>
                          <button 
                            onClick={() => loadFromHistory(item)}
                            className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-medium transition-colors"
                          >
                            Tải lại bản dịch
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'dictionary' && (
                <motion.div 
                  key="dictionary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Thêm từ mới</h3>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Từ gốc</label>
                        <input 
                          type="text" 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Dịch là</label>
                        <input 
                          type="text" 
                          value={replaceTerm}
                          onChange={(e) => setReplaceTerm(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                        />
                      </div>
                      <div className="flex items-end">
                        <button 
                          onClick={addToDictionary}
                          className="px-6 py-2 bg-[#5A5A40] text-white rounded-xl text-sm font-medium hover:bg-[#4A4A35] transition-colors"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dictionary.map((entry, idx) => (
                      <div key={idx} className="bg-white border border-[#E5E5E0] rounded-2xl p-4 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm">{entry.original}</span>
                          <ArrowRightLeft size={12} className="text-gray-300" />
                          <span className="text-[#5A5A40] font-semibold text-sm">{entry.replacement}</span>
                        </div>
                        <button 
                          onClick={() => removeFromDictionary(idx)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="max-w-2xl mx-auto space-y-8 py-4"
                >
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Xử lý nội dung</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'keepNames', label: 'Giữ nguyên tên riêng' },
                        { key: 'localizeNames', label: 'Việt hóa tên nhân vật' },
                        { key: 'keepTerminology', label: 'Giữ nguyên thuật ngữ chuyên ngành' },
                        { key: 'softenSensitive', label: 'Thay từ nhạy cảm bằng từ nhẹ hơn' },
                        { key: 'maintainLineCount', label: 'Giữ nguyên số dòng trong mỗi block' },
                        { key: 'noMerge', label: 'Không ghép đoạn' },
                        { key: 'noSplit', label: 'Không tách đoạn' },
                      ].map((opt) => (
                        <label key={opt.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
                          <span className="text-sm font-medium">{opt.label}</span>
                          <input 
                            type="checkbox" 
                            checked={(options as any)[opt.key]}
                            onChange={(e) => setOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                            className="w-5 h-5 rounded border-gray-300 text-[#5A5A40] focus:ring-[#5A5A40]"
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Văn phong dịch</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'modern', label: 'Hiện đại' },
                        { id: 'formal', label: 'Trang trọng' },
                        { id: 'natural', label: 'Tự nhiên' },
                      ].map((style) => (
                        <button 
                          key={style.id}
                          onClick={() => setOptions(prev => ({ ...prev, style: style.id as any }))}
                          className={`p-4 rounded-2xl border text-sm font-medium transition-all ${options.style === style.id ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          {blocks.length > 0 && activeTab === 'preview' && (
            <div className="p-6 bg-gray-50 border-t border-[#E5E5E0] flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Tổng cộng: <span className="font-bold text-[#1A1A1A]">{blocks.length}</span> đoạn phụ đề
              </div>
              <button 
                onClick={downloadSRT}
                className="bg-white border border-[#E5E5E0] hover:border-[#5A5A40] text-[#5A5A40] font-semibold py-3 px-8 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                <Download size={20} />
                Xuất file SRT
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Floating Progress Overlay */}
      <AnimatePresence>
        {isTranslating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full text-center">
              <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-12 h-12 border-4 border-[#5A5A40]/30 border-t-[#5A5A40] rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-bold mb-2">Đang xử lý phụ đề...</h2>
              <p className="text-gray-500 text-sm mb-8">Vui lòng không đóng trình duyệt trong quá trình dịch.</p>
              
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-2">
                <motion.div 
                  className="h-full bg-[#5A5A40]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-right text-xs font-bold text-[#5A5A40]">{progress}% Hoàn tất</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
